import { Router, Response } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { isPaid, hasCustomDomain, hasMusic, hasNotifications, planSections } from '../lib/plans';
import { botUsername } from '../lib/telegram';
import { validInviteInput, cleanCustomData, safeAssetUrl, record } from '../lib/inviteValidation';
import { normalizeEmail } from '../lib/security';
import { normalizeDomain, findPublicDomain } from '../lib/domains';
import { rateLimit } from '../middleware/rateLimit';
import { publicMenu } from '../lib/planner/public';
import { publicReminders } from '../lib/reminders';
import { errName } from '../lib/planner/util';
import { RESERVED_SLUGS, SLUG_RE, generateSlug } from '../lib/slug';

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

// Приватные поля приглашения — не отдавать в публичных ответах (by-slug/by-domain).
function stripPrivate(invite: any) {
  const { userId, notifyChannel, notifyEmail, notifyTelegramChatId, telegramConnectToken, paymentId, ...pub } = invite;
  return pub;
}

function publicInvite(invite: any) {
  // Explicit allowlist: new payment, ownership and integration fields stay private.
  const fields = ['id', 'slug', 'templateId', 'status', 'plan', 'groomName', 'brideName',
    'weddingDate', 'weddingTime', 'venue', 'venueAddress', 'story', 'inviteText',
    'dressCode', 'colorScheme'] as const;
  const visible = Object.fromEntries(fields.map(key => [key, invite[key]]));
  return {
    ...visible,
    mapLink: safeAssetUrl(invite.mapLink) ? invite.mapLink : '',
    coverPhoto: safeAssetUrl(invite.coverPhoto) ? invite.coverPhoto : '',
    coverVideo: safeAssetUrl(invite.coverVideo) ? invite.coverVideo : '',
    dressCodePhoto: safeAssetUrl(invite.dressCodePhoto) ? invite.dressCodePhoto : '',
    musicUrl: hasMusic(invite.plan) && safeAssetUrl(invite.musicUrl) ? invite.musicUrl : '',
    galleryPhotos: parseArr(invite.galleryPhotos).filter(safeAssetUrl),
    schedule: parseArr(invite.schedule),
    dressCodeColors: parseArr(invite.dressCodeColors),
    enabledSections: planSections(invite.plan, parseObj(invite.enabledSections)),
    customData: { ...cleanCustomData(parseObj(invite.customData)), plan: invite.plan },
  };
}

/* Анкета гостя узнаёт, спрашивать ли блюдо и пищевые ограничения (wcMenu), из customData —
   как и остальные настройки шаблона. Хранится это не в customData (её целиком перезаписывает
   редактор), а в таблицах планировщика; сюда кладётся только для гостевой страницы. */
async function withPlannerMenu(invite: { id: string; plan: string; userId: string; weddingDate: string }, pub: ReturnType<typeof publicInvite>) {
  // Так же анкета узнаёт, предлагать ли гостю напоминание перед свадьбой (wcRemind)
  const [menu, remind] = await Promise.all([publicMenu(invite), publicReminders(invite)]);
  if (!menu && !remind) return pub;
  return { ...pub, customData: { ...pub.customData, ...(menu ? { wcMenu: menu } : {}), ...(remind ? { wcRemind: remind } : {}) } };
}

// GET /api/invites — список приглашений текущего пользователя
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const invites = await prisma.invitation.findMany({
    where: { userId: req.userId! },
    orderBy: { updatedAt: 'desc' },
    // Cards do not need notification tokens, payment details or the full editor JSON.
    select: { id: true, slug: true, status: true, groomName: true, brideName: true,
      weddingDate: true, templateId: true, plan: true, updatedAt: true, coverPhoto: true, title: true },
  });
  res.json(invites);
});

// POST /api/invites — создать черновик
router.post('/', authMiddleware, rateLimit(20, 60 * 60_000, req => (req as AuthRequest).userId!), async (req: AuthRequest, res: Response) => {
  try {
    if (!validInviteInput(req.body)) return res.status(400).json({ error: 'Некорректные данные приглашения' });
    const { templateId = 'calla' } = req.body;
    const slug = generateSlug('', '');
    const invite = await prisma.invitation.create({
      data: { userId: req.userId!, templateId, slug, plan: 'premium' },
    });
    res.json({ ...invite, galleryPhotos: parseArr(invite.galleryPhotos), schedule: parseArr(invite.schedule),
      dressCodeColors: parseArr(invite.dressCodeColors), enabledSections: parseObj(invite.enabledSections), customData: parseObj(invite.customData) });
  } catch (e) {
    console.error('Invitation creation failed:', errName(e));
    res.status(500).json({ error: 'Ошибка создания приглашения' });
  }
});

// PUT /api/invites/:id — обновить данные
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!validInviteInput(req.body)) return res.status(400).json({ error: 'Некорректные данные приглашения' });
    const { id } = req.params;
    const invite = await prisma.invitation.findUnique({ where: { id: id as string } });
    if (!invite || invite.userId !== req.userId) {
      return res.status(404).json({ error: 'Приглашение не найдено' });
    }

    // Опубликованный сайт тоже правится: опечатку в имени или перенос времени
    // пара должна исправить сама, а не через поддержку. Изменения видны гостям
    // сразу — редактор об этом предупреждает.

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
        customData: customData !== undefined ? JSON.stringify(cleanCustomData(customData)) : undefined,
        colorScheme, musicUrl, templateId, title, slug,
      },
    });
    return res.json(updated);
  } catch (e) {
    console.error('Invitation update failed:', errName(e));
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
  return res.json(await withPlannerMenu(invite, publicInvite(invite)));
});

