// Состав гостей: из чего складываются группы и как люди (Person) синхронизируются с ответами анкеты.
//
// Группа — это Guest (приглашение с персональной ссылкой) или GuestResponse без гостя
// (ответ по общей ссылке сайта). Статус и число людей группы берутся из её ответа.
// Людей поимённо анкета не знала: пока гость их не назвал, остаются заготовки без имени —
// имён мы не выдумываем, интерфейс показывает «состав нужно уточнить».
import { Prisma } from '@prisma/client';
import type { Guest, GuestResponse, Person, SeatTable } from '@prisma/client';
import prisma from '../prisma';
import { attendanceOf, parseAnswers } from '../rsvpDetails';
import { LIMITS, plural, withInviteLock } from './util';

export type PartyStatus = 'yes' | 'maybe' | 'no' | 'none';

export interface Party {
  key: string;              // g:<guestId> | r:<responseId>
  kind: 'guest' | 'response';
  guestId: string | null;
  responseId: string | null;
  label: string;            // как показывать в списках: «Денис и Мария», «Семья Кореловых»
  status: PartyStatus;      // none — приглашён, но не ответил
  want: number;             // сколько человек назвал гость в ответе; 0 — ответа нет
  kids: number;             // из них детей
  createdAt: Date;
  answeredAt: Date | null;
  seatWish: string;         // ответ на «С кем хотели бы сидеть рядом?»
  note: string;             // ответ на вопрос про аллергии (анкета без вопросов по каждому человеку)
  singleName: string;       // имя единственного человека, если приглашён один и обращение это позволяет
  respondent: string;       // имя, которым назвался гость в анкете по общей ссылке
}

const SINGLE_SALUTATIONS = new Set(['дорогой', 'дорогая']);
// «Денис и Мария», «Анна, Пётр», «Иван + 1» — это не одно имя
const looksSingle = (names: string) => !/[,&+]|(^|\s)(и|с)(\s|$)/i.test(names);

export const partyKeyOfPerson = (p: { guestId: string | null; responseId: string | null }): string | null =>
  p.guestId ? `g:${p.guestId}` : p.responseId ? `r:${p.responseId}` : null;

export function parsePartyKey(key: unknown): { kind: 'guest' | 'response'; id: string } | null {
  if (typeof key !== 'string') return null;
  const m = /^([gr]):([A-Za-z0-9_-]{1,64})$/.exec(key);
  return m ? { kind: m[1] === 'g' ? 'guest' : 'response', id: m[2] } : null;
}

function toParty(key: string, kind: 'guest' | 'response', guest: Guest | null, r: GuestResponse | null): Party {
  const status: PartyStatus = r ? attendanceOf(r) : 'none';
  const answers = r ? parseAnswers(r.answers) : [];
  const want = r ? Math.min(Math.max(1, r.guestsCount || 1), LIMITS.partyPeople) : 0;
  const kids = r && status !== 'no' ? Math.min(Math.max(0, r.childrenCount || 0), Math.max(0, want - 1)) : 0;
  const label = guest
    ? (guest.salutation === 'семья' ? `Семья ${guest.names}` : guest.names)
    : (r?.guestName || 'Гость');
  return {
    key, kind,
    guestId: guest ? guest.id : null,
    responseId: guest ? null : r!.id,
    label, status, want, kids,
    createdAt: guest ? guest.createdAt : r!.createdAt,
    answeredAt: r ? r.createdAt : null,
    seatWish: answers.find((a) => a.id === 'seat')?.a || '',
    note: answers.find((a) => a.id === 'allergy')?.a || '',
    singleName: guest && SINGLE_SALUTATIONS.has(guest.salutation) && looksSingle(guest.names) ? guest.names : '',
    respondent: !guest && r ? r.guestName : '',
  };
}

/** Группы приглашения. Ответ с personal-ссылкой принадлежит своему гостю (берём последний);
    остальные — по общей ссылке, а также ответы удалённых гостей — каждый сам по себе. */
