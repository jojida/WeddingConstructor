// «Ваш стол» на сайте приглашения. Гость открывает свою персональную ссылку (?g=) и видит,
// за каким столом сидят люди его группы, а если пара включила — их блюда и меню.
// Только своя группа: чужих имён, рассадки других гостей и пищевых ограничений здесь нет.
import type { Guest, Invitation } from '@prisma/client';
import prisma from '../prisma';
import { attendanceOf } from '../rsvpDetails';
import { plannerDenial } from './access';
import { getSettings } from './menu';
import { tableTitle } from './print/data';
import { themeFor } from './print/themes';

export interface GuestViewGroup { people: string[]; others: number }   // others — люди без имени
export interface GuestViewTable extends GuestViewGroup { name: string; title: string }
export interface GuestView {
  accent: string;                                   // цвет оформления — как у печати по шаблону
  size: number;                                     // сколько человек в группе: одному имена не нужны
  tables: GuestViewTable[];                         // пусто, если пара не показывает рассадку
  waiting: GuestViewGroup | null;                   // кто из группы ещё без стола (если кто-то уже сидит)
  dishes: { name: string; dish: string }[];         // выбор блюд группы, если пара показывает меню
  menu: { label: string; note: string }[];
}

/** Что показать гостю. null — нечего: функция закрыта, пара ничего не включила, гость отказался
    или пока ни стола, ни меню нет. */
export async function guestView(invite: Invitation, guest: Guest): Promise<GuestView | null> {
  if (await plannerDenial(invite)) return null;
  const settings = await getSettings(invite.id);
  if (!settings.showTable && !settings.showMenu) return null;
  const latest = await prisma.guestResponse.findFirst({ where: { guestId: guest.id }, orderBy: { createdAt: 'desc' } });
  if (latest && attendanceOf(latest) === 'no') return null;

  const persons = await prisma.person.findMany({ where: { guestId: guest.id, excluded: false }, orderBy: { slot: 'asc' } });
  const view: GuestView = { accent: themeFor(invite.templateId).accent, size: persons.length, tables: [], waiting: null, dishes: [], menu: [] };
  const add = (group: GuestViewGroup, name: string) => { if (name.trim()) group.people.push(name.trim()); else group.others++; };

  if (settings.showTable) {
    const ids = [...new Set(persons.map((p) => p.tableId).filter((id): id is string => !!id))];
    const tables = ids.length ? await prisma.seatTable.findMany({ where: { invitationId: invite.id, id: { in: ids } } }) : [];
    const byId = new Map(tables.map((t) => [t.id, t]));
    const seated = new Map<string, GuestViewTable>();
    const waiting: GuestViewGroup = { people: [], others: 0 };
    for (const p of persons) {
      const t = p.tableId ? byId.get(p.tableId) : undefined;
      if (!t) { add(waiting, p.name); continue; }
      if (!seated.has(t.id)) seated.set(t.id, { name: t.name, title: tableTitle(t.name), people: [], others: 0 });
      add(seated.get(t.id)!, p.name);
    }
    view.tables = [...seated.values()];
    if (view.tables.length && (waiting.people.length || waiting.others)) view.waiting = waiting;
  }

  if (settings.showMenu) {
    const options = await prisma.menuOption.findMany({ where: { invitationId: invite.id }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] });
    const label = new Map(options.map((o) => [o.id, o.label]));
    view.menu = options.map((o) => ({ label: o.label, note: o.note }));
    view.dishes = persons
      .map((p) => ({ name: p.name.trim(), dish: (p.menuOptionId && label.get(p.menuOptionId)) || (p.menuReview ? 'уточняется' : '') }))
      .filter((d) => d.dish);
  }

  return view.tables.length || view.dishes.length || view.menu.length ? view : null;
}
