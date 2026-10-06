// Данные для печати: всё берётся из рассадки и меню — заново ничего вводить не нужно.
import prisma from '../../prisma';
import { loadPeople } from '../snapshot';
import type { PartyStatus } from '../roster';
import { themeFor, type Theme } from './themes';

export interface PrintPerson {
  id: string;
  name: string;          // '' — имя не указано
  partyLabel: string;
  tableId: string | null;
  isChild: boolean;
  status: PartyStatus;
  menu: string;          // название варианта или ''
  menuReview: boolean;
  diet: string;
  order: number;         // порядок группы и человека в ней
}
export interface PrintTable { id: string; name: string; title: string; capacity: number }
export interface PrintData {
  couple: string;
  date: string;
  theme: Theme;
  tables: PrintTable[];
  tableById: Map<string, PrintTable>;
  people: PrintPerson[];   // без убранных из списка
  options: { id: string; label: string; note: string }[];
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** «2027-06-19» → «19 июня 2027». Непонятная дата — пустая строка. */
export function russianDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return '';
  const month = Number(m[2]);
  if (month < 1 || month > 12) return '';
  return `${Number(m[3])} ${MONTHS[month - 1]} ${m[1]}`;
}

/** «Стол 5» для номеров и коротких названий, слово («Молодожёны») — как есть. */
export const tableTitle = (name: string): string =>
  /^\p{L}?\d{1,3}\p{L}?$/u.test(name) || name.length <= 2 ? `Стол ${name}` : name;
export const isNumbered = (name: string): boolean => /^\p{L}?\d{1,3}\p{L}?$/u.test(name) || name.length <= 2;

const natural = (a: string, b: string) => a.localeCompare(b, 'ru', { numeric: true });

export async function loadPrintData(invite: { id: string; groomName: string; brideName: string; weddingDate: string; templateId: string }, theme?: unknown): Promise<PrintData> {
  const [{ people, parties, tables }, options] = await Promise.all([
    loadPeople(invite.id),
    prisma.menuOption.findMany({ where: { invitationId: invite.id }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }),
  ]);
  const partyOrder = new Map(parties.map((p, i) => [p.key, i]));
  const partyLabel = new Map(parties.map((p) => [p.key, p.label]));
  const label = new Map(options.map((o) => [o.id, o.label]));
  const sortedTables = [...tables].sort((a, b) => natural(a.name, b.name))
    .map((t) => ({ id: t.id, name: t.name, title: tableTitle(t.name), capacity: t.capacity }));
  return {
    couple: [invite.groomName, invite.brideName].map((s) => s.trim()).filter(Boolean).join(' & ') || 'Наша свадьба',
    date: russianDate(invite.weddingDate),
    theme: themeFor(invite.templateId, theme),
    tables: sortedTables,
    tableById: new Map(sortedTables.map((t) => [t.id, t])),
    people: people.filter((p) => !p.excluded).map((p) => ({
      id: p.id, name: p.name, partyLabel: partyLabel.get(p.partyKey) ?? '', tableId: p.tableId, isChild: p.isChild, status: p.status,
      menu: p.menuOptionId ? label.get(p.menuOptionId) ?? '' : '', menuReview: p.menuReview, diet: p.diet,
      order: (partyOrder.get(p.partyKey) ?? 0) * 100 + p.slot,
    })),
    options: options.map((o) => ({ id: o.id, label: o.label, note: o.note })),
  };
}

/** Кто сидит за столами — в порядке столов, затем групп. */
export function seatedPeople(data: PrintData): PrintPerson[] {
  const tableOrder = new Map(data.tables.map((t, i) => [t.id, i]));
  return data.people
    .filter((p) => p.tableId && p.status !== 'no' && tableOrder.has(p.tableId))
    .sort((a, b) => (tableOrder.get(a.tableId!) ?? 0) - (tableOrder.get(b.tableId!) ?? 0) || a.order - b.order);
}

/** Имя для списков; безымянного гостя подписываем по его группе, а не выдуманным именем. */
export const listName = (p: PrintPerson): string => p.name || `Гость без имени (${p.partyLabel})`;
