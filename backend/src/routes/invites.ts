import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Приватные поля приглашения — не отдавать в публичных ответах (by-slug/by-domain).
function stripPrivate(invite: any) {
  const { notifyChannel, notifyEmail, notifyTelegramChatId, telegramConnectToken, paymentId, ...pub } = invite;
  return pub;
}

function publicInvite(invite: any) {
  return {
    ...stripPrivate(invite),
    galleryPhotos: JSON.parse(invite.galleryPhotos || '[]'),
    schedule: JSON.parse(invite.schedule || '[]'),
    dressCodeColors: JSON.parse(invite.dressCodeColors || '[]'),
    enabledSections: JSON.parse(invite.enabledSections || '{}'),
    customData: JSON.parse(invite.customData || '{}'),
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
    const { templateId = 'classic' } = req.body;
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

    const {
      groomName, brideName, weddingDate, weddingTime, venue, venueAddress,
      mapLink, story, inviteText, dressCode, dressCodeColors, dressCodePhoto, schedule, coverPhoto, coverVideo, galleryPhotos, colorScheme,
      musicUrl, templateId, title, enabledSections, customData,
    } = req.body;

    // Re-generate slug if names changed
    let slug = invite.slug;
    if ((groomName && groomName !== invite.groomName) || (brideName && brideName !== invite.brideName)) {
      slug = generateSlug(groomName || '', brideName || '');
    }

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
  if (invite.status === 'draft') return res.status(403).json({ error: 'Приглашение ещё не оплачено' });
  return res.json(publicInvite(invite));
});

// GET /api/invites/by-domain/:host — резолв привязанного домена клиента (MVP)
router.get('/by-domain/:host', async (req, res: Response) => {
  const host = String(req.params.host || '').toLowerCase().replace(/^www\./, '');
  if (!host) return res.status(404).json({ error: 'Не найдено' });
  const invite = await prisma.invitation.findFirst({ where: { customDomain: host } });
  if (!invite) return res.status(404).json({ error: 'Домен не привязан' });
  if (invite.status === 'draft') return res.status(403).json({ error: 'Приглашение ещё не оплачено' });
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
    data.customDomain = String(req.body.customDomain).trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  }
  const updated = await prisma.invitation.update({ where: { id: invite.id }, data });
  return res.json(stripPrivate(updated));
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
  const username = process.env.TELEGRAM_BOT_USERNAME || '';
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
    galleryPhotos: JSON.parse(invite.galleryPhotos || '[]'),
    schedule: JSON.parse((invite as any).schedule || '[]'),
    dressCodeColors: JSON.parse((invite as any).dressCodeColors || '[]'),
    enabledSections: JSON.parse((invite as any).enabledSections || '{}'),
    customData: JSON.parse((invite as any).customData || '{}'),
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
