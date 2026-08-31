import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { isPaid, hasCustomDomain } from '../lib/plans';
import { botUsername } from '../lib/telegram';

const router = Router();

// Безопасный разбор JSON-колонок. Гарантирует ожидаемый тип (массив/объект),
// даже если в БД лежит битый JSON или значение не того типа — иначе фронтенд
// падает на `.map` (schedule/dressCodeColors/galleryPhotos не массив).
const parseArr = (s: any): any[] => {
  try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};
const parseObj = (s: any): Record<string, any> => {
  try { const v = JSON.parse(s || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
};

// Слова, которые нельзя использовать как slug, чтобы не конфликтовать
// с маршрутами фронтенда (weddingcraft.ru/<slug>).
const RESERVED_SLUGS = new Set([
  'api', 'auth', 'by-domain', 'dashboard', 'demo', 'editor', 'invite', 'payment',
  'templates', 'admin', 'login', 'register', 'signup', 'about', 'pricing', 'help',
  'static', 'assets', '_next', 'favicon', 'robots', 'sitemap', 'www', 'public', 'uploads',
]);

// Приватные поля приглашения — не отдавать в публичных ответах (by-slug/by-domain).
function stripPrivate(invite: any) {
  const { notifyChannel, notifyEmail, notifyTelegramChatId, telegramConnectToken, paymentId, ...pub } = invite;
  return pub;
}

function publicInvite(invite: any) {
  return {
    ...stripPrivate(invite),
    galleryPhotos: parseArr(invite.galleryPhotos),
    schedule: parseArr(invite.schedule),
    dressCodeColors: parseArr(invite.dressCodeColors),
    enabledSections: parseObj(invite.enabledSections),
    customData: parseObj(invite.customData),
  };
}

function generateSlug(groomName: string, brideName: string): string {
  const clean = (s: string) =>
    s.toLowerCase()
      .replace(/[аА]/g, 'a').replace(/[бБ]/g, 'b').replace(/[вВ]/g, 'v')
      .replace(/[гГ]/g, 'g').replace(/[дД]/g, 'd').replace(/[еЕёЁ]/g, 'e')
      .replace(/[жЖ]/g, 'zh').replace(/[зЗ]/g, 'z').replace(/[иИ]/g, 'i')
      .replace(/[йЙ]/g, 'j').replace(/[кК]/g, 'k').replace(/[лЛ]/g, 'l')
      .replace(/[мМ]/g, 'm').replace(/[нН]/g, 'n').replace(/[оО]/g, 'o')
      .replace(/[пП]/g, 'p').replace(/[рР]/g, 'r').replace(/[сС]/g, 's')
      .replace(/[тТ]/g, 't').replace(/[уУ]/g, 'u').replace(/[фФ]/g, 'f')
      .replace(/[хХ]/g, 'h').replace(/[цЦ]/g, 'ts').replace(/[чЧ]/g, 'ch')
      .replace(/[шШ]/g, 'sh').replace(/[щЩ]/g, 'sch').replace(/[ъЪьЬ]/g, '')
      .replace(/[ыЫ]/g, 'y').replace(/[эЭ]/g, 'eh').replace(/[юЮ]/g, 'yu')
      .replace(/[яЯ]/g, 'ya').replace(/[^a-z0-9]/g, '');
  const g = clean(groomName) || 'groom';
  const b = clean(brideName) || 'bride';
  return `${g}-i-${b}-${uuidv4().slice(0, 6)}`;
}

// GET /api/invites — список приглашений текущего пользователя
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const invites = await prisma.invitation.findMany({
    where: { userId: req.userId! },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(invites);
});

// POST /api/invites — создать черновик
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { templateId = 'calla' } = req.body;
    const slug = generateSlug('', '');
    const invite = await prisma.invitation.create({
      data: { userId: req.userId!, templateId, slug },
    });
    res.json(invite);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка создания приглашения' });
  }
});

