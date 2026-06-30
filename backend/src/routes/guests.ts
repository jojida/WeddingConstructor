import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { isAdvanced, isSalutation, computeGreeting } from '../lib/plans';

const router = Router();

function genToken(): string {
  // короткий URL-безопасный токен для персональной ссылки ?g=
  return crypto.randomBytes(6).toString('base64url');
}

async function loadOwnedInvite(inviteId: string, userId?: string) {
  const invite = await prisma.invitation.findUnique({ where: { id: inviteId } });
  if (!invite || invite.userId !== userId) return null;
  return invite;
}

// ── Публичный резолв персональной ссылки (для страницы приглашения) ──────────
// ВАЖНО: объявлен до /:inviteId, отдаёт только обращение/имя/статус — без утечки.
router.get('/resolve/:token', async (req: Request, res: Response) => {
  const guest = await prisma.guest.findUnique({ where: { token: req.params.token } });
  if (!guest) return res.status(404).json({ error: 'Гость не найден' });
  let attending: boolean | null = null;
  if (guest.responseId) {
    const r = await prisma.guestResponse.findUnique({ where: { id: guest.responseId } });
    if (r) attending = r.attending;
  }
  return res.json({
    greeting: computeGreeting(guest.salutation, guest.names),
    names: guest.names,
    attending,
  });
});

// ── Список гостей приглашения (владелец) ─────────────────────────────────────
router.get('/:inviteId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const invite = await loadOwnedInvite(req.params.inviteId, req.userId);
  if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });

  const guests = await prisma.guest.findMany({
    where: { invitationId: invite.id },
    orderBy: { createdAt: 'asc' },
  });
  const responses = await prisma.guestResponse.findMany({
    where: { invitationId: invite.id, guestId: { not: null } },
  });
  const byGuest = new Map(responses.map((r) => [r.guestId as string, r]));

  const result = guests.map((g) => {
    const r = byGuest.get(g.id);
    return {
      id: g.id,
      token: g.token,
      salutation: g.salutation,
      names: g.names,
      greeting: computeGreeting(g.salutation, g.names),
      responded: !!r,
      attending: r ? r.attending : null,
      drinkChoice: r ? r.drinkChoice : '',
      wishes: r ? r.wishes : '',
    };
  });
  return res.json({ advanced: isAdvanced(invite.plan), guests: result });
});

// ── Добавить гостя (владелец, только продвинутый тариф) ──────────────────────
router.post('/:inviteId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const invite = await loadOwnedInvite(req.params.inviteId, req.userId);
  if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });
  if (!isAdvanced(invite.plan)) {
    return res.status(403).json({ error: 'Кабинет гостей доступен на тарифах Стандарт и Премиум' });
  }

  const salutation = String(req.body.salutation || 'дорогие');
  const names = String(req.body.names || '').trim();
  if (!names) return res.status(400).json({ error: 'Укажите имя гостя' });
  if (!isSalutation(salutation)) return res.status(400).json({ error: 'Неверное обращение' });

  const guest = await prisma.guest.create({
    data: { invitationId: invite.id, token: genToken(), salutation, names },
  });
  return res.json({ ...guest, greeting: computeGreeting(guest.salutation, guest.names), responded: false });
});

// ── Редактировать гостя ──────────────────────────────────────────────────────
router.put('/:guestId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const guest = await prisma.guest.findUnique({ where: { id: req.params.guestId } });
  if (!guest) return res.status(404).json({ error: 'Гость не найден' });
  const invite = await loadOwnedInvite(guest.invitationId, req.userId);
  if (!invite) return res.status(403).json({ error: 'Нет доступа' });

  const salutation = req.body.salutation != null ? String(req.body.salutation) : guest.salutation;
  const names = req.body.names != null ? String(req.body.names).trim() : guest.names;
  if (!isSalutation(salutation)) return res.status(400).json({ error: 'Неверное обращение' });
  if (!names) return res.status(400).json({ error: 'Укажите имя гостя' });

  const updated = await prisma.guest.update({
    where: { id: guest.id },
    data: { salutation, names },
  });
  return res.json({ ...updated, greeting: computeGreeting(updated.salutation, updated.names) });
});

// ── Удалить гостя ────────────────────────────────────────────────────────────
router.delete('/:guestId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const guest = await prisma.guest.findUnique({ where: { id: req.params.guestId } });
  if (!guest) return res.status(404).json({ error: 'Гость не найден' });
  const invite = await loadOwnedInvite(guest.invitationId, req.userId);
  if (!invite) return res.status(403).json({ error: 'Нет доступа' });

  await prisma.guest.delete({ where: { id: guest.id } });
  return res.json({ success: true });
});

export default router;
