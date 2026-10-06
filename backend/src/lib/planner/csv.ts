// CSV для Excel и ресторана: разделитель «;» и BOM (иначе русский Excel ломает кириллицу и
// склеивает колонки), защита от формул в ячейках, пищевые ограничения — только по запросу.
import prisma from '../prisma';
import { loadPeople } from './snapshot';
import type { PersonView } from './snapshot';
import type { Party, PartyStatus } from './roster';

/** Ячейка, начинающаяся с = + - @ или табуляции, в Excel считается формулой: перед ней ставим апостроф. */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows: (string | number)[][]): string =>
  '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';

export const STATUS_TEXT: Record<PartyStatus, string> = {
  yes: 'Придёт', maybe: 'Пока не знает', no: 'Не придёт', none: 'Нет ответа',
};

/** Имя для списков: настоящее, а если гость не назван — понятная подпись без выдуманного имени. */
export const displayName = (p: { name: string; slot: number }, party?: Pick<Party, 'label'>): string =>
  p.name || `Без имени ${p.slot + 1}${party ? ` — ${party.label}` : ''}`;

export interface CsvOptions {
  diet: boolean;       // добавить пищевые ограничения
  declined: boolean;   // включить отказавшихся
}

export async function buildGuestsCsv(inviteId: string, opts: CsvOptions): Promise<string> {
  const [{ people, parties, tables }, options] = await Promise.all([
    loadPeople(inviteId),
    prisma.menuOption.findMany({ where: { invitationId: inviteId } }),
  ]);
  const partyOf = new Map(parties.map((p) => [p.key, p]));
  const tableOrder = new Map(tables.map((t, i) => [t.id, i]));
  const tableName = new Map(tables.map((t) => [t.id, t.name]));
  const optionLabel = new Map(options.map((o) => [o.id, o.label]));
  const partyOrder = new Map(parties.map((p, i) => [p.key, i]));

  const list = people
    .filter((p) => !p.excluded && (opts.declined || p.status !== 'no'))
    .sort((a: PersonView, b: PersonView) =>
      (a.tableId ? tableOrder.get(a.tableId) ?? 0 : 1e9) - (b.tableId ? tableOrder.get(b.tableId) ?? 0 : 1e9)
      || (partyOrder.get(a.partyKey) ?? 0) - (partyOrder.get(b.partyKey) ?? 0)
      || a.slot - b.slot);

  const header = ['Стол', 'Гость', 'Группа', 'Ответ', 'Взрослый / ребёнок', 'Меню'];
  if (opts.diet) header.push('Пищевые ограничения', 'Примечание из анкеты');
  const rows: (string | number)[][] = [header];
  for (const p of list) {
    const party = partyOf.get(p.partyKey);
    const row: (string | number)[] = [
      p.tableId ? tableName.get(p.tableId) ?? '' : 'Без стола',
      displayName(p, party),
      party?.label ?? '',
      STATUS_TEXT[p.status],
      p.isChild ? 'Ребёнок' : 'Взрослый',
      p.menuOptionId ? optionLabel.get(p.menuOptionId) ?? '' : p.menuReview ? 'Нужно уточнить' : '',
    ];
    if (opts.diet) row.push(p.diet, p.slot === 0 ? party?.note ?? '' : '');
    rows.push(row);
  }
  return toCsv(rows);
}
