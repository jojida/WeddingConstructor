import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { isFreeAccount } from '../lib/freeAccounts';
import { confirmPrintPayment } from '../lib/printPayment';
import { PLANS, isPaid, planPriceDue } from '../lib/plans';
import { jwtSecret } from '../lib/security';
import { kassaAuth, kassaRequest, paymentIdValid, paymentRedirect } from '../lib/paymentGateway';
import { PaymentConflict, reservePaymentAttempt, requestAttemptPayment } from '../lib/paymentAttempt';
import { confirmInvitationPayment, matchesInvitationPayment, promoPercent } from '../lib/invitePayment';

export { kassaAuth, kassaRequest } from '../lib/paymentGateway';
const router = Router();

function successUrl(inviteId: string, plan: string) {
  const token = jwt.sign({ purpose: 'payment-return', inviteId }, jwtSecret(), { algorithm: 'HS256', expiresIn: '24h' });
  return `${(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/payment/success?id=${encodeURIComponent(inviteId)}&plan=${encodeURIComponent(plan)}&token=${encodeURIComponent(token)}`;
}

router.post('/create', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { inviteId, plan = 'premium', promoCode } = req.body || {};
    if (typeof inviteId !== 'string' || !inviteId || inviteId.length > 64) return res.status(400).json({ error: 'Неверное приглашение' });
    if (typeof plan !== 'string' || !Object.prototype.hasOwnProperty.call(PLANS, plan)) return res.status(400).json({ error: 'Неверный тариф' });
    const target = plan as keyof typeof PLANS;
    let invite = await prisma.invitation.findFirst({ where: { id: inviteId, userId: req.userId } });
    if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });
    const redirectUrl = successUrl(inviteId, plan);
    const buyer = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (isFreeAccount(buyer?.email)) {
      await prisma.invitation.update({ where: { id: inviteId }, data: { status: plan === 'free' ? 'published' : 'paid', plan, paidAt: plan === 'free' ? null : invite.paidAt ?? new Date(), paymentId: 'free_account' } });
      return res.json({ free: true, plan, redirectUrl, message: 'Сайт опубликован для тестового аккаунта' });
    }
    if (isPaid(invite.status) && invite.plan === plan) return res.json({ alreadyPaid: true, redirectUrl });
    const currentRank = Object.prototype.hasOwnProperty.call(PLANS, invite.plan) ? PLANS[invite.plan as keyof typeof PLANS].rank : 1;
    if (isPaid(invite.status) && PLANS[target].rank < currentRank) return res.status(400).json({ error: 'Выберите тариф выше текущего' });
    if (plan === 'free') {
      const result = await prisma.invitation.updateMany({ where: { id: inviteId, plan: invite.plan, status: invite.status }, data: { status: 'published', plan, paidAt: null } });
      if (!result.count) throw new PaymentConflict('Тариф изменился. Обновите страницу.');
      return res.json({ free: true, plan, redirectUrl, message: 'Сайт опубликован бесплатно' });
    }
    if (!kassaAuth().configured) {
      if (process.env.NODE_ENV === 'development' && process.env.ALLOW_TEST_PAYMENTS === 'true') {
        await prisma.invitation.update({ where: { id: inviteId }, data: { status: 'paid', plan, paidAt: new Date(), paymentId: 'dev_test' } });
        return res.json({ devMode: true, redirectUrl });
      }
      return res.status(503).json({ error: 'Оплата временно недоступна. Напишите нам — поможем опубликовать сайт.' });
    }

    let attempt = await prisma.paymentAttempt.findUnique({ where: { invitationId: inviteId } });
    // Do not abandon a chargeable payment when plan, promo or request changes.
    if (attempt || (invite.paymentId && !['dev_test', 'free_account'].includes(invite.paymentId))) {
      const payment = attempt ? await requestAttemptPayment(attempt) : await kassaRequest('GET', `/payments/${invite.paymentId}`);
      if (!matchesInvitationPayment(payment, invite, attempt)) throw new PaymentConflict('Не удалось сверить предыдущий платёж. Обратитесь в поддержку.');
      if (await confirmInvitationPayment(payment)) {
        invite = (await prisma.invitation.findUnique({ where: { id: inviteId } }))!;
        if (invite.plan === plan) return res.json({ alreadyPaid: true, redirectUrl });
      } else if (payment.status === 'pending') {
        if (payment.metadata.plan !== plan) throw new PaymentConflict('Завершите или отмените предыдущий платёж перед выбором другого тарифа.');
        if (promoCode && (typeof promoCode !== 'string' || promoCode.trim().toUpperCase() !== (payment.metadata.promoCode || ''))) throw new PaymentConflict('Промокод нельзя изменить у уже созданного платежа. Сначала отмените предыдущий платёж.');
        const paymentUrl = paymentRedirect(payment);
        if (!paymentUrl) throw new Error('Missing confirmation');
        return res.json({ paymentUrl });
      } else if (payment.status !== 'canceled') {
        throw new PaymentConflict('Платёж обрабатывается. Проверьте статус через минуту.');
      }
      await prisma.$transaction(async tx => {
        if (attempt) await tx.paymentAttempt.deleteMany({ where: { id: attempt.id, paymentId: payment.id } });
        if (payment.status === 'canceled') await tx.invitation.updateMany({ where: { id: inviteId, paymentId: payment.id }, data: { paymentId: '' } });
      });
      invite = (await prisma.invitation.findUnique({ where: { id: inviteId } }))!;
      attempt = null;
    }

    let priceKopecks = planPriceDue(target, invite.plan, isPaid(invite.status));
    if (priceKopecks <= 0) throw new PaymentConflict('Тариф уже изменился. Обновите страницу.');
    let promo: { code: string; percent: number } | null = null;
    if (promoCode != null && promoCode !== '') {
      const percent = promoPercent(promoCode);
      if (percent === null) return res.status(400).json({ error: 'Промокод не найден или недействителен' });
      promo = { code: promoCode.trim().toUpperCase(), percent };
      priceKopecks = Math.round(priceKopecks * (100 - percent) / 100);
    }
    const amount = { value: (priceKopecks / 100).toFixed(2), currency: 'RUB' };
    const description = (`Сайт-приглашение WeddingCraft — тариф «${PLANS[target].label}»` + (promo ? ` (промокод ${promo.code}, −${promo.percent}%)` : '')).slice(0, 128);
    attempt = await reservePaymentAttempt({ invitationId: inviteId, plan, amountKopecks: priceKopecks, payload: key => ({
      amount, capture: true, description,
      confirmation: { type: 'redirect', return_url: redirectUrl },
      metadata: { product: 'website', inviteId, plan, paymentKey: key, ...(promo ? { promoCode: promo.code } : {}) },
      ...(process.env.YOOKASSA_RECEIPT === 'true' ? { receipt: { customer: { email: buyer!.email }, items: [{ description, quantity: '1.00', amount, vat_code: 1, payment_subject: 'service', payment_mode: 'full_payment' }] } } : {}),
    }) });
    if (attempt.plan !== plan) throw new PaymentConflict('Для приглашения уже создаётся платёж другого тарифа. Обновите страницу.');
    const payment = await requestAttemptPayment(attempt);
    const current = (await prisma.invitation.findUnique({ where: { id: inviteId } }))!;
    if (!matchesInvitationPayment(payment, current, attempt)) throw new Error('Payment verification failed');
    if (await confirmInvitationPayment(payment)) return res.json({ alreadyPaid: true, redirectUrl });
    const paymentUrl = paymentRedirect(payment);
    if (payment.status !== 'pending' || !paymentUrl) throw new PaymentConflict('Платёж обрабатывается. Проверьте статус через минуту.');
    return res.json({ paymentUrl });
  } catch (error) {
    if (error instanceof PaymentConflict) return res.status(409).json({ error: error.message });
    console.error('Payment creation failed:', error instanceof Error ? error.name : 'Error');
    return res.status(502).json({ error: 'Не удалось связаться с оплатой. Попробуйте ещё раз — повторный запрос использует тот же платёж.' });
  }
});

