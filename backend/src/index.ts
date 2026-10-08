import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import { findPublicDomain } from './lib/domains';
import prisma from './lib/prisma';
import { uploadsDir } from './lib/storage';
import authRouter from './routes/auth';
import inviteRouter from './routes/invites';
import uploadRouter from './routes/upload';
import paymentRouter from './routes/payment';
import printRouter from './routes/print';
import rsvpRouter from './routes/rsvp';
import guestsRouter from './routes/guests';
import plannerRouter from './routes/planner';
import telegramRouter from './routes/telegram';
import domainsRouter from './routes/domains';
import emailRouter from './routes/email';
import { initTelegram } from './lib/telegram';
import { ensureSchema } from './lib/ensureSchema';
import { startLifecycleEmails } from './lib/lifecycleEmails';
import { jwtSecret } from './lib/security';
import { rateLimit } from './middleware/rateLimit';

const app = express();
jwtSecret(); // Fail closed before accepting requests with an insecure configuration.
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
const PORT = process.env.PORT || 4000;

// Middleware
// CORS: разрешаем основной домен, www-вариант и localhost (для разработки).
// Один жёсткий origin ломал вход при заходе на www.weddingcraft.ru.
const allowedOrigins = new Set([
  process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://weddingcraft.ru' : 'http://localhost:3000'),
  'https://weddingcraft.ru',
  'https://www.weddingcraft.ru',
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000']),
]);
app.use(cors({
  async origin(origin, cb) {
    // Запросы без Origin (curl, серверные) и из белого списка — разрешаем
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    // Привязанные клиентские домены: сайт-приглашение на своём домене шлёт
    // RSVP/guest-запросы на api.weddingcraft.ru — это cross-origin. Разрешаем
    // origin, если его хост привязан к какому-либо приглашению (customDomain).
    try {
      const url = new URL(origin);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (host && url.origin === origin && url.protocol === 'https:' && !url.port) {
        const bound = await findPublicDomain(host);
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
app.use('/uploads', (req, res, next) => {
  // A misplaced database, backup or active document must never become public.
  if (!/^\/[a-z0-9][a-z0-9_-]*\.(?:jpg|png|gif|webp|mp3|m4a|ogg|wav|aac|webm)$/i.test(req.path)) {
    res.sendStatus(404);
    return;
  }
  next();
}, express.static(uploadsDir, {
  dotfiles: 'deny',
  index: false,
  setHeaders(res, filePath) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    // Each upload receives a fresh UUID; legacy filenames remain revalidated.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|gif|webp|mp3|m4a|ogg|wav|aac|webm)$/i.test(path.basename(filePath))) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/invites', inviteRouter);
app.use('/api/upload', rateLimit(40, 60 * 60_000), uploadRouter);
app.use('/api/payment', rateLimit(120, 60_000), paymentRouter);
app.use('/api/print', rateLimit(120, 60_000), printRouter);
app.use('/api/rsvp', rsvpRouter);
app.use('/api/guests', guestsRouter);
app.use('/api/planner', rateLimit(900, 60_000), plannerRouter);
app.use('/api/telegram', telegramRouter);
app.use('/api/domains', domainsRouter);
app.use('/api/email', rateLimit(30, 60_000), emailRouter);

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
    .then(() => app.listen(PORT, () => {
      console.log(`🚀 Wedding Constructor API running on http://localhost:${PORT}`);
      // Бот сервиса настраивается сам, если задан TELEGRAM_BOT_TOKEN:
      // имя берётся через getMe, вебхук ставится на BACKEND_URL.
      initTelegram();
      // Серия писем после регистрации (напоминания и подсказки) — только на проде.
      startLifecycleEmails();
    }))
    .catch(async () => {
      console.error('Проверка схемы БД не удалась. API не запущен.');
      process.exitCode = 1;
      await prisma.$disconnect();
    });
}
export default app;
