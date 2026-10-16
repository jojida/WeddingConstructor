// Отзывы пар (lib/reviews.ts): публичный список для главной и отзыв своего сайта в кабинете.
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { ReviewError, canReview, coupleNames, ownView, publicReviews, saveReview } from '../lib/reviews';
import { errName } from '../lib/planner/util';

const router = Router();

// GET /api/reviews/public — одобренные отзывы для главной. Сбой — пустой список: секция просто скрыта
router.get('/public', async (_req: Request, res: Response) => {
  try {
    res.json({ reviews: await publicReviews() });
  } catch (e) {
    console.error('Отзывы: список не загрузился:', errName(e));
    res.json({ reviews: [] });
  }
});

async function ownInvite(req: AuthRequest) {
  const invite = await prisma.invitation.findUnique({ where: { id: String(req.params.inviteId) } });
  return invite && invite.userId === req.userId ? invite : null;
}

// GET /api/reviews/invite/:inviteId — отзыв пары о своём сайте (или null) и можно ли его оставить
router.get('/invite/:inviteId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const invite = await ownInvite(req);
    if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });
    const review = await prisma.review.findUnique({ where: { invitationId: invite.id } });
    return res.json({ review: ownView(review), canReview: canReview(invite.status), names: coupleNames(invite) });
  } catch (e) {
    console.error('Отзывы: ошибка чтения:', errName(e));
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/reviews/invite/:inviteId — оставить или изменить отзыв
router.put('/invite/:inviteId', authMiddleware, rateLimit(20, 60 * 60_000), async (req: AuthRequest, res: Response) => {
  try {
    const invite = await ownInvite(req);
    if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    return res.json({ review: ownView(await saveReview(invite, body)) });
  } catch (e) {
    if (e instanceof ReviewError) return res.status(e.status).json({ error: e.message });
    console.error('Отзывы: ошибка сохранения:', errName(e));
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
