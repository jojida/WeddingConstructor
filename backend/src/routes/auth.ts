import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const router = Router();

import nodemailer from 'nodemailer';

// Настройка почты (если данные пустые, письма не отправятся, но код будет в консоли)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.yandex.ru',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

// POST /api/auth/send-code
router.post('/send-code', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Укажите email' });

    // Генерируем 6-значный код
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут

    // Сохраняем код в БД
    await prisma.verificationCode.upsert({
      where: { email },
      update: { code, expiresAt },
      create: { email, code, expiresAt },
    });

    // Всегда выводим код в консоль для разработки и тестов
    console.log(`\n🔑 [AUTH CODE] Код для входа ${email}: ${code}\n`);

    // Пытаемся отправить письмо, если настроен SMTP
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await transporter.sendMail({
        from: `"WeddingCraft" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Код для входа',
        text: `Ваш код подтверждения: ${code}\nОн действителен 10 минут.`,
      });
    }

    return res.json({ success: true, message: 'Код отправлен' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Ошибка отправки кода' });
  }
});

// POST /api/auth/verify-code
router.post('/verify-code', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Укажите email и код' });

    const verification = await prisma.verificationCode.findUnique({ where: { email } });
    
    if (!verification || verification.code !== code) {
      return res.status(401).json({ error: 'Неверный код' });
    }
    if (verification.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Срок действия кода истек' });
    }

    // Удаляем использованный код
    await prisma.verificationCode.delete({ where: { email } });

    // Ищем или создаем пользователя
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { 
          email,
          name: email.split('@')[0], // Имя по умолчанию
        },
      });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });

    return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Не авторизован' });

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string };

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    return res.json({ id: user.id, email: user.email, name: user.name });
  } catch {
    return res.status(401).json({ error: 'Неверный токен' });
  }
});

export default router;
