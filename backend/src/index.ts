import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import prisma from './lib/prisma';
import authRouter from './routes/auth';
import inviteRouter from './routes/invites';
import uploadRouter from './routes/upload';
import paymentRouter from './routes/payment';
import rsvpRouter from './routes/rsvp';
import guestsRouter from './routes/guests';
import telegramRouter from './routes/telegram';
import domainsRouter from './routes/domains';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
// CORS: разрешаем основной домен, www-вариант и localhost (для разработки).
// Один жёсткий origin ломал вход при заходе на www.weddingcraft.ru.
const allowedOrigins = new Set([
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://weddingcraft.ru',
  'https://www.weddingcraft.ru',
  'http://localhost:3000',
]);
app.use(cors({
  async origin(origin, cb) {
    // Запросы без Origin (curl, серверные) и из белого списка — разрешаем
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    // Привязанные клиентские домены: сайт-приглашение на своём домене шлёт
    // RSVP/guest-запросы на api.weddingcraft.ru — это cross-origin. Разрешаем
    // origin, если его хост привязан к какому-либо приглашению (customDomain).
    try {
      const host = new URL(origin).hostname.replace(/^www\./, '').toLowerCase();
      if (host) {
        const bound = await prisma.invitation.findFirst({ where: { customDomain: host }, select: { id: true } });
        if (bound) return cb(null, true);
      }
    } catch { /* кривой Origin — просто не разрешаем */ }
    return cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/invites', inviteRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/rsvp', rsvpRouter);
app.use('/api/guests', guestsRouter);
app.use('/api/telegram', telegramRouter);
app.use('/api/domains', domainsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Wedding Constructor API running on http://localhost:${PORT}`);
});