// PUT /api/invites/:id — обновить данные
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const invite = await prisma.invitation.findUnique({ where: { id: id as string } });
    if (!invite || invite.userId !== req.userId) {
      return res.status(404).json({ error: 'Приглашение не найдено' });
    }

    // Оплата — за готовый сайт: после публикации контент фиксируется.
    // Настройки уведомлений, слаг и домен меняются отдельными PATCH-роутами.
    if (invite.status === 'paid' || invite.status === 'published') {
      return res.status(403).json({ error: 'Сайт опубликован — редактирование недоступно' });
    }

    const {
      groomName, brideName, weddingDate, weddingTime, venue, venueAddress,
      mapLink, story, inviteText, dressCode, dressCodeColors, dressCodePhoto, schedule, coverPhoto, coverVideo, galleryPhotos, colorScheme,
      musicUrl, templateId, title, enabledSections, customData,
    } = req.body;

    // Slug стабилен: задаётся один раз при создании, далее меняется только
    // вручную через PATCH /:id/slug. Обновление данных адрес сайта НЕ меняет.
    const slug = invite.slug;

    const updated = await prisma.invitation.update({
      where: { id: id as string },
      data: {
        groomName, brideName, weddingDate, weddingTime, venue, venueAddress,
        mapLink, story, inviteText, dressCode, dressCodePhoto,
        dressCodeColors: dressCodeColors ? JSON.stringify(dressCodeColors) : undefined,
        coverPhoto, coverVideo,
        schedule: schedule ? JSON.stringify(schedule) : undefined,
        galleryPhotos: galleryPhotos ? JSON.stringify(galleryPhotos) : undefined,
        enabledSections: enabledSections ? JSON.stringify(enabledSections) : undefined,
        customData: customData !== undefined ? JSON.stringify(customData) : undefined,
        colorScheme, musicUrl, templateId, title, slug,
      },
    });
    return res.json(updated);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Ошибка обновления' });
  }
});


// GET /api/invites/by-slug/:slug — получить для отображения (публично после оплаты)
// ВАЖНО: должен быть объявлен ДО /:id, иначе Express будет матчить "by-slug" как id
router.get('/by-slug/:slug', async (req, res: Response) => {
  const invite = await prisma.invitation.findUnique({ where: { slug: req.params.slug } });
  if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });
  // Черновики гостям не видны: сайт открывается после оплаты тарифа.
  if (!isPaid(invite.status)) {
    return res.status(402).json({ error: 'Сайт ещё не опубликован', reason: 'unpaid' });
  }
  return res.json(publicInvite(invite));
});

// GET /api/invites/by-domain/:host — резолв привязанного домена клиента (MVP)
router.get('/by-domain/:host', async (req, res: Response) => {
  const host = String(req.params.host || '').toLowerCase().replace(/^www\./, '');
  if (!host) return res.status(404).json({ error: 'Не найдено' });
  const invite = await prisma.invitation.findFirst({ where: { customDomain: host } });
  if (!invite) return res.status(404).json({ error: 'Домен не привязан' });
  // Черновики гостям не видны: сайт открывается после оплаты тарифа.
  if (!isPaid(invite.status)) {
    return res.status(402).json({ error: 'Сайт ещё не опубликован', reason: 'unpaid' });
  }
  return res.json(publicInvite(invite));
});

