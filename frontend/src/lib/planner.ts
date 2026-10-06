// Планировщик (меню и рассадка): типы ответа сервера и чистые помощники для кабинета.
// Логика подсчётов живёт на сервере — здесь только раскладка по группам, фильтры и подписи.

export type PlannerStatus = 'yes' | 'maybe' | 'no' | 'none';

export interface PlannerPerson {
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
  status: PlannerStatus;
}

export interface PlannerParty {
  key: string;
  kind: 'guest' | 'response';
  guestId: string | null;
  label: string;
  status: PlannerStatus;
  want: number;
  kids: number;
  seatWish: string;
  note: string;
  answeredAt: string | null;
  createdAt: string;
}

export interface PlannerTable {
  id: string;
  name: string;
  capacity: number;
  shape: 'round' | 'long';
  sort: number;
  occupied: number;
  free: number;
}

export interface PlannerOption { id: string; label: string; note: string; sort: number }
export interface IdList { count: number; ids: string[] }
export interface PlannerNotice { id: string; kind: string; text: string; createdAt: string; seen: boolean }

export interface MenuSplit {
  options: { optionId: string; ids: string[]; count: number }[];
  noChoice: IdList;
  review: IdList;
}

export interface PlannerSnapshot {
  settings: { askMenu: boolean; askDiet: boolean; showMenu: boolean; showTable: boolean };
  options: PlannerOption[];
  tables: PlannerTable[];
  parties: PlannerParty[];
  persons: PlannerPerson[];
  notices: PlannerNotice[];
  summary: {
    headcount: { yes: IdList; yesChildren: IdList; maybe: IdList; no: IdList; none: IdList };
    menu: { options: { optionId: string; label: string; ids: string[]; count: number }[]; noChoice: IdList; review: IdList };
    diet: IdList;
    seating: {
      unseated: IdList;
      unnamed: IdList;
      excess: { partyKey: string; label: string; want: number; have: number }[];
    };
    tables: { id: string; yes: number; maybe: number; none: number; menu: MenuSplit }[];
  };
  limits: {
    persons: number; tables: number; options: number; capacityMax: number; name: number; tag: number; diet: number;
    tableName: number; optionLabel: number; optionNote: number; seatBatch: number; importLines: number; partyPeople: number;
  };
}

export const STATUS_LABEL: Record<PlannerStatus, string> = {
  yes: 'Придёт', maybe: 'Пока не знает', no: 'Не придёт', none: 'Нет ответа',
};
export const STATUS_COLOR: Record<PlannerStatus, string> = {
  yes: '#2e8b57', maybe: '#b8862e', no: '#b85c5c', none: '#a39b8e',
};

/** 1 стол, 2 стола, 5 столов. */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
export const peopleText = (n: number): string => `${n} ${plural(n, 'человек', 'человека', 'человек')}`;
export const seatsText = (n: number): string => `${n} ${plural(n, 'место', 'места', 'мест')}`;

/** Для поиска: регистр, «ё» и лишние пробелы не важны. */
export const norm = (s: string): string => s.normalize('NFC').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

export const naturalCompare = (a: string, b: string): number => a.localeCompare(b, 'ru', { numeric: true });

/** «Денис и Мария», «Анна, Пётр», «Иван + 1» — это не одно имя. */
export const looksSingle = (names: string): boolean => !/[,&+]|(^|\s)(и|с)(\s|$)/i.test(names);

/** Имя для списков. Если гость не назван — подпись без выдуманного имени. */
export function personTitle(p: Pick<PlannerPerson, 'name' | 'slot'>): string {
  return p.name || `Гость ${p.slot + 1} (без имени)`;
}

/** Люди по группам в порядке номеров; убранные из списка — отдельно. */
export function indexSnapshot(snap: PlannerSnapshot) {
  const byParty = new Map<string, PlannerPerson[]>();
  for (const p of snap.persons) {
    const list = byParty.get(p.partyKey);
    if (list) list.push(p); else byParty.set(p.partyKey, [p]);
  }
  for (const list of byParty.values()) list.sort((a, b) => a.slot - b.slot);
  const tables = [...snap.tables].sort((a, b) => naturalCompare(a.name, b.name));
  return {
    byParty,
    tables,
    tableById: new Map(snap.tables.map((t) => [t.id, t])),
    partyByKey: new Map(snap.parties.map((p) => [p.key, p])),
    optionById: new Map(snap.options.map((o) => [o.id, o])),
    personById: new Map(snap.persons.map((p) => [p.id, p])),
  };
}
export type SnapshotIndex = ReturnType<typeof indexSnapshot>;

export interface PoolFilters {
  q: string;
  status: 'all' | PlannerStatus;
  unseatedOnly: boolean;
  unnamed: boolean;     // только люди без имени — «состав нужно уточнить»
  tag: string;
}
export const DEFAULT_FILTERS: PoolFilters = { q: '', status: 'all', unseatedOnly: true, unnamed: false, tag: '' };

/** Кого показать в списке гостей: группы с подходящими людьми и сами эти люди. */
export function filterPool(snap: PlannerSnapshot, index: SnapshotIndex, f: PoolFilters) {
  const q = norm(f.q);
  const out: { party: PlannerParty; people: PlannerPerson[]; total: number }[] = [];
  for (const party of snap.parties) {
    const all = (index.byParty.get(party.key) ?? []).filter((p) => !p.excluded);
    if (!all.length) continue;
    if (f.status !== 'all' ? party.status !== f.status : party.status === 'no') continue;
    const partyHit = !q || norm(party.label).includes(q);
    const people = all.filter((p) => {
      if (f.unseatedOnly && p.tableId) return false;
      if (f.unnamed && p.name) return false;
      if (f.tag && p.tag !== f.tag) return false;
      return partyHit || norm(p.name).includes(q) || norm(p.tag).includes(q);
    });
    if (people.length) out.push({ party, people, total: all.length });
  }
  return out;
}

/** «Стол 5» для номеров и коротких названий, а слово («Молодожёны») — как есть. */
export function tableTitle(name: string): string {
  return /^\p{L}?\d{1,3}\p{L}?$/u.test(name) || name.length <= 2 ? `Стол ${name}` : name;
}

/** Номер для нового стола: наименьший свободный. */
export function nextTableName(tables: PlannerTable[]): string {
  const used = new Set(tables.map((t) => t.name));
  for (let n = 1; n < 1000; n++) if (!used.has(String(n))) return String(n);
  return '';
}

/** Сколько столов нужно на столько-то гостей при такой вместимости. */
export const tablesNeeded = (guests: number, capacity: number): number => (capacity > 0 ? Math.ceil(guests / capacity) : 0);

/** Текст ошибки из ответа сервера (он уже по-русски). */
export function errorText(e: unknown, fallback = 'Не получилось. Попробуйте ещё раз'): string {
  const data = (e as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof data?.error === 'string' && data.error ? data.error : fallback;
}