export function buildParties(guests: Guest[], responses: GuestResponse[]): Party[] {
  const latest = new Map<string, GuestResponse>();
  for (const r of responses) {
    if (!r.guestId) continue;
    const cur = latest.get(r.guestId);
    if (!cur || r.createdAt > cur.createdAt) latest.set(r.guestId, r);
  }
  const guestIds = new Set(guests.map((g) => g.id));
  const parties: Party[] = guests.map((g) => toParty(`g:${g.id}`, 'guest', g, latest.get(g.id) ?? null));
  for (const r of responses) {
    if (!r.guestId || !guestIds.has(r.guestId)) parties.push(toParty(`r:${r.id}`, 'response', null, r));
  }
  return parties.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/* ── План синхронизации одной группы (чистая функция, без базы) ───────────────── */

export interface PartyPlan {
  create: { slot: number; name: string; isChild: boolean }[];
  remove: string[];                     // заготовки, которые больше не нужны
  fill: { id: string; name: string }[]; // имя в пустую строку
  unseat: string[];                     // группа отказалась — снять со стола
}

const isPlaceholder = (p: Person): boolean =>
  !p.name && !p.tableId && !p.menuOptionId && !p.menuReview && !p.diet && !p.tag;

/** Имя первого человека, если оно известно наверняка: назвавшийся в анкете по общей ссылке
    или единственный гость с обращением «дорогой/дорогая». Остальных не придумываем. */
function firstName(party: Party, target: number): string {
  const raw = party.kind === 'response' ? party.respondent : target === 1 ? party.singleName : '';
  return raw.slice(0, LIMITS.name).trim();
}

export function planParty(party: Party, persons: Person[]): PartyPlan {
  const rows = [...persons].sort((a, b) => a.slot - b.slot);
  const plan: PartyPlan = { create: [], remove: [], fill: [], unseat: [] };

  // Отказ освобождает места за столами
  if (party.status === 'no') plan.unseat = rows.filter((r) => r.tableId).map((r) => r.id);

  const coming = party.status === 'yes' || party.status === 'maybe';
  // Сколько строк должно быть: у пришедших — сколько назвал гость, у остальных — сколько уже есть (минимум один)
  const target = coming ? Math.max(1, party.want) : Math.max(1, rows.length);
  const name0 = firstName(party, target);

  if (rows.length < target) {
    const add = target - rows.length;
    const kidsHave = rows.filter((r) => r.isChild && !r.excluded).length;
    const kidsNew = coming ? Math.min(add, Math.max(0, party.kids - kidsHave)) : 0;
    let slot = rows.length ? rows[rows.length - 1].slot + 1 : 0;
    for (let i = 0; i < add; i++, slot++) {
      plan.create.push({ slot, name: slot === 0 ? name0 : '', isChild: i >= add - kidsNew });
    }
  } else if (coming && rows.length > target) {
    // Гость назвал меньше людей: лишними считаем только пустые заготовки — сначала
    // убранные из списка, затем с конца. Названных и посаженных молча не удаляем.
    let surplus = rows.length - target;
    const spare = rows.filter(isPlaceholder).sort((a, b) => Number(b.excluded) - Number(a.excluded) || b.slot - a.slot);
    for (const r of spare) {
      if (surplus <= 0) break;
      plan.remove.push(r.id);
      surplus--;
    }
  }

  const zero = rows.find((r) => r.slot === 0);
  if (zero && name0 && !zero.name && !zero.excluded) plan.fill.push({ id: zero.id, name: name0 });
  return plan;
}

/* ── Загрузка и применение ───────────────────────────────────────────────────── */

export interface RosterData {
  parties: Party[];
  persons: Person[];
  tables: SeatTable[];
}

export async function loadRoster(inviteId: string): Promise<RosterData> {
  const [guests, responses, persons, tables] = await Promise.all([
    prisma.guest.findMany({ where: { invitationId: inviteId }, orderBy: { createdAt: 'asc' } }),
    prisma.guestResponse.findMany({ where: { invitationId: inviteId }, orderBy: { createdAt: 'asc' } }),
    prisma.person.findMany({ where: { invitationId: inviteId }, orderBy: [{ slot: 'asc' }, { createdAt: 'asc' }] }),
    prisma.seatTable.findMany({ where: { invitationId: inviteId }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }),
  ]);
  return { parties: buildParties(guests, responses), persons, tables };
}

export function groupByParty(persons: Person[]): Map<string, Person[]> {
  const map = new Map<string, Person[]>();
  for (const p of persons) {
    const key = partyKeyOfPerson(p);
    if (!key) continue;
    const list = map.get(key);
    if (list) list.push(p); else map.set(key, [p]);
  }
  return map;
}

export interface ReconcileResult {
  created: number;
  removed: number;
  filled: number;
  /** Кого сняли со стола из-за отказа: для письма/Telegram владельцу. */
  unseated: { partyLabel: string; text: string }[];
}

const personTitle = (p: Person): string => p.name || `гость ${p.slot + 1}`;

/** «стол 5» для номеров и коротких названий, «стол «Молодожёны»» для слов. */
const tableLabel = (name: string): string =>
  /^\p{L}?\d{1,3}\p{L}?$/u.test(name) || name.length <= 2 ? `стол ${name}` : `стол «${name}»`;

async function reconcileOnce(inviteId: string, onlyKey?: string): Promise<ReconcileResult> {
  const { parties, persons, tables } = await loadRoster(inviteId);
  const byParty = groupByParty(persons);
  const tableName = new Map(tables.map((t) => [t.id, t.name]));

  const creates: Prisma.PersonCreateManyInput[] = [];
  const removeIds: string[] = [];
  const unseatIds: string[] = [];
  const fills: { id: string; name: string }[] = [];
  const notices: { kind: string; text: string }[] = [];
  const result: ReconcileResult = { created: 0, removed: 0, filled: 0, unseated: [] };
  let total = persons.length;

  for (const party of parties) {
    if (onlyKey && party.key !== onlyKey) continue;
    const rows = byParty.get(party.key) ?? [];
    const plan = planParty(party, rows);

    // Потолок людей на приглашение: сверх него заготовки не создаём
    const room = Math.max(0, LIMITS.persons - total + plan.remove.length);
    const create = plan.create.slice(0, room);
    total += create.length - plan.remove.length;
    for (const c of create) {
      creates.push({
        invitationId: inviteId,
        guestId: party.guestId,
        responseId: party.responseId,
        slot: c.slot, name: c.name, isChild: c.isChild,
      });
    }
    removeIds.push(...plan.remove);
    fills.push(...plan.fill);

    if (plan.unseat.length) {
      unseatIds.push(...plan.unseat);
      const items = rows
        .filter((r) => plan.unseat.includes(r.id))
        .map((r) => `${personTitle(r)} (${tableLabel(tableName.get(r.tableId as string) ?? '—')})`);
      const text = `Ответ «не придёт» от «${party.label}». Освобождено ${items.length} ${plural(items.length, 'место', 'места', 'мест')}: ${items.join(', ')}.`;
      notices.push({ kind: 'declined', text });
      result.unseated.push({ partyLabel: party.label, text });
    }
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  if (removeIds.length) ops.push(prisma.person.deleteMany({ where: { id: { in: removeIds }, invitationId: inviteId } }));
  if (unseatIds.length) ops.push(prisma.person.updateMany({ where: { id: { in: unseatIds }, invitationId: inviteId }, data: { tableId: null } }));
  for (const f of fills) ops.push(prisma.person.updateMany({ where: { id: f.id, invitationId: inviteId, name: '' }, data: { name: f.name } }));
  if (creates.length) ops.push(prisma.person.createMany({ data: creates }));
  for (const n of notices) ops.push(prisma.plannerNotice.create({ data: { invitationId: inviteId, kind: n.kind, text: n.text } }));
  if (ops.length) await prisma.$transaction(ops);

  if (notices.length) await trimNotices(inviteId);
  result.created = creates.length;
  result.removed = removeIds.length;
  result.filled = fills.length;
  return result;
}

/** Хранить последние LIMITS.notices сообщений — старые не нужны. */
async function trimNotices(inviteId: string): Promise<void> {
  const old = await prisma.plannerNotice.findMany({
    where: { invitationId: inviteId }, orderBy: { createdAt: 'desc' }, skip: LIMITS.notices, select: { id: true },
  });
  if (old.length) await prisma.plannerNotice.deleteMany({ where: { id: { in: old.map((n) => n.id) } } });
}

const isUniqueViolation = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/** Привести людей в соответствие с ответами. Идемпотентно: повторный запуск ничего не меняет.
    Люди создаются только для групп без строк и по мере роста числа гостей в ответе; уже
    названных и посаженных не удаляем. Без onlyKey обходит всё приглашение, с ним — одну группу. */
export function reconcile(inviteId: string, onlyKey?: string): Promise<ReconcileResult> {
  return withInviteLock(inviteId, async () => {
    try {
      return await reconcileOnce(inviteId, onlyKey);
    } catch (e) {
      // Гонка с другим процессом за одну и ту же ячейку — читаем заново и повторяем
      if (isUniqueViolation(e)) return reconcileOnce(inviteId, onlyKey);
      throw e;
    }
  });
}
