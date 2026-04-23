import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

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
    const invite = await prisma.invitation.findUnique({ where: { id } });
    if (!invite || invite.userId !== req.userId) {
      return res.status(404).json({ error: 'Приглашение не найдено' });
    }

    const {
      groomName, brideName, weddingDate, weddingTime, venue, venueAddress,
      mapLink, story, inviteText, dressCode, schedule, coverPhoto, galleryPhotos, colorScheme,
      musicUrl, templateId, title,
    } = req.body;

    // Re-generate slug if names changed
    let slug = invite.slug;
    if ((groomName && groomName !== invite.groomName) || (brideName && brideName !== invite.brideName)) {
      slug = generateSlug(groomName || '', brideName || '');
    }

    const updated = await prisma.invitation.update({
      where: { id },
      data: {
        groomName, brideName, weddingDate, weddingTime, venue, venueAddress,
        mapLink, story, inviteText, dressCode, coverPhoto,
        schedule: schedule ? JSON.stringify(schedule) : undefined,
        galleryPhotos: galleryPhotos ? JSON.stringify(galleryPhotos) : undefined,
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
router.get('/by-slug/:slug', async (req, res: Response) => {
  const invite = await prisma.invitation.findUnique({ where: { slug: req.params.slug } });
  if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });
  if (invite.status === 'draft') return res.status(403).json({ error: 'Приглашение ещё не оплачено' });

  const data = {
    ...invite,
    galleryPhotos: JSON.parse(invite.galleryPhotos || '[]'),
    schedule: JSON.parse((invite as any).schedule || '[]'),
  };
  return res.json(data);
});

// GET /api/invites/:id — получить черновик (авторизованно)
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const invite = await prisma.invitation.findUnique({ where: { id: req.params.id } });
  if (!invite || invite.userId !== req.userId) {
    return res.status(404).json({ error: 'Приглашение не найдено' });
  }
  return res.json({ ...invite, galleryPhotos: JSON.parse(invite.galleryPhotos || '[]') });
});

// DELETE /api/invites/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const invite = await prisma.invitation.findUnique({ where: { id: req.params.id } });
  if (!invite || invite.userId !== req.userId) {
    return res.status(404).json({ error: 'Приглашение не найдено' });
  }
  await prisma.invitation.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

export default router;
