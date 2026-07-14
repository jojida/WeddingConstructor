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

/* ── Промокоды ────────────────────────────────────────────────────────────────
   Задаются в env без деплоя кода: PROMO_CODES="СВАДЬБА10:10,PARTNER-IRA:15"
   (код:процент скидки, 1–90). Регистр кода не важен. Использованный код
   пишется в metadata платежа ЮKassa — по нему считаем партнёрские комиссии. */
function promoPercent(code: unknown): number | null {
  if (typeof code !== 'string' || !code.trim()) return null;
  const wanted = code.trim().toUpperCase();
  for (const pair of (process.env.PROMO_CODES || '').split(',')) {
    const [c, p] = pair.split(':').map(s => (s || '').trim());
    const pct = Number(p);
    if (c && c.toUpperCase() === wanted && Number.isFinite(pct) && pct >= 1 && pct <= 90) return pct;
  }
  return null;
}

/* ── ЮKassa (API v3) ─────────────────────────────────────────────────────────
   Магазин идентифицируется парой shopId + секретный ключ (Basic auth).
   Старые имена переменных YUMONEY_* принимаются как запасные, чтобы не
   ломать уже настроенный env на сервере. */
const YOOKASSA_API = 'https://api.yookassa.ru/v3';

const kassaAuth = () => {
  const shopId = process.env.YOOKASSA_SHOP_ID || process.env.YUMONEY_SHOP_ID || '';
  const secretKey = process.env.YOOKASSA_SECRET_KEY || process.env.YUMONEY_SECRET_KEY || '';
  const configured = Boolean(shopId && secretKey && shopId !== 'your_shop_id');
  return { shopId, secretKey, configured };
};

