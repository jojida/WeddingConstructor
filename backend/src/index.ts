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
import { initTelegram } from './lib/telegram';
import { ensureSchema } from './lib/ensureSchema';
import { jwtSecret } from './lib/security';
import { rateLimit } from './middleware/rateLimit';

const app = express();
jwtSecret(); // Fail closed before accepting requests with an insecure configuration.
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
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
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders(res) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  },
}));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/invites', inviteRouter);
app.use('/api/upload', rateLimit(40, 60 * 60_000), uploadRouter);
app.use('/api/payment', rateLimit(120, 60_000), paymentRouter);
app.use('/api/rsvp', rsvpRouter);
app.use('/api/guests', guestsRouter);
app.use('/api/telegram', telegramRouter);
app.use('/api/domains', domainsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.type === 'entity.too.large' ? 413 : err instanceof SyntaxError ? 400 : 500;
  console.error('API request failed:', err.code || err.name || 'Error');
  res.status(status).json({ error: status === 413 ? 'Слишком большой запрос' : status === 400 ? 'Некорректный JSON' : 'Ошибка сервера' });
});

if (require.main === module) {
  // Недостающие колонки — до первого запроса к ним: деплой миграции не запускает.
  ensureSchema()
    .catch((e) => console.error('Проверка схемы БД не удалась:', e))
    .finally(() => app.listen(PORT, () => {
      console.log(`🚀 Wedding Constructor API running on http://localhost:${PORT}`);
      // Бот сервиса настраивается сам, если задан TELEGRAM_BOT_TOKEN:
      // имя берётся через getMe, вебхук ставится на BACKEND_URL.
      initTelegram();
    }));
}
export default app;
