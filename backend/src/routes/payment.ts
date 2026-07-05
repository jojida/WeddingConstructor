import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Цена — разовый платёж за один сайт (без срока действия).
const PLANS = {
  basic:   { price: 399000, label: 'Базовый' },  // 3 990 руб в копейках
  premium: { price: 599000, label: 'Премиум' },
};

// POST /api/payment/create — создать платёж ЮМани
router.post('/create', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { inviteId, plan = 'basic' } = req.body;

    const invite = await prisma.invitation.findUnique({ where: { id: inviteId } });
    if (!invite || invite.userId !== req.userId) {
      return res.status(404).json({ error: 'Приглашение не найдено' });
    }

    const planData = PLANS[plan as keyof typeof PLANS];
    if (!planData) return res.status(400).json({ error: 'Неверный тариф' });

    const shopId = process.env.YUMONEY_SHOP_ID || '';
    const secretKey = process.env.YUMONEY_SECRET_KEY || '';
    const amount = (planData.price / 100).toFixed(2); // в рублях
    const label = `${inviteId}__${plan}`;
    const successUrl = `${process.env.FRONTEND_URL}/payment/success?id=${inviteId}`;

    if (!shopId || shopId === 'your_shop_id') {
      // Dev mode: auto-approve for testing
      await prisma.invitation.update({
        where: { id: inviteId },
        data: { status: 'paid', plan, paidAt: new Date(), paymentId: 'dev_test' },
      });
      return res.json({
        devMode: true,
        message: 'Тестовый режим: оплата автоматически принята',
        redirectUrl: successUrl,
      });
    }

    // YuMoney payment form URL
    // https://yoomoney.ru/docs/payment-buttons/using-api/forms
    const params = new URLSearchParams({
      receiver: shopId,
      'quickpay-form': 'button',
      paymentType: 'AC',
      sum: amount,
      label,
      successURL: successUrl,
      comment: `Свадебное приглашение — тариф "${planData.label}"`,
    });

    const paymentUrl = `https://yoomoney.ru/quickpay/confirm.xml?${params.toString()}`;
    return res.json({ paymentUrl });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Ошибка создания платёжа' });
  }
});

// POST /api/payment/webhook — уведомление от ЮМани
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const {
      notification_type, operation_id, amount, currency,
      datetime, sender, codepro, label, sha1_hash,
    } = req.body;

    const secretKey = process.env.YUMONEY_SECRET_KEY || '';

    // Verify signature
    const str = [
      notification_type, operation_id, amount, currency,
      datetime, sender, codepro, secretKey, label,
    ].join('&');
    const expectedHash = crypto.createHash('sha1').update(str).digest('hex');

    if (expectedHash !== sha1_hash) {
      console.error('YuMoney webhook: invalid signature');
      return res.status(400).send('Bad signature');
    }

    // Parse label: inviteId__plan
    const [inviteId, plan] = (label as string).split('__');
    if (!inviteId) return res.status(400).send('Bad label');

    await prisma.invitation.update({
      where: { id: inviteId },
      data: {
        status: 'paid',
        plan: plan || 'basic',
        paidAt: new Date(),
        paymentId: operation_id,
      },
    });

    console.log(`✅ Payment received for invite ${inviteId}, plan: ${plan}`);
    return res.status(200).send('OK');
  } catch (e) {
    console.error('Webhook error:', e);
    return res.status(500).send('Error');
  }
});

// GET /api/payment/status/:inviteId
router.get('/status/:inviteId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const invite = await prisma.invitation.findUnique({ where: { id: req.params.inviteId as string } });
  if (!invite || invite.userId !== req.userId) return res.status(404).json({ error: 'Не найдено' });
  return res.json({ status: invite.status, plan: invite.plan, paidAt: invite.paidAt });
});

export default router;
