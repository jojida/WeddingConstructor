import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { isAdvanced, isSalutation, computeGreeting, isPaid, hasGuestReminders } from '../lib/plans';
import { attendanceOf, parseAnswers } from '../lib/rsvpDetails';
import { guestView, type GuestView } from '../lib/planner/guestView';
import { errName } from '../lib/planner/util';
import { record } from '../lib/inviteValidation';
import { rateLimit } from '../middleware/rateLimit';
import { forgetGuestPhone, formatPhone, guestPhones, normalizePhone, setGuestPhone } from '../lib/reminders';
import { smsAvailable } from '../lib/sms';

const router = Router();

function genToken(): string {
  // короткий URL-безопасный токен для персональной ссылки ?g=
  return crypto.randomBytes(16).toString('base64url');
}

/** Поле phone: нет — не трогаем, '' или null — стереть, иначе российский мобильный. */
function parsePhone(raw: unknown): { phone?: string } | null {
  if (raw === undefined) return {};
  if (raw === null || (typeof raw === 'string' && !raw.trim())) return { phone: '' };
  const phone = normalizePhone(raw);
  return phone ? { phone } : null;
}
const PHONE_ERROR = 'Телефон: российский мобильный, например +7 912 345-67-89';
// Телефон гостя нужен только для SMS «ждут вашего ответа» — напоминаний «Максимума»
const PHONE_PLAN_ERROR = 'Телефон гостя — для напоминаний в тарифе «Максимум»';

async function loadOwnedInvite(inviteId: string, userId?: string) {
  const invite = await prisma.invitation.findUnique({ where: { id: inviteId } });
  if (!invite || invite.userId !== userId) return null;
  return invite;
}

// ── Публичный резолв персональной ссылки (для страницы приглашения) ──────────
// ВАЖНО: объявлен до /:inviteId, отдаёт только обращение/имя/статус — без утечки.
// ?invite=<id> — страница называет свой сайт: чужая ссылка на нём не сработает, и только тогда
// добавляется «Ваш стол» (стол и блюда своей группы, если пара включила их показ).
router.get('/resolve/:token', rateLimit(120, 60_000), async (req: Request, res: Response) => {
  if (typeof req.params.token !== 'string' || req.params.token.length > 100) return res.status(404).json({ error: 'Гость не найден' });
  const guest = await prisma.guest.findUnique({ where: { token: req.params.token as string } });
  if (!guest) return res.status(404).json({ error: 'Гость не найден' });
  const invitation = await prisma.invitation.findUnique({ where: { id: guest.invitationId } });
  if (!invitation || !isPaid(invitation.status) || !isAdvanced(invitation.plan)) return res.status(404).json({ error: 'Гость не найден' });
  const site = typeof req.query.invite === 'string' ? req.query.invite : '';
  if (site && site !== invitation.id) return res.status(404).json({ error: 'Гость не найден' });
  let attending: boolean | null = null;
  let attendance: string | null = null;
  if (guest.responseId) {
    const r = await prisma.guestResponse.findUnique({ where: { id: guest.responseId } });
    if (r && r.invitationId === invitation.id && r.guestId === guest.id) { attending = r.attending; attendance = attendanceOf(r); }
  }
  // Сбой планировщика не мешает открыть сайт: гость просто не увидит плашку со столом
  let planner: GuestView | null = null;
  if (site) {
    try { planner = await guestView(invitation, guest); } catch (e) { console.error('guest view failed:', errName(e)); }
  }
  return res.json({
    greeting: computeGreeting(guest.salutation, guest.names),
    names: guest.names,
    attending,
    attendance,
    planner,
  });
});

// ── Список гостей приглашения (владелец) ─────────────────────────────────────
router.get('/:inviteId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const invite = await loadOwnedInvite(req.params.inviteId as string, req.userId);
  if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });

  if (!isAdvanced(invite.plan)) return res.status(403).json({ error: 'Кабинет гостей доступен в «Премиум» и «Максимум»' });

  const guests = await prisma.guest.findMany({
    where: { invitationId: invite.id },
    orderBy: { createdAt: 'asc' },
  });
  const responses = await prisma.guestResponse.findMany({
    where: { invitationId: invite.id, guestId: { not: null } },
    orderBy: { createdAt: 'asc' },
  });
  const byGuest = new Map(responses.map((r) => [r.guestId as string, r]));
  const phones = hasGuestReminders(invite.plan) ? await guestPhones(invite.id) : new Map<string, string>();

  const result = guests.map((g) => {
    const r = byGuest.get(g.id);
    const phone = phones.get(g.id);
    return {
      id: g.id,
      token: g.token,
      salutation: g.salutation,
      names: g.names,
      greeting: computeGreeting(g.salutation, g.names),
      phone: phone ? formatPhone(phone) : '',
      responded: !!r,
      attending: r ? r.attending : null,
      attendance: r ? attendanceOf(r) : null,
      guestsCount: r ? r.guestsCount : null,
      childrenCount: r ? r.childrenCount : 0,
      drinkChoice: r ? r.drinkChoice : '',
      wishes: r ? r.wishes : '',
      answers: r ? parseAnswers(r.answers) : [],
    };
  });
  // phones — показывать ли поле «Телефон»: без SMS (на проде до ключей SMS Aero) оно ни к чему
  return res.json({ advanced: isAdvanced(invite.plan), phones: hasGuestReminders(invite.plan) && smsAvailable(), guests: result });
});

