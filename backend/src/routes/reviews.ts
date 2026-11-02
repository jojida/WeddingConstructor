// Отзывы пар (lib/reviews.ts): публичный список для главной, отзыв своего сайта в кабинете
// и по ссылке из письма «Как вам WeddingCraft?» — без входа, по подписи в ссылке.
import { Router, Request, Response } from 'express';
import type { Invitation } from '@prisma/client';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { ReviewError, canReview, checkReviewLinkToken, coupleNames, ownView, publicReviews, saveReview } from '../lib/reviews';
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

async function linkedInvite(req: Request) {
  const invite = await prisma.invitation.findUnique({ where: { id: String(req.params.inviteId) } });
  return invite && checkReviewLinkToken(invite, req.query.t) ? invite : null;
}

/** Отзыв пары о своём сайте (или null) и можно ли его оставить — одинаково для кабинета и ссылки. */
async function readReview(find: () => Promise<Invitation | null>, res: Response, missing: string) {
  try {
    const invite = await find();
    if (!invite) return res.status(404).json({ error: missing });
    const review = await prisma.review.findUnique({ where: { invitationId: invite.id } });
    return res.json({ review: ownView(review), canReview: canReview(invite.status), names: coupleNames(invite) });
  } catch (e) {
    console.error('Отзывы: ошибка чтения:', errName(e));
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}

async function writeReview(find: () => Promise<Invitation | null>, req: Request, res: Response, missing: string) {
  try {
    const invite = await find();
    if (!invite) return res.status(404).json({ error: missing });
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    return res.json({ review: ownView(await saveReview(invite, body)) });
  } catch (e) {
    if (e instanceof ReviewError) return res.status(e.status).json({ error: e.message });
    console.error('Отзывы: ошибка сохранения:', errName(e));
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}

const NOT_FOUND = 'Приглашение не найдено';
const STALE_LINK = 'Ссылка устарела — оставьте отзыв в личном кабинете';

// GET/PUT /api/reviews/invite/:inviteId — в кабинете
router.get('/invite/:inviteId', authMiddleware, (req: AuthRequest, res: Response) =>
  readReview(() => ownInvite(req), res, NOT_FOUND));
router.put('/invite/:inviteId', authMiddleware, rateLimit(20, 60 * 60_000), (req: AuthRequest, res: Response) =>
  writeReview(() => ownInvite(req), req, res, NOT_FOUND));

// GET/PUT /api/reviews/link/:inviteId?t=… — по ссылке из письма, без входа
router.get('/link/:inviteId', rateLimit(60, 60 * 60_000), (req: Request, res: Response) =>
  readReview(() => linkedInvite(req), res, STALE_LINK));
router.put('/link/:inviteId', rateLimit(20, 60 * 60_000), (req: Request, res: Response) =>
  writeReview(() => linkedInvite(req), req, res, STALE_LINK));

export default router;