// PATCH /api/invites/:id/settings — уведомления и свой домен (владелец)
router.patch('/:id/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  const invite = await prisma.invitation.findUnique({ where: { id: req.params.id as string } });
  if (!invite || invite.userId !== req.userId) return res.status(404).json({ error: 'Не найдено' });

  const data: any = {};
  if (req.body.notifyChannel != null) {
    const ch = String(req.body.notifyChannel);
    if (!['none', 'telegram', 'email'].includes(ch)) return res.status(400).json({ error: 'Неверный канал' });
    data.notifyChannel = ch;
  }
  if (req.body.notifyEmail != null) data.notifyEmail = String(req.body.notifyEmail).trim();
  if (req.body.customDomain != null) {
    const domain = String(req.body.customDomain).trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '').replace(/^www\./, '');
    if (domain) {
      // Свой домен — фича тарифа «Премиум»; гейтим и на бэке, а не только в UI.
      if (!hasCustomDomain(invite.plan)) {
        return res.status(403).json({ error: 'Свой домен доступен на тарифе «Премиум»' });
      }
      if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain) || domain.length > 253) {
        return res.status(400).json({ error: 'Неверный формат домена (пример: denis-i-maria.ru)' });
      }
      if (domain === 'weddingcraft.ru' || domain.endsWith('.weddingcraft.ru')) {
        return res.status(400).json({ error: 'Этот домен нельзя привязать' });
      }
      const taken = await prisma.invitation.findFirst({ where: { customDomain: domain } });
      if (taken && taken.id !== invite.id) {
        return res.status(409).json({ error: 'Этот домен уже привязан к другому сайту' });
      }
    }
    data.customDomain = domain; // пустая строка = отвязать
  }
  const updated = await prisma.invitation.update({ where: { id: invite.id }, data });
  return res.json(stripPrivate(updated));
});

// PATCH /api/invites/:id/slug — задать «красивый» адрес сайта (weddingcraft.ru/<slug>)
router.patch('/:id/slug', authMiddleware, async (req: AuthRequest, res: Response) => {
  const invite = await prisma.invitation.findUnique({ where: { id: req.params.id as string } });
  if (!invite || invite.userId !== req.userId) return res.status(404).json({ error: 'Не найдено' });

  const raw = String(req.body.slug || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(raw)) {
    return res.status(400).json({ error: 'Адрес: 3–40 символов, латиница, цифры и дефис (не с дефиса)' });
  }
  if (RESERVED_SLUGS.has(raw)) return res.status(400).json({ error: 'Этот адрес зарезервирован, выберите другой' });

  const taken = await prisma.invitation.findUnique({ where: { slug: raw } });
  if (taken && taken.id !== invite.id) return res.status(409).json({ error: 'Этот адрес уже занят' });

  const updated = await prisma.invitation.update({ where: { id: invite.id }, data: { slug: raw } });
  return res.json({ slug: updated.slug });
});

// POST /api/invites/:id/telegram-connect — выдать deep-link для подключения Telegram
router.post('/:id/telegram-connect', authMiddleware, async (req: AuthRequest, res: Response) => {
  const invite = await prisma.invitation.findUnique({ where: { id: req.params.id as string } });
  if (!invite || invite.userId !== req.userId) return res.status(404).json({ error: 'Не найдено' });

  let token = invite.telegramConnectToken;
  if (!token) {
    token = crypto.randomBytes(8).toString('base64url');
    await prisma.invitation.update({ where: { id: invite.id }, data: { telegramConnectToken: token } });
  }
  const username = botUsername();
  return res.json({
    token,
    botUsername: username,
    deepLink: username ? `https://t.me/${username}?start=${token}` : '',
    connected: !!invite.notifyTelegramChatId,
  });
});

// GET /api/invites/:id — получить черновик (авторизованно)
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const invite = await prisma.invitation.findUnique({ where: { id: req.params.id as string } });
  if (!invite || invite.userId !== req.userId) {
    return res.status(404).json({ error: 'Приглашение не найдено' });
  }
  return res.json({
    ...invite,
    galleryPhotos: parseArr(invite.galleryPhotos),
    schedule: parseArr((invite as any).schedule),
    dressCodeColors: parseArr((invite as any).dressCodeColors),
    enabledSections: parseObj((invite as any).enabledSections),
    customData: parseObj((invite as any).customData),
  });
});

// DELETE /api/invites/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const invite = await prisma.invitation.findUnique({ where: { id: req.params.id as string } });
  if (!invite || invite.userId !== req.userId) {
    return res.status(404).json({ error: 'Приглашение не найдено' });
  }
  await prisma.invitation.delete({ where: { id: req.params.id as string } });
  return res.json({ success: true });
});

export default router;
