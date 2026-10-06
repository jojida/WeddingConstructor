// Авторассадка: раскладывает нераспределённых по свободным местам, не разделяя группы без нужды.
// Предпросмотр (dryRun) ничего не пишет; при применении каждый стол занимается через ту же
// проверку вместимости в SQL, что и ручная посадка, — гонка с другой вкладкой не страшна.
import { PlannerError } from './util';
import { assignPersons } from './seating';
import { loadPeople } from './snapshot';

export interface AutoTable { id: string; free: number; tags: string[]; order: number }
export interface AutoGroup { key: string; tag: string; ids: string[]; order: number; anchor?: string }
export interface AutoPlan { placements: { personId: string; tableId: string }[]; unplaced: string[] }

/** Чистый алгоритм. Сначала группы с метками («Семья жениха») — подряд и крупные первыми, затем остальные.
    Группа целиком садится за стол, где хватает мест: сначала туда, где уже сидит кто-то из неё самой (anchor),
    затем где сидит кто-то с той же меткой, затем в самый плотный (чтобы не плодить «дыры»). Не помещается
    целиком — делится: сперва добивает стол, где уже сидят свои, потом по самым свободным столам. */
export function planAutoseat(tables: AutoTable[], groups: AutoGroup[]): AutoPlan {
  const free = new Map(tables.map((t) => [t.id, t.free]));
  const tags = new Map(tables.map((t) => [t.id, new Set(t.tags)]));
  const order = new Map(tables.map((t) => [t.id, t.order]));
  const placements: AutoPlan['placements'] = [];
  const unplaced: string[] = [];

  const put = (ids: string[], tableId: string, tag: string) => {
    for (const personId of ids) placements.push({ personId, tableId });
    free.set(tableId, (free.get(tableId) ?? 0) - ids.length);
    if (tag) tags.get(tableId)?.add(tag);
  };

  const ordered = [...groups].sort((a, b) =>
    (a.tag ? 0 : 1) - (b.tag ? 0 : 1) || a.tag.localeCompare(b.tag, 'ru') || b.ids.length - a.ids.length || a.order - b.order);

  for (const g of ordered) {
    const fits = tables.filter((t) => (free.get(t.id) ?? 0) >= g.ids.length);
    if (fits.length) {
      fits.sort((a, b) => {
        const same = (id: string) => (g.tag && tags.get(id)?.has(g.tag) ? 0 : 1);
        const own = (id: string) => (g.anchor === id ? 0 : 1);
        return own(a.id) - own(b.id)
          || same(a.id) - same(b.id)
          || ((free.get(a.id) ?? 0) - g.ids.length) - ((free.get(b.id) ?? 0) - g.ids.length)
          || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
      });
      put(g.ids, fits[0].id, g.tag);
      continue;
    }
    const rest = [...g.ids];
    const roomy = tables.filter((t) => (free.get(t.id) ?? 0) > 0)
      .sort((a, b) => (g.anchor === a.id ? 0 : 1) - (g.anchor === b.id ? 0 : 1)
        || (free.get(b.id) ?? 0) - (free.get(a.id) ?? 0) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    for (const t of roomy) {
      if (!rest.length) break;
      put(rest.splice(0, Math.min(free.get(t.id) ?? 0, rest.length)), t.id, g.tag);
    }
    unplaced.push(...rest);
  }
  return { placements, unplaced };
}

export interface AutoOptions { dryRun: boolean; includeMaybe: boolean; includeNone: boolean; tableIds?: string[] }

export async function autoseat(inviteId: string, opts: AutoOptions): Promise<AutoPlan & { applied: boolean }> {
  const { people, parties, tables } = await loadPeople(inviteId);
  const wanted = new Set<string>(['yes', ...(opts.includeMaybe ? ['maybe'] : []), ...(opts.includeNone ? ['none'] : [])]);
  const active = people.filter((p) => !p.excluded);

  const partyOrder = new Map(parties.map((p, i) => [p.key, i]));
  const byParty = new Map<string, string[]>();
  const tagOfParty = new Map<string, string>();
  for (const p of active) {
    if (p.tableId || !wanted.has(p.status)) continue;
    const list = byParty.get(p.partyKey);
    if (list) list.push(p.id); else byParty.set(p.partyKey, [p.id]);
    if (p.tag && !tagOfParty.has(p.partyKey)) tagOfParty.set(p.partyKey, p.tag);
  }
  // Кто из группы уже сидит — за тем же столом ищем места остальным
  const anchorOf = new Map<string, string>();
  const seatedCount = new Map<string, number>();
  for (const p of active) {
    if (!p.tableId || p.status === 'no') continue;
    const k = `${p.partyKey}|${p.tableId}`;
    const n = (seatedCount.get(k) ?? 0) + 1;
    seatedCount.set(k, n);
    const best = anchorOf.get(p.partyKey);
    if (!best || n > (seatedCount.get(`${p.partyKey}|${best}`) ?? 0)) anchorOf.set(p.partyKey, p.tableId);
  }
  const groups: AutoGroup[] = [...byParty.entries()].map(([key, ids]) => ({
    key, ids, tag: tagOfParty.get(key) ?? '', order: partyOrder.get(key) ?? 0, anchor: anchorOf.get(key),
  }));

  // Особые столы (молодожёны, дети) владелец может исключить: тогда на них сажаем только вручную
  const allowed = opts.tableIds ? new Set(opts.tableIds) : null;
  const autoTables: AutoTable[] = tables.filter((t) => !allowed || allowed.has(t.id)).map((t, order) => {
    const seated = active.filter((p) => p.tableId === t.id);
    return {
      id: t.id, order,
      free: Math.max(0, t.capacity - seated.length),
      tags: [...new Set(seated.map((p) => p.tag).filter(Boolean))],
    };
  });

  const plan = planAutoseat(autoTables, groups);
  if (opts.dryRun) return { ...plan, applied: false };

  // Применяем по столам: если место успели занять с другой вкладки, этих людей оставляем нераспределёнными
  const perTable = new Map<string, string[]>();
  for (const { personId, tableId } of plan.placements) {
    const list = perTable.get(tableId);
    if (list) list.push(personId); else perTable.set(tableId, [personId]);
  }
  const placements: AutoPlan['placements'] = [];
  const unplaced = [...plan.unplaced];
  for (const [tableId, ids] of perTable) {
    try {
      await assignPersons(inviteId, ids, tableId);
      for (const personId of ids) placements.push({ personId, tableId });
    } catch (e) {
      if (!(e instanceof PlannerError)) throw e;
      unplaced.push(...ids);
    }
  }
  return { placements, unplaced, applied: true };
}
