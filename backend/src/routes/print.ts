import { Router } from 'express';
import crypto from 'crypto';
import { isFreeAccount } from '../lib/freeAccounts';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { kassaAuth, kassaRequest } from './payment';
import { confirmPrintPayment } from '../lib/printPayment';
import { PRINT_PRICE, PRINT_TEMPLATES, renderPrintSvg, validatePrintData, printFont, printSize } from '../lib/printDesign';

const router = Router();
router.post('/preview', (req, res) => {
  try {
    const data = validatePrintData(req.body?.data);
    res.type('image/svg+xml').send(renderPrintSvg(req.body?.templateId, data));
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Неверный макет' }); }
});
router.use(authMiddleware);
router.get('/orders', async (req: AuthRequest, res) => {
  const orders = await prisma.printOrder.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json(orders.map(({ paymentKey, paymentId, ...order }) => ({ ...order, data: JSON.parse(order.data) })));
});
router.post('/orders', async (req: AuthRequest, res) => {
  try {
    if (!PRINT_TEMPLATES.some(t => t.id === req.body?.templateId)) return res.status(400).json({ error: 'Шаблон не найден' });
    const data = validatePrintData(req.body?.data);
    const order = await prisma.printOrder.create({ data: { userId: req.userId!, templateId: req.body.templateId, data: JSON.stringify(data) } });
    res.status(201).json({ id: order.id });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Не удалось сохранить макет' }); }
});
router.get('/orders/:id', async (req: AuthRequest, res) => {
  let order = await prisma.printOrder.findFirst({ where: { id: String(req.params.id), userId: req.userId } });
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  let paymentStatus = '';
  if (order.status !== 'paid' && order.paymentId && kassaAuth().configured) {
    try {
      const payment = await kassaRequest('GET', `/payments/${order.paymentId}`);
      paymentStatus = payment.status;
      if (await confirmPrintPayment(payment)) order = (await prisma.printOrder.findUnique({ where: { id: order.id } }))!;
    } catch { paymentStatus = 'unavailable'; }
  }
  const { paymentId, paymentKey, ...safe } = order;
  res.json({ ...safe, data: JSON.parse(order.data), paymentStatus });
});
router.put('/orders/:id', async (req: AuthRequest, res) => {
  try {
    // Only text is editable after purchase; another design is a separate product.
    const data = validatePrintData(req.body?.data);
    const result = await prisma.printOrder.updateMany({ where: { id: String(req.params.id), userId: req.userId }, data: { data: JSON.stringify(data) } });
    if (!result.count) return res.status(404).json({ error: 'Заказ не найден' });
    res.json({ saved: true });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Проверьте данные' }); }
});
router.post('/orders/:id/pay', async (req: AuthRequest, res) => {
  let order = await prisma.printOrder.findFirst({ where: { id: String(req.params.id), userId: req.userId } });
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/print/editor?order=${encodeURIComponent(order.id)}`;
  if (order.status === 'paid') return res.json({ paymentUrl: returnUrl });
  const buyer = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (isFreeAccount(buyer?.email)) {
    await prisma.printOrder.update({ where: { id: order.id }, data: { status: 'paid', paidAt: order.paidAt ?? new Date(), paymentId: 'free_account' } });
    return res.json({ free: true, paymentUrl: returnUrl });
  }
  if (!kassaAuth().configured) return res.status(503).json({ error: 'Оплата временно недоступна. Макет сохранён — попробуйте позже.' });
  try {
    if (order.paymentId) {
      const previous = await kassaRequest('GET', `/payments/${order.paymentId}`);
      if (await confirmPrintPayment(previous)) return res.json({ paymentUrl: returnUrl });
      if (previous.status === 'pending' && previous.confirmation?.confirmation_url) return res.json({ paymentUrl: previous.confirmation.confirmation_url });
      if (previous.status !== 'canceled') return res.status(409).json({ error: 'Платёж обрабатывается. Проверьте статус через минуту.' });
      const oldKey = order.paymentKey;
      await prisma.printOrder.updateMany({ where: { id: order.id, paymentKey: oldKey, status: { not: 'paid' } }, data: { paymentId: '', paymentKey: crypto.randomUUID() } });
      order = (await prisma.printOrder.findUnique({ where: { id: order.id } }))!;
      if (order.status === 'paid') return res.json({ paymentUrl: returnUrl });
    }
    const amount = { value: PRINT_PRICE.toFixed(2), currency: 'RUB' };
    const description = `Печатное приглашение WeddingCraft — ${PRINT_TEMPLATES.find(t => t.id === order!.templateId)!.name}`;
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    const payment = await kassaRequest('POST', '/payments', {
      amount, capture: true, description,
      confirmation: { type: 'redirect', return_url: returnUrl },
      metadata: { product: 'print', printOrderId: order.id, paymentKey: order.paymentKey },
      ...(process.env.YOOKASSA_RECEIPT === 'true' ? { receipt: { customer: { email: user!.email }, items: [{ description, quantity: '1.00', amount, vat_code: 1, payment_subject: 'service', payment_mode: 'full_payment' }] } } : {}),
    }, order.paymentKey);
    await prisma.printOrder.updateMany({ where: { id: order.id, paymentKey: order.paymentKey }, data: { paymentId: payment.id } });
    if (!payment.confirmation?.confirmation_url) throw new Error('No confirmation URL');
    res.json({ paymentUrl: payment.confirmation.confirmation_url });
  } catch { res.status(502).json({ error: 'Не удалось связаться с оплатой. Попробуйте ещё раз — повторный запрос не создаст второй платёж.' }); }
});
router.get('/orders/:id/pdf', async (req: AuthRequest, res) => {
  const order = await prisma.printOrder.findFirst({ where: { id: String(req.params.id), userId: req.userId } });
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  if (order.status !== 'paid') return res.status(402).json({ error: 'Скачивание доступно после оплаты' });
  const bleed = req.query.bleed === '1' ? 3 : 0;
  const size = printSize(order.templateId);
  let svg: string;
  try { svg = renderPrintSvg(order.templateId, JSON.parse(order.data), false, false, bleed); }
  catch { return res.status(400).json({ error: 'Не удалось прочитать макет или фотографию. Загрузите фотографию заново.' }); }
  const mm = 72 / 25.4;
  const doc = new PDFDocument({ size: [(size.width + bleed * 2) * mm, (size.height + bleed * 2) * mm], margin: 0, info: { Title: 'WeddingCraft — приглашение A6', Creator: 'WeddingCraft' } });
  doc.registerFont('PrintCyr', printFont());
  doc.registerFont('PrintLatin', printFont(true));
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  doc.on('error', () => { if (!res.headersSent) res.status(500).json({ error: 'Не удалось сформировать PDF' }); });
  doc.on('end', () => {
    if (res.headersSent) return;
    res.type('application/pdf').set('Content-Disposition', `attachment; filename="weddingcraft-${order.templateId}${bleed ? '-bleed' : '-a6'}.pdf"`).send(Buffer.concat(chunks));
  });
  const template = PRINT_TEMPLATES.find(t => t.id === order.templateId)!;
  doc.rect(0, 0, (size.width + bleed * 2) * mm, (size.height + bleed * 2) * mm).fill(template.background);
  SVGtoPDF(doc, svg, 0, 0, { width: (size.width + bleed * 2) * mm, height: (size.height + bleed * 2) * mm, fontCallback: name => name === 'PrintLatin' ? 'PrintLatin' : 'PrintCyr' });
  // Explicit trim/bleed boxes let a print shop crop to A6 without scaling.
  (doc.page.dictionary.data as Record<string, unknown>).TrimBox = [bleed * mm, bleed * mm, (size.width + bleed) * mm, (size.height + bleed) * mm];
  (doc.page.dictionary.data as Record<string, unknown>).BleedBox = [0, 0, (size.width + bleed * 2) * mm, (size.height + bleed * 2) * mm];
  doc.end();
});
export default router;
