'use client';
import { useMemo, useState, type FormEvent } from 'react';
import {
  DEFAULT_FILTERS, STATUS_COLOR, STATUS_LABEL, filterPool, naturalCompare, peopleText, personTitle, tableTitle,
  type PlannerParty, type PlannerPerson, type PoolFilters,
} from '@/lib/planner';
import type { BoardCtl } from './SeatingBoard';
import { MenuItem, Popover } from './ui';
import styles from './planner.module.css';

const STATUS_CHIPS: { value: PoolFilters['status']; label: string }[] = [
  { value: 'all', label: 'Все' }, { value: 'yes', label: 'Придут' }, { value: 'maybe', label: 'Не знают' },
  { value: 'none', label: 'Без ответа' }, { value: 'no', label: 'Отказались' },
];

/* ── Один человек ─────────────────────────────────────────────────────────── */
function PersonRow({ p, party, ctl }: { p: PlannerPerson; party: PlannerParty; ctl: BoardCtl }) {
  const { index, snap } = ctl;
  const [editing, setEditing] = useState(false);
  const table = p.tableId ? index.tableById.get(p.tableId) : undefined;
  const canSeat = party.status !== 'no';

  const save = async (value: string) => {
    setEditing(false);
    if (value.trim() !== p.name) await ctl.patchPerson(p.id, { name: value.trim() });
  };

  return (
    <li className={`${styles.person} ${canSeat ? styles.personDrag : ''}`} draggable={canSeat}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; ctl.dragStart([p.id]); }}
      onDragEnd={() => ctl.dragEnd()}>
      <span className={styles.dot} style={{ background: STATUS_COLOR[p.status] }} title={STATUS_LABEL[p.status]} />
      {editing ? (
        <input className={`${styles.input} ${styles.nameInput}`} defaultValue={p.name} autoFocus maxLength={snap.limits.name}
          aria-label="Имя гостя" placeholder="Имя"
          onBlur={(e) => save(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save((e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditing(false); }} />
      ) : (
        <button type="button" className={styles.nameBtn} onClick={() => setEditing(true)} title="Изменить имя">
          {p.name || <span className={styles.unnamed}>{personTitle(p)}</span>}
        </button>
      )}
      {p.isChild && <span className={styles.badge}>ребёнок</span>}
      {canSeat && (table
        ? <button type="button" className={styles.tableBadge} onClick={() => ctl.pick([p.id], p.name || `${personTitle(p)} · ${party.label}`)} aria-label={`${tableTitle(table.name)}, пересадить`}>{tableTitle(table.name)} ▾</button>
        : <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => ctl.pick([p.id], p.name || `${personTitle(p)} · ${party.label}`)}>Посадить</button>)}
      <Popover label={`Действия: ${personTitle(p)}`} button="⋯">
        {(close) => (
          <>
            <MenuItem onClick={() => { close(); setEditing(true); }}>Изменить имя</MenuItem>
            <MenuItem onClick={() => { close(); void ctl.patchPerson(p.id, { isChild: !p.isChild }); }}>{p.isChild ? 'Это не ребёнок' : 'Это ребёнок'}</MenuItem>
            {table && <MenuItem onClick={() => { close(); ctl.unseat([p.id]); }}>Снять со стола</MenuItem>}
            <MenuItem danger onClick={() => { close(); void ctl.patchPerson(p.id, { excluded: true }); }}>Убрать из списка</MenuItem>
          </>
        )}
      </Popover>
    </li>
  );
}

/* ── Группа: семья, пара, одиночный гость ─────────────────────────────────── */
function PartyCard({ party, people, total, ctl }: { party: PlannerParty; people: PlannerPerson[]; total: number; ctl: BoardCtl }) {
  const { snap } = ctl;
  const [mode, setMode] = useState<null | 'add' | 'tag'>(null);
  const loose = people.filter((p) => !p.tableId);
  const unnamed = people.some((p) => !p.name);
  const excess = snap.summary.seating.excess.find((e) => e.partyKey === party.key);
  const tag = people.find((p) => p.tag)?.tag ?? '';

  const submitAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem('name') as HTMLInputElement;
    await ctl.addPerson(party.key, input.value.trim());
    setMode(null);
  };
  const submitTag = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem('tag') as HTMLInputElement;
    await ctl.setTag(party.key, input.value.trim());
    setMode(null);
  };

  return (
    <li className={styles.party} style={{ listStyle: 'none' }}>
      <div className={styles.partyHead}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className={styles.partyName}>{party.label}</div>
          <div className={styles.partyMeta}>
            <span style={{ color: STATUS_COLOR[party.status], fontWeight: 600 }}>{STATUS_LABEL[party.status]}</span>
            {' · '}{peopleText(total)}
            {party.kind === 'response' && ' · по общей ссылке'}
            {tag && ` · ${tag}`}
          </div>
        </div>
        <div className={styles.partyBtns}>
          {party.status !== 'no' && loose.length > 1 && (
            <button type="button" className={`${styles.btn} ${styles.btnSmall}`} draggable
              onDragStart={(e) => { e.dataTransfer.setData('text/plain', loose.map((p) => p.id).join(',')); ctl.dragStart(loose.map((p) => p.id)); }}
              onDragEnd={() => ctl.dragEnd()}
              onClick={() => ctl.pick(loose.map((p) => p.id), `${party.label}: все ${loose.length}`)}>Посадить всех</button>
          )}
          <Popover label={`Действия: ${party.label}`} button="⋯">
            {(close) => (
              <>
                <MenuItem onClick={() => { close(); setMode('add'); }}>Добавить человека</MenuItem>
                <MenuItem onClick={() => { close(); setMode('tag'); }}>{tag ? 'Изменить метку группы' : 'Метка группы…'}</MenuItem>
              </>
            )}
          </Popover>
        </div>
      </div>
      {party.seatWish && <div className={styles.partyNote}>💬 С кем сидеть: {party.seatWish}</div>}
      {unnamed && party.status !== 'no' && <div className={styles.partyWarn}>⚠ Есть гости без имени — состав нужно уточнить. Нажмите на имя, чтобы вписать.</div>}
      {excess && <div className={styles.partyWarn}>⚠ Гость указал {excess.want}, а в списке {excess.have}. Уберите лишних или оставьте как есть.</div>}
      <ul className={styles.people}>
        {people.map((p) => <PersonRow key={p.id} p={p} party={party} ctl={ctl} />)}
      </ul>
      {mode === 'add' && (
        <form className={styles.row} style={{ marginTop: 8 }} onSubmit={submitAdd}>
          <input name="name" className={`${styles.input} ${styles.grow}`} autoFocus maxLength={snap.limits.name} placeholder="Имя (можно не знать)" aria-label="Имя нового гостя" />
          <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}>Добавить</button>
          <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => setMode(null)}>Отмена</button>
        </form>
      )}
      {mode === 'tag' && (
        <form className={styles.row} style={{ marginTop: 8 }} onSubmit={submitTag}>
          <input name="tag" className={`${styles.input} ${styles.grow}`} autoFocus defaultValue={tag} maxLength={snap.limits.tag} list="planner-tags" placeholder="Например: Семья жениха" aria-label="Метка группы" />
          <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}>Сохранить</button>
          <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => setMode(null)}>Отмена</button>
        </form>
      )}
    </li>
  );
}