async function kassaRequest(method: 'GET' | 'POST', path: string, body?: unknown) {
  const { shopId, secretKey } = kassaAuth();
  const headers: Record<string, string> = {
    Authorization: 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64'),
  };
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    headers['Idempotence-Key'] = crypto.randomUUID();
  }
  const res = await fetch(`${YOOKASSA_API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`YooKassa ${method} ${path} → ${res.status}:`, data);
    throw new Error(data?.description || `YooKassa error ${res.status}`);
  }
  return data;
}

/** Отметить приглашение оплаченным. Уже оплаченное не трогаем (идемпотентно). */
async function markPaid(inviteId: string, plan: string, paymentId: string) {
  const invite = await prisma.invitation.findUnique({ where: { id: inviteId } });
  if (!invite || invite.status === 'paid' || invite.status === 'published') return;
  await prisma.invitation.update({
    where: { id: inviteId },
    data: { status: 'paid', plan, paidAt: new Date(), paymentId },
  });
  console.log(`✅ Payment received for invite ${inviteId}, plan: ${plan}`);
}

// POST /api/payment/create — создать платёж в ЮKassa, вернуть ссылку на оплату
router.post('/create', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { inviteId, plan = 'basic', promoCode } = req.body;

    const invite = await prisma.invitation.findUnique({ where: { id: inviteId } });
    if (!invite || invite.userId !== req.userId) {
      return res.status(404).json({ error: 'Приглашение не найдено' });
    }

    const planData = PLANS[plan as keyof typeof PLANS];
    if (!planData) return res.status(400).json({ error: 'Неверный тариф' });

    const successUrl = `${process.env.FRONTEND_URL}/payment/success?id=${inviteId}`;

    // Уже оплачен — второй платёж не создаём, просто ведём на страницу успеха.
    if (invite.status === 'paid' || invite.status === 'published') {
      return res.json({ alreadyPaid: true, redirectUrl: successUrl });
    }

    if (!kassaAuth().configured) {
      // В проде без настроенной кассы оплату НЕ имитируем — иначе публикация бесплатна.
      if (process.env.NODE_ENV === 'production') {
        return res.status(503).json({ error: 'Оплата временно недоступна. Напишите нам — поможем опубликовать сайт.' });
      }
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

    // Промокод: неверный код — явная ошибка (а не молчаливая полная цена).
    let priceKopecks = planData.price;
    let promo: { code: string; percent: number } | null = null;
    if (promoCode != null && String(promoCode).trim() !== '') {
      const pct = promoPercent(promoCode);
      if (pct == null) return res.status(400).json({ error: 'Промокод не найден или недействителен' });
      promo = { code: String(promoCode).trim().toUpperCase(), percent: pct };
      priceKopecks = Math.round(planData.price * (100 - pct) / 100);
    }

    const amount = { value: (priceKopecks / 100).toFixed(2), currency: 'RUB' };
    const payload: any = {
      amount,
      capture: true, // одностадийный платёж — списываем сразу
      confirmation: { type: 'redirect', return_url: successUrl },
      description: `Сайт-приглашение WeddingCraft — тариф «${planData.label}»`
        + (promo ? ` (промокод ${promo.code}, −${promo.percent}%)` : ''),
      metadata: { inviteId, plan, ...(promo ? { promoCode: promo.code } : {}) },
    };

    // Чек 54-ФЗ: включается флагом, когда в кабинете ЮKassa настроена фискализация.
    if (process.env.YOOKASSA_RECEIPT === 'true') {
      const user = await prisma.user.findUnique({ where: { id: req.userId! } });
      payload.receipt = {
        customer: { email: user?.email },
        items: [{
          description: `Создание сайта-приглашения, тариф «${planData.label}»`,
          quantity: '1.00',
          amount,
          vat_code: 1, // без НДС
          payment_subject: 'service',
          payment_mode: 'full_payment',
        }],
      };
    }

    const payment = await kassaRequest('POST', '/payments', payload);

    // Запоминаем id платежа: по нему /status дозапросит ЮKassa, если вебхук не дошёл.
    await prisma.invitation.update({
      where: { id: inviteId },
      data: { paymentId: payment.id, plan },
    });

    return res.json({ paymentUrl: payment.confirmation?.confirmation_url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Ошибка создания платёжа' });
  }
});

// GET /api/payment/promo/:code — проверка промокода (страница оплаты показывает скидку)
router.get('/promo/:code', authMiddleware, (req: AuthRequest, res: Response) => {
  const percent = promoPercent(req.params.code);
  if (percent == null) return res.status(404).json({ error: 'Промокод не найден или недействителен' });
  return res.json({ code: String(req.params.code).trim().toUpperCase(), percent });
});

// POST /api/payment/webhook — уведомление от ЮKassa (payment.succeeded и др.).
// Подписи в уведомлениях нет, поэтому телу не доверяем: берём из него только
// id платежа и перечитываем платёж из API ЮKassa — оплату подтверждает API.
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { event, object } = req.body || {};
    const paymentId = object?.id;
    if (!event || !paymentId) return res.status(400).send('Bad notification');

    // Прочие события (waiting_for_capture, canceled, refund.*) нам не важны.
    if (event !== 'payment.succeeded') return res.status(200).send('OK');

    if (!kassaAuth().configured) return res.status(503).send('Kassa not configured');

    const payment = await kassaRequest('GET', `/payments/${paymentId}`);
    if (payment.status !== 'succeeded' || !payment.paid) {
      return res.status(200).send('OK'); // API оплату не подтвердил — игнорируем
    }

    const inviteId = payment.metadata?.inviteId;
    if (inviteId) await markPaid(inviteId, payment.metadata?.plan || 'basic', payment.id);
    return res.status(200).send('OK');
  } catch (e) {
    console.error('Webhook error:', e);
    return res.status(500).send('Error'); // ЮKassa повторит уведомление позже
  }
});

// GET /api/payment/status/:inviteId — статус оплаты; если вебхук ещё не дошёл,
// дозапрашиваем платёж у ЮKassa напрямую (страница успеха опрашивает этот роут).
router.get('/status/:inviteId', authMiddleware, async (req: AuthRequest, res: Response) => {
  let invite = await prisma.invitation.findUnique({ where: { id: req.params.inviteId as string } });
  if (!invite || invite.userId !== req.userId) return res.status(404).json({ error: 'Не найдено' });

  const unpaid = invite.status !== 'paid' && invite.status !== 'published';
  if (unpaid && invite.paymentId && invite.paymentId !== 'dev_test' && kassaAuth().configured) {
    try {
      const payment = await kassaRequest('GET', `/payments/${invite.paymentId}`);
      if (payment.status === 'succeeded' && payment.paid) {
        await markPaid(invite.id, payment.metadata?.plan || invite.plan, payment.id);
        invite = await prisma.invitation.findUnique({ where: { id: invite.id } });
      }
    } catch { /* временная ошибка сети/кассы — вернём текущий статус */ }
  }

  return res.json({ status: invite!.status, plan: invite!.plan, paidAt: invite!.paidAt });
});

export default router;