router.get('/promo/:code', authMiddleware, (req, res) => {
  const percent = promoPercent(req.params.code);
  if (percent === null) return res.status(404).json({ error: 'Промокод не найден или недействителен' });
  return res.json({ code: String(req.params.code).trim().toUpperCase(), percent });
});

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { event, object } = req.body || {};
    if (typeof event !== 'string' || !paymentIdValid(object?.id)) return res.status(400).send('Bad notification');
    if (event !== 'payment.succeeded') return res.status(200).send('OK');
    if (!kassaAuth().configured) return res.status(503).send('Kassa not configured');
    const payment = await kassaRequest('GET', `/payments/${object.id}`);
    if (payment?.id !== object.id) return res.status(400).send('Invalid payment');
    if (payment.metadata?.product === 'print') await confirmPrintPayment(payment);
    else await confirmInvitationPayment(payment);
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook failed:', error instanceof Error ? error.name : 'Error');
    return res.status(500).send('Error');
  }
});

async function paymentStatus(inviteId: string) {
  let invite = await prisma.invitation.findUnique({ where: { id: inviteId } });
  if (!invite) return null;
  let paymentStatus: string | undefined;
  if (invite.paymentId && !['dev_test', 'free_account'].includes(invite.paymentId) && kassaAuth().configured) {
    try {
      const payment = await kassaRequest('GET', `/payments/${invite.paymentId}`);
      const attempt = await prisma.paymentAttempt.findUnique({ where: { invitationId: invite.id } });
      if (matchesInvitationPayment(payment, invite, attempt)) {
        paymentStatus = payment.status;
        if (await confirmInvitationPayment(payment)) invite = (await prisma.invitation.findUnique({ where: { id: invite.id } }))!;
      }
    } catch { paymentStatus = 'unavailable'; }
  }
  return { paid: isPaid(invite.status), status: invite.status, plan: invite.plan, slug: invite.slug, paidAt: invite.paidAt, paymentStatus };
}