// GET /api/invites/by-domain/:host — резолв привязанного домена клиента (MVP)
router.get('/by-domain/:host', async (req, res: Response) => {
  const host = normalizeDomain(req.params.host);
  if (!host) return res.status(404).json({ error: 'Не найдено' });
  const invite = await findPublicDomain(host);
  if (!invite) return res.status(404).json({ error: 'Домен не привязан' });
  // Черновики гостям не видны: сайт открывается после оплаты тарифа.
  if (!isPaid(invite.status)) {
    return res.status(402).json({ error: 'Сайт ещё не опубликован', reason: 'unpaid' });
  }
  return res.json(await withPlannerMenu(invite, publicInvite(invite)));
});

// PATCH /api/invites/:id/settings — уведомления и свой домен (владелец)
router.patch('/:id/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!record(req.body)) return res.status(400).json({ error: 'Некорректные настройки' });
  const invite = await prisma.invitation.findUnique({ where: { id: req.params.id as string } });
  if (!invite || invite.userId !== req.userId) return res.status(404).json({ error: 'Не найдено' });

  const data: any = {};
  if (req.body.notifyChannel != null) {
    const ch = String(req.body.notifyChannel);
    if (!['none', 'telegram', 'email'].includes(ch)) return res.status(400).json({ error: 'Неверный канал' });
    if (ch !== 'none' && !hasNotifications(invite.plan)) return res.status(403).json({ error: 'Уведомления доступны в «Премиум» и «Максимум»' });
    data.notifyChannel = ch;
  }
  if (req.body.notifyEmail != null) {
    if (req.body.notifyEmail !== '' && !normalizeEmail(req.body.notifyEmail)) return res.status(400).json({ error: 'Некорректный email' });
    data.notifyEmail = normalizeEmail(req.body.notifyEmail) || '';
  }
  if (req.body.customDomain != null) {
    const domain = normalizeDomain(req.body.customDomain);
    if (domain === null) return res.status(400).json({ error: 'Неверный формат домена (пример: denis-i-maria.ru)' });
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
      const taken = await prisma.invitation.findFirst({ where: { customDomain: domain, customDomainVerifiedAt: { not: null } } });
      if (taken && taken.id !== invite.id) {
        return res.status(409).json({ error: 'Этот домен уже привязан к другому сайту' });
      }
    }
    data.customDomain = domain; // пустая строка = отвязать
    if (domain !== invite.customDomain) data.customDomainVerifiedAt = null;
  }
  try {
    const updated = await prisma.invitation.update({ where: { id: invite.id }, data });
    return res.json(stripPrivate(updated));
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return res.status(409).json({ error: 'Этот домен уже привязан к другому сайту' });
    throw error;
  }
});

// PATCH /api/invites/:id/slug — задать «красивый» адрес сайта (weddingcraft.ru/<slug>)
router.patch('/:id/slug', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!record(req.body) || typeof req.body.slug !== 'string') return res.status(400).json({ error: 'Укажите адрес сайта' });
  const invite = await prisma.invitation.findUnique({ where: { id: req.params.id as string } });
  if (!invite || invite.userId !== req.userId) return res.status(404).json({ error: 'Не найдено' });

  const raw = String(req.body.slug || '').trim().toLowerCase();
  if (!SLUG_RE.test(raw)) {
    return res.status(400).json({ error: 'Адрес: 3–40 символов, латиница, цифры и дефис (не с дефиса)' });
  }
  if (RESERVED_SLUGS.has(raw)) return res.status(400).json({ error: 'Этот адрес зарезервирован, выберите другой' });

  const taken = await prisma.invitation.findUnique({ where: { slug: raw } });
  if (taken && taken.id !== invite.id) return res.status(409).json({ error: 'Этот адрес уже занят' });

  try {
    const updated = await prisma.invitation.update({ where: { id: invite.id }, data: { slug: raw } });
    return res.json({ slug: updated.slug });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return res.status(409).json({ error: 'Этот адрес уже занят' });
    throw error;
  }
});

// POST /api/invites/:id/telegram-connect — выдать deep-link для подключения Telegram
router.post('/:id/telegram-connect', authMiddleware, rateLimit(20, 10 * 60_000, req => (req as AuthRequest).userId!), async (req: AuthRequest, res: Response) => {
  const invite = await prisma.invitation.findUnique({ where: { id: req.params.id as string } });
  if (!invite || invite.userId !== req.userId) return res.status(404).json({ error: 'Не найдено' });

  if (!hasNotifications(invite.plan)) return res.status(403).json({ error: 'Telegram доступен в «Премиум» и «Максимум»' });

  let token = invite.telegramConnectToken;
  if (!token || !invite.telegramConnectExpiresAt || invite.telegramConnectExpiresAt.getTime() <= Date.now()) {
    token = crypto.randomBytes(24).toString('base64url');
    await prisma.invitation.update({ where: { id: invite.id }, data: { telegramConnectToken: token, telegramConnectExpiresAt: new Date(Date.now() + 15 * 60_000) } });
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
  await prisma.$transaction(async tx => {
    await tx.guestResponse.deleteMany({ where: { invitationId: invite.id } });
    await tx.guest.deleteMany({ where: { invitationId: invite.id } });
    await tx.invitation.delete({ where: { id: invite.id } });
  });
  return res.json({ success: true });
});

export default router;
