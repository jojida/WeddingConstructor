import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { sendEmail, isEmailConfigured } from '../lib/email';
import { hashCode, jwtSecret, normalizeEmail } from '../lib/security';
import { rateLimit } from '../middleware/rateLimit';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { isFreeAccount } from '../lib/freeAccounts';

const router = Router();
const emailKey = (req: AuthRequest) => normalizeEmail(req.body?.email) || 'invalid';

router.post('/send-code', rateLimit(10, 15 * 60_000), rateLimit(3, 10 * 60_000, emailKey), async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'Укажите корректный email' });
  const dev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  if (!isEmailConfigured() && !dev) return res.status(503).json({ error: 'Отправка писем временно недоступна' });
  const code = crypto.randomInt(100000, 1000000).toString();
  const hashed = hashCode(email, code);
  try {
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await prisma.verificationCode.upsert({
      where: { email }, update: { code: hashed, expiresAt }, create: { email, code: hashed, expiresAt },
    });
    if (isEmailConfigured()) {
      await sendEmail({ to: email, subject: 'Код для входа — WeddingCraft',
        text: `Ваш код подтверждения: ${code}\nОн действителен 10 минут.` });
    } else if (dev) {
      console.log(`[DEV AUTH CODE] ${email}: ${code}`);
    }
    return res.json({ success: true, message: 'Код отправлен' });
  } catch {
    await prisma.verificationCode.deleteMany({ where: { email, code: hashed } }).catch(() => {});
    return res.status(503).json({ error: 'Не удалось отправить код. Попробуйте позже' });
  }
});

router.post('/verify-code', rateLimit(30, 10 * 60_000), rateLimit(5, 10 * 60_000, emailKey), async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = req.body?.code;
  if (!email || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Укажите email и шестизначный код' });
  }
  try {
    // Atomic consumption prevents concurrent reuse of the same code.
    const consumed = await prisma.verificationCode.deleteMany({
      where: { email, code: hashCode(email, code), expiresAt: { gt: new Date() } },
    });
    if (!consumed.count) return res.status(401).json({ error: 'Неверный код или срок его действия истёк' });
    const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email, name: email.split('@')[0] } });
    const token = jwt.sign({ userId: user.id }, jwtSecret(), { algorithm: 'HS256', expiresIn: '30d' });
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name, free: isFreeAccount(user.email) } });
  } catch {
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
  return res.json({ id: user.id, email: user.email, name: user.name, free: isFreeAccount(user.email) });
});
export default router;