/* ── Список гостей ────────────────────────────────────────────────────────── */
export default function GuestPool({ ctl, filters, setFilters }: { ctl: BoardCtl; filters: PoolFilters; setFilters: (f: PoolFilters) => void }) {
  const { snap, index } = ctl;
  const [over, setOver] = useState(false);
  const pool = useMemo(() => filterPool(snap, index, filters), [snap, index, filters]);
  const tags = useMemo(() => [...new Set(snap.persons.filter((p) => !p.excluded && p.tag).map((p) => p.tag))].sort(naturalCompare), [snap.persons]);
  const hidden = snap.persons.filter((p) => p.excluded);
  const h = snap.summary.headcount;
  const count: Record<PoolFilters['status'], number> = { all: h.yes.count + h.maybe.count + h.none.count, yes: h.yes.count, maybe: h.maybe.count, none: h.none.count, no: h.no.count };
  const patch = (p: Partial<PoolFilters>) => setFilters({ ...filters, ...p });
  const dirty = filters.q || filters.status !== 'all' || filters.tag || filters.unnamed || !filters.unseatedOnly;

  return (
    <div className={`${styles.poolDrop} ${over ? styles.dropOver : ''}`}
      onDragOver={(e) => { if (ctl.dragIds.current) { e.preventDefault(); setOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); ctl.dropOn(null); }}>
      <div className={styles.filters}>
        <input className={styles.input} type="search" value={filters.q} onChange={(e) => patch({ q: e.target.value })}
          placeholder="Поиск по имени, группе или метке" aria-label="Поиск гостя" />
        <div className={styles.chips} role="group" aria-label="Фильтр по ответу">
          {STATUS_CHIPS.map((c) => (
            <button key={c.value} type="button" className={`${styles.chip} ${filters.status === c.value ? styles.chipOn : ''}`}
              aria-pressed={filters.status === c.value} onClick={() => patch({ status: c.value })}>{c.label} {count[c.value]}</button>
          ))}
        </div>
        <div className={styles.row}>
          <label className={styles.check}><input type="checkbox" checked={filters.unseatedOnly} onChange={(e) => patch({ unseatedOnly: e.target.checked })} /> только без стола</label>
          <label className={styles.check}><input type="checkbox" checked={filters.unnamed} onChange={(e) => patch({ unnamed: e.target.checked })} /> только без имени</label>
          {tags.length > 0 && (
            <select className={styles.select} style={{ width: 'auto', minHeight: 32, padding: '3px 10px', fontSize: 13 }} value={filters.tag} onChange={(e) => patch({ tag: e.target.value })} aria-label="Метка группы">
              <option value="">Все метки</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {dirty && <button type="button" className={styles.link} onClick={() => setFilters(DEFAULT_FILTERS)}>Сбросить</button>}
        </div>
      </div>
      <datalist id="planner-tags">{tags.map((t) => <option key={t} value={t} />)}</datalist>

      {pool.length === 0 ? (
        <p className={styles.note}>
          {snap.parties.length === 0 ? 'Гостей пока нет. Добавьте первого или вставьте список имён.'
            : filters.unseatedOnly && !dirty ? 'Все гости за столами 🎉' : 'Никого не нашлось. Попробуйте сбросить фильтры.'}
        </p>
      ) : (
        <ul className={styles.pool} style={{ margin: 0, padding: 0 }} aria-label="Гости">
          {pool.map(({ party, people, total }) => <PartyCard key={party.key} party={party} people={people} total={total} ctl={ctl} />)}
        </ul>
      )}

      {hidden.length > 0 && (
        <details className={styles.hidden}>
          <summary>Убранные из списка ({hidden.length})</summary>
          <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
            {hidden.map((p) => (
              <li key={p.id} className={styles.row} style={{ padding: '4px 0' }}>
                <span className={styles.grow} style={{ overflowWrap: 'anywhere' }}>{p.name || personTitle(p)} · {index.partyByKey.get(p.partyKey)?.label}</span>
                <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => ctl.patchPerson(p.id, { excluded: false })}>Вернуть</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
