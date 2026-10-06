// Снимок планировщика для кабинета: настройки, варианты меню, столы, группы, люди и сводка.
// Каждая цифра сводки приходит вместе со списком людей за ней ({ count, ids }) — интерфейс
// показывает именно его, поэтому число и список не могут разойтись.
import type { Person } from '@prisma/client';
import prisma from '../prisma';
import { LIMITS } from './util';
import { loadRoster, partyKeyOfPerson } from './roster';
import type { Party, PartyStatus } from './roster';
import { getSettings } from './menu';

export interface PersonView {
  id: string;
  partyKey: string;
  slot: number;
  name: string;
  isChild: boolean;
  excluded: boolean;
  menuOptionId: string | null;
  menuReview: boolean;
  diet: string;
  tag: string;
  tableId: string | null;
  status: PartyStatus;
}

export interface IdList { count: number; ids: string[] }
const idList = (list: { id: string }[]): IdList => ({ count: list.length, ids: list.map((p) => p.id) });

function toView(p: Person, status: PartyStatus): PersonView {
  return {
    id: p.id, partyKey: partyKeyOfPerson(p) ?? '', slot: p.slot, name: p.name, isChild: p.isChild, excluded: p.excluded,
    menuOptionId: p.menuOptionId, menuReview: p.menuReview, diet: p.diet, tag: p.tag, tableId: p.tableId, status,
  };
}

/** Люди с подписанным статусом группы — общая основа снимка, CSV и печати. */
export async function loadPeople(inviteId: string) {
  const roster = await loadRoster(inviteId);
  const status = new Map(roster.parties.map((p) => [p.key, p.status]));
  const people = roster.persons.map((p) => toView(p, status.get(partyKeyOfPerson(p) ?? '') ?? 'none'));
  return { ...roster, people };
}

export async function buildSnapshot(inviteId: string) {
  const [{ parties, tables, people }, options, settings, notices] = await Promise.all([
    loadPeople(inviteId),
    prisma.menuOption.findMany({ where: { invitationId: inviteId }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }),
    getSettings(inviteId),
    prisma.plannerNotice.findMany({ where: { invitationId: inviteId }, orderBy: { createdAt: 'desc' }, take: 30 }),
  ]);

  const active = people.filter((p) => !p.excluded);
  const of = (s: PartyStatus) => active.filter((p) => p.status === s);
  const yes = of('yes'), maybe = of('maybe'), no = of('no'), none = of('none');

  // Группы, где в списке больше людей, чем назвал гость: лишних сами не удаляем — владелец решает
  const activeByParty = new Map<string, number>();
  for (const p of active) activeByParty.set(p.partyKey, (activeByParty.get(p.partyKey) ?? 0) + 1);
  const excess = parties
    .filter((p) => (p.status === 'yes' || p.status === 'maybe') && (activeByParty.get(p.key) ?? 0) > p.want)
    .map((p) => ({ partyKey: p.key, label: p.label, want: p.want, have: activeByParty.get(p.key) ?? 0 }));

  const menuOf = (list: PersonView[]) => ({
    options: options.map((o) => ({ optionId: o.id, ...idList(list.filter((p) => p.menuOptionId === o.id)) })),
    noChoice: idList(list.filter((p) => !p.menuOptionId && !p.menuReview)),
    review: idList(list.filter((p) => !p.menuOptionId && p.menuReview)),
  });

  const summary = {
    headcount: {
      yes: idList(yes),
      yesChildren: idList(yes.filter((p) => p.isChild)),
      maybe: idList(maybe),
      no: idList(no),
      none: idList(none),
    },
    menu: {
      options: options.map((o) => ({ optionId: o.id, label: o.label, ...idList(yes.filter((p) => p.menuOptionId === o.id)) })),
      noChoice: idList(yes.filter((p) => !p.menuOptionId && !p.menuReview)),
      review: idList(yes.filter((p) => !p.menuOptionId && p.menuReview)),
    },
    diet: idList(yes.filter((p) => p.diet)),
    seating: {
      unseated: idList(active.filter((p) => p.status !== 'no' && !p.tableId)),
      unnamed: idList(active.filter((p) => p.status !== 'no' && !p.name)),
      excess,
    },
    tables: tables.map((t) => {
      const seated = active.filter((p) => p.tableId === t.id);
      const confirmed = seated.filter((p) => p.status === 'yes');
      return {
        id: t.id,
        yes: confirmed.length,
        maybe: seated.filter((p) => p.status === 'maybe').length,
        none: seated.filter((p) => p.status === 'none').length,
        menu: menuOf(confirmed),
      };
    }),
  };

  return {
    settings,
    options: options.map((o) => ({ id: o.id, label: o.label, note: o.note, sort: o.sort })),
    tables: tables.map((t) => {
      const occupied = active.filter((p) => p.tableId === t.id).length;
      return { id: t.id, name: t.name, capacity: t.capacity, shape: t.shape, sort: t.sort, occupied, free: Math.max(0, t.capacity - occupied) };
    }),
    parties: parties.map((p: Party) => ({
      key: p.key, kind: p.kind, guestId: p.guestId, label: p.label, status: p.status, want: p.want, kids: p.kids,
      seatWish: p.seatWish, note: p.note, answeredAt: p.answeredAt, createdAt: p.createdAt,
    })),
    persons: people,
    notices: notices.map((n) => ({ id: n.id, kind: n.kind, text: n.text, createdAt: n.createdAt, seen: !!n.seenAt })),
    summary,
    limits: {
      persons: LIMITS.persons, tables: LIMITS.tables, options: LIMITS.options, capacityMax: LIMITS.capacityMax,
      name: LIMITS.name, tag: LIMITS.tag, diet: LIMITS.diet, tableName: LIMITS.tableName,
      optionLabel: LIMITS.optionLabel, optionNote: LIMITS.optionNote, seatBatch: LIMITS.seatBatch,
      importLines: LIMITS.importLines, partyPeople: LIMITS.partyPeople,
    },
  };
}

export type PlannerSnapshot = Awaited<ReturnType<typeof buildSnapshot>>;
