// Планировщик: меню и рассадка гостей. Каждый запрос: вход → владелец приглашения → тариф →
// флаг раскрытия (lib/planner/access.ts). Чужое приглашение отвечает 404, как и в остальных роутах.
import { Router, Response } from 'express';
import type { Invitation } from '@prisma/client';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { DENIAL_TEXT, plannerDenial } from '../lib/planner/access';
import { PlannerError, errName } from '../lib/planner/util';
import { reconcile } from '../lib/planner/roster';
import { buildSnapshot } from '../lib/planner/snapshot';
import { assignPersons, createTable, createTables, deleteTable, updateTable } from '../lib/planner/seating';
import { createOption, deleteOption, reorderOptions, saveSettings, updateOption } from '../lib/planner/menu';
import { createParty, createPerson, importGuests, setPartyTag, updatePerson } from '../lib/planner/people';
import { buildGuestsCsv } from '../lib/planner/csv';

const router = Router();
router.use(authMiddleware);

router.use('/:inviteId', async (req: AuthRequest, res: Response, next) => {
  const invite = await prisma.invitation.findUnique({ where: { id: String(req.params.inviteId) } });
  if (!invite || invite.userId !== req.userId) return res.status(404).json({ error: 'Приглашение не найдено' });
  const denied = await plannerDenial(invite);
  if (denied) return res.status(403).json({ error: DENIAL_TEXT[denied], code: denied });
  res.locals.invite = invite;
  next();
});

type Ctx = { req: AuthRequest; res: Response; id: string; invite: Invitation; body: Record<string, unknown> };

/** Обёртка роута: отдаёт ошибки сервиса с их статусом, остальное — 500 без подробностей
    (в логе только код ошибки: в сообщениях Prisma бывают данные гостей). */
const route = (fn: (c: Ctx) => Promise<unknown>) => async (req: AuthRequest, res: Response) => {
  try {
    const invite = res.locals.invite as Invitation;
    const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) as Record<string, unknown>;
    await fn({ req, res, id: invite.id, invite, body });
  } catch (e) {
    if (e instanceof PlannerError) return res.status(e.status).json({ error: e.message, ...e.extra });
    console.error('planner request failed:', errName(e));
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
};

/** Ответ на изменение: результат операции + свежий снимок, чтобы интерфейс не делал второй запрос. */
async function reply(c: Ctx, result?: unknown): Promise<void> {
  c.res.json({ result: result ?? null, snapshot: await buildSnapshot(c.id) });
}

const param = (req: AuthRequest, name: string): string => String(req.params[name] ?? '');

router.get('/:inviteId', route(async (c) => { c.res.json(await buildSnapshot(c.id)); }));

// Привести людей в соответствие с ответами анкеты (при открытии раздела и по кнопке)
router.post('/:inviteId/sync', route(async (c) => { await reconcile(c.id); await reply(c); }));

router.put('/:inviteId/settings', route(async (c) => { await reply(c, await saveSettings(c.id, c.body)); }));

router.post('/:inviteId/menu', route(async (c) => { await reply(c, await createOption(c.id, c.body)); }));
router.post('/:inviteId/menu/reorder', route(async (c) => { await reply(c, await reorderOptions(c.id, c.body.ids)); }));
router.put('/:inviteId/menu/:optionId', route(async (c) => { await reply(c, await updateOption(c.id, param(c.req, 'optionId'), c.body)); }));
router.delete('/:inviteId/menu/:optionId', route(async (c) => {
  const reassignTo = typeof c.req.query.reassignTo === 'string' ? c.req.query.reassignTo : undefined;
  await reply(c, await deleteOption(c.id, param(c.req, 'optionId'), reassignTo));
}));

router.post('/:inviteId/tables', route(async (c) => { await reply(c, await createTable(c.id, c.body)); }));
router.post('/:inviteId/tables/bulk', route(async (c) => { await reply(c, await createTables(c.id, c.body)); }));
router.put('/:inviteId/tables/:tableId', route(async (c) => { await reply(c, await updateTable(c.id, param(c.req, 'tableId'), c.body)); }));
router.delete('/:inviteId/tables/:tableId', route(async (c) => {
  await reply(c, await deleteTable(c.id, param(c.req, 'tableId'), c.req.query.confirm === '1'));
}));

router.post('/:inviteId/seat', route(async (c) => { await reply(c, await assignPersons(c.id, c.body.personIds, c.body.tableId ?? null)); }));

router.post('/:inviteId/persons', route(async (c) => { await reply(c, await createPerson(c.id, c.body)); }));
router.put('/:inviteId/persons/:personId', route(async (c) => { await reply(c, await updatePerson(c.id, param(c.req, 'personId'), c.body)); }));
router.post('/:inviteId/parties', route(async (c) => { await reply(c, await createParty(c.id, c.body)); }));
router.put('/:inviteId/parties/:partyKey/tag', route(async (c) => { await reply(c, await setPartyTag(c.id, param(c.req, 'partyKey'), c.body.tag)); }));
router.post('/:inviteId/import', route(async (c) => { await reply(c, await importGuests(c.id, c.body)); }));

router.post('/:inviteId/notices/seen', route(async (c) => {
  await prisma.plannerNotice.updateMany({ where: { invitationId: c.id, seenAt: null }, data: { seenAt: new Date() } });
  await reply(c);
}));

// CSV для Excel. Пищевые ограничения — только если попросили явно (diet=1)
router.get('/:inviteId/export.csv', route(async (c) => {
  const csv = await buildGuestsCsv(c.id, { diet: c.req.query.diet === '1', declined: c.req.query.declined === '1' });
  c.res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  c.res.setHeader('Content-Disposition', 'attachment; filename="weddingcraft-guests.csv"');
  c.res.send(csv);
}));

export default router;