// ── Добавить гостя (владелец, только продвинутый тариф) ──────────────────────
router.post('/:inviteId', authMiddleware, rateLimit(120, 60_000, req => (req as AuthRequest).userId!), async (req: AuthRequest, res: Response) => {
  if (!record(req.body) || typeof req.body.names !== 'string' || (req.body.salutation != null && typeof req.body.salutation !== 'string')) return res.status(400).json({ error: 'Некорректные данные гостя' });
  const invite = await loadOwnedInvite(req.params.inviteId as string, req.userId);
  if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });
  if (!isAdvanced(invite.plan)) {
    return res.status(403).json({ error: 'Кабинет гостей доступен в «Премиум» и «Максимум»' });
  }

  const salutation = String(req.body.salutation || 'дорогие');
  const names = String(req.body.names || '').trim();
  if (!names || names.length > 200) return res.status(400).json({ error: 'Имя гостя: от 1 до 200 символов' });
  if (!isSalutation(salutation)) return res.status(400).json({ error: 'Неверное обращение' });
  const phone = parsePhone(req.body.phone);
  if (!phone) return res.status(400).json({ error: PHONE_ERROR });
  if (phone.phone && !hasGuestReminders(invite.plan)) return res.status(403).json({ error: PHONE_PLAN_ERROR });

  const guest = await prisma.guest.create({
    data: { invitationId: invite.id, token: genToken(), salutation, names },
  });
  if (phone.phone) await setGuestPhone(invite.id, guest.id, phone.phone);
  return res.json({ ...guest, greeting: computeGreeting(guest.salutation, guest.names), phone: phone.phone ? formatPhone(phone.phone) : '', responded: false });
});

// ── Редактировать гостя ──────────────────────────────────────────────────────
router.put('/:guestId', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!record(req.body) || (req.body.names != null && typeof req.body.names !== 'string') || (req.body.salutation != null && typeof req.body.salutation !== 'string')) return res.status(400).json({ error: 'Некорректные данные гостя' });
  const guest = await prisma.guest.findUnique({ where: { id: req.params.guestId as string } });
  if (!guest) return res.status(404).json({ error: 'Гость не найден' });
  const invite = await loadOwnedInvite(guest.invitationId, req.userId);
  if (!invite) return res.status(404).json({ error: 'Гость не найден' });
  if (!isAdvanced(invite.plan)) return res.status(403).json({ error: 'Кабинет гостей доступен в «Премиум» и «Максимум»' });

  const salutation = req.body.salutation != null ? String(req.body.salutation) : guest.salutation;
  const names = req.body.names != null ? String(req.body.names).trim() : guest.names;
  if (!isSalutation(salutation)) return res.status(400).json({ error: 'Неверное обращение' });
  if (!names || names.length > 200) return res.status(400).json({ error: 'Имя гостя: от 1 до 200 символов' });
  const phone = parsePhone(req.body.phone);
  if (!phone) return res.status(400).json({ error: PHONE_ERROR });
  if (phone.phone && !hasGuestReminders(invite.plan)) return res.status(403).json({ error: PHONE_PLAN_ERROR });

  const updated = await prisma.guest.update({
    where: { id: guest.id },
    data: { salutation, names },
  });
  if (phone.phone !== undefined) await setGuestPhone(invite.id, guest.id, phone.phone);
  const saved = hasGuestReminders(invite.plan) ? (await guestPhones(invite.id)).get(guest.id) : undefined;
  return res.json({ ...updated, greeting: computeGreeting(updated.salutation, updated.names), phone: saved ? formatPhone(saved) : '' });
});

// ── Удалить гостя ────────────────────────────────────────────────────────────
router.delete('/:guestId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const guest = await prisma.guest.findUnique({ where: { id: req.params.guestId as string } });
  if (!guest) return res.status(404).json({ error: 'Гость не найден' });
  const invite = await loadOwnedInvite(guest.invitationId, req.userId);
  if (!invite) return res.status(404).json({ error: 'Гость не найден' });

  await prisma.$transaction([forgetGuestPhone(guest.id), prisma.guest.delete({ where: { id: guest.id } })]);
  return res.json({ success: true });
});

export default router;