// A return token grants only billing status for one invitation, not account access.
router.get('/public-status/:inviteId', async (req: Request, res: Response) => {
  const inviteId = String(req.params.inviteId);
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
  let allowed = false;
  try {
    const payload = jwt.verify(typeof req.query.token === 'string' ? req.query.token : '', jwtSecret(), { algorithms: ['HS256'] });
    allowed = typeof payload !== 'string' && payload.purpose === 'payment-return' && payload.inviteId === inviteId;
  } catch { /* Accept owner sessions for legacy return URLs. */ }
  if (!allowed && bearer) {
    try {
      const payload = jwt.verify(bearer, jwtSecret(), { algorithms: ['HS256'] });
      if (typeof payload !== 'string' && typeof payload.userId === 'string') allowed = !!await prisma.invitation.findFirst({ where: { id: inviteId, userId: payload.userId }, select: { id: true } });
    } catch { /* Invalid token. */ }
  }
  if (!allowed) return res.status(401).json({ error: 'Войдите в аккаунт, чтобы проверить оплату' });
  const status = await paymentStatus(inviteId);
  return status ? res.json(status) : res.status(404).json({ error: 'Не найдено' });
});

router.get('/status/:inviteId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const inviteId = String(req.params.inviteId);
  if (!await prisma.invitation.findFirst({ where: { id: inviteId, userId: req.userId }, select: { id: true } })) return res.status(404).json({ error: 'Не найдено' });
  return res.json(await paymentStatus(inviteId));
});

export default router;
