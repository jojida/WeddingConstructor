'use client';
import { useMemo, useRef, useState, type MutableRefObject } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  DEFAULT_FILTERS, errorText, indexSnapshot, nextTableName, peopleText, plural, tableTitle, type PlannerPerson, type PlannerSnapshot, type PlannerTable,
  type PoolFilters, type SnapshotIndex,
} from '@/lib/planner';
import type { PlannerCtl } from './usePlanner';
import GuestPool from './GuestPool';
import TableCard from './TableCard';
import { AutoDialog, BulkDialog, ConfirmDialog, FillTableDialog, GuestDialog, ImportDialog, SeatPicker, TableDialog } from './Dialogs';
import styles from './planner.module.css';

/** Всё, что нужно вложенным карточкам: данные, действия и перетаскивание. */
export interface BoardCtl {
  planner: PlannerCtl;
  snap: PlannerSnapshot;
  index: SnapshotIndex;
  pick(ids: string[], title: string): void;
  unseat(ids: string[]): void;
  editTable(t: PlannerTable): void;
  deleteTable(t: PlannerTable): void;
  fillTable(t: PlannerTable): void;
  patchPerson(id: string, patch: Record<string, unknown>): Promise<void>;
  addPerson(partyKey: string, name: string): Promise<void>;
  setTag(partyKey: string, tag: string): Promise<void>;
  dragIds: MutableRefObject<string[] | null>;
  dragStart(ids: string[]): void;
  dragEnd(): void;
  dropOn(tableId: string | null): void;
}

type Dialog =
  | { kind: 'table'; table?: PlannerTable }
  | { kind: 'deleteTable'; table: PlannerTable }
  | { kind: 'fill'; tableId: string }
  | { kind: 'seat'; ids: string[]; title: string }
  | { kind: 'bulk' } | { kind: 'guest' } | { kind: 'import' } | { kind: 'auto' };

export default function SeatingBoard({ planner, snap }: { planner: PlannerCtl; snap: PlannerSnapshot }) {
  const index = useMemo(() => indexSnapshot(snap), [snap]);
  const [filters, setFilters] = useState<PoolFilters>(DEFAULT_FILTERS);
  const [pane, setPane] = useState<'guests' | 'tables'>('guests');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const dragIds = useRef<string[] | null>(null);
  const { act } = planner;

  const seat = async (ids: string[], tableId: string | null): Promise<boolean> =>
    (await act('post', '/seat', { personIds: ids, tableId })).ok;

  const ctl: BoardCtl = {
    planner, snap, index, dragIds,
    pick: (ids, title) => setDialog({ kind: 'seat', ids, title }),
    unseat: (ids) => { void seat(ids, null); },
    editTable: (table) => setDialog({ kind: 'table', table }),
    deleteTable: (table) => setDialog({ kind: 'deleteTable', table }),
    fillTable: (table) => setDialog({ kind: 'fill', tableId: table.id }),
    patchPerson: async (id, patch) => { await act('put', `/persons/${id}`, patch); },
    addPerson: async (partyKey, name) => { await act('post', '/persons', { partyKey, name }); },
    setTag: async (partyKey, tag) => { await act('put', `/parties/${encodeURIComponent(partyKey)}/tag`, { tag }); },
    dragStart: (ids) => { dragIds.current = ids; },
    dragEnd: () => { dragIds.current = null; },
    dropOn: (tableId) => {
      const ids = dragIds.current;
      dragIds.current = null;
      if (ids?.length) void seat(ids, tableId);
    },
  };

  const seatedBy = useMemo(() => {
    const map = new Map<string, PlannerPerson[]>();
    const order = new Map(snap.parties.map((p, i) => [p.key, i]));
    for (const p of snap.persons) {
      if (p.excluded || !p.tableId) continue;
      const list = map.get(p.tableId);
      if (list) list.push(p); else map.set(p.tableId, [p]);
    }
    for (const list of map.values()) list.sort((a, b) => (order.get(a.partyKey) ?? 0) - (order.get(b.partyKey) ?? 0) || a.slot - b.slot);
    return map;
  }, [snap]);

  const h = snap.summary.headcount;
  const seated = snap.tables.reduce((n, t) => n + t.occupied, 0);
  const toSeat = h.yes.count + h.maybe.count + h.none.count;
  const sm = snap.summary.seating;
  const unseenNotices = snap.notices.filter((n) => !n.seen);

  const showStatus = (status: PoolFilters['status'], unseatedOnly = false) => {
    setFilters({ ...DEFAULT_FILTERS, status, unseatedOnly });
    setPane('guests');
  };

  const download = async () => {
    try {
      const res = await api.get(`/api/planner/${planner.inviteId}/export.csv`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'gosti-i-stoly.csv';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error(errorText(e)); }
  };

  const stats: { label: string; num: number; note?: string; color?: string; onClick: () => void; active?: boolean }[] = [
    { label: 'Придут', num: h.yes.count, note: h.yesChildren.count ? `из них детей ${h.yesChildren.count}` : undefined, color: 'var(--yes)', onClick: () => showStatus('yes'), active: filters.status === 'yes' },
    { label: 'Пока не знают', num: h.maybe.count, color: 'var(--maybe)', onClick: () => showStatus('maybe'), active: filters.status === 'maybe' },
    { label: 'Без ответа', num: h.none.count, color: 'var(--none)', onClick: () => showStatus('none'), active: filters.status === 'none' },
    { label: 'Отказались', num: h.no.count, color: 'var(--no)', onClick: () => showStatus('no'), active: filters.status === 'no' },
    { label: 'Посажено', num: seated, note: toSeat ? `из ${toSeat}` : undefined, onClick: () => setPane('tables') },
    { label: 'Без стола', num: sm.unseated.count, onClick: () => showStatus('all', true), active: filters.status === 'all' && filters.unseatedOnly },
  ];

  // «Добавить стол» — сразу, без окна: следующий номер, столько же мест, как у последнего.
  // Название и места потом меняются карандашом на карточке.
  const latest = [...snap.tables].sort((a, b) => b.sort - a.sort)[0];
  const addTable = () => act('post', '/tables', { name: nextTableName(snap.tables), capacity: latest?.capacity ?? 8, shape: latest?.shape ?? 'round' });
  const canAdd = snap.tables.length < snap.limits.tables;

  const dlg = dialog;
  const fillTable = dlg?.kind === 'fill' ? index.tableById.get(dlg.tableId) : undefined;

  // «Ваш стол» на сайте увидят только группы с персональной ссылкой (kind 'guest')
  const seatedParties = new Set(snap.persons.filter((p) => !p.excluded && p.tableId).map((p) => p.partyKey));
  const linked = snap.parties.filter((p) => seatedParties.has(p.key) && p.kind === 'guest').length;

  return (
    <div>
      <div className={styles.stats}>
        {stats.map((s) => (
          <button key={s.label} type="button" className={`${styles.stat} ${s.active ? styles.statActive : ''}`} onClick={s.onClick}>
            <div className={styles.statNum} style={s.color ? { color: s.color } : undefined}>{s.num}</div>
            <div className={styles.statLabel}>{s.label}</div>
            {s.note && <div className={styles.statNote}>{s.note}</div>}
          </button>
        ))}
      </div>

      {unseenNotices.length > 0 && (
        <div role="status" aria-live="polite">
          {unseenNotices.map((n) => (
            <div key={n.id} className={styles.notice}>
              <p>🔔 {n.text}</p>
            </div>
          ))}
          <button type="button" className={`${styles.btn} ${styles.btnSmall}`} style={{ marginBottom: 12 }} onClick={() => act('post', '/notices/seen', {})}>Понятно</button>
        </div>
      )}

      {snap.parties.length > 0 && (
        <div className={styles.todo}>
          <div className={styles.todoTitle}>Что осталось</div>
          <ul className={styles.todoList}>
            {snap.tables.length === 0 && (
              <li className={styles.todoItem}>
                <span>Добавьте столы</span>
                <span className={styles.todoActions}>
                  <button type="button" className={styles.link} onClick={() => setDialog({ kind: 'table' })}>один стол</button>
                  <button type="button" className={styles.link} onClick={() => setDialog({ kind: 'bulk' })}>сразу несколько</button>
                </span>
              </li>
            )}
            {snap.tables.length > 0 && sm.unseated.count > 0 && (
              <li className={styles.todoItem}>
                <span>Не за столом: <b>{peopleText(sm.unseated.count)}</b></span>
                <span className={styles.todoActions}>
                  <button type="button" className={styles.link} onClick={() => showStatus('all', true)}>показать</button>
                  <button type="button" className={styles.link} onClick={() => setDialog({ kind: 'auto' })}>рассадить автоматически</button>
                </span>
              </li>
            )}
            {sm.unnamed.count > 0 && (
              <li className={styles.todoItem}>
                <span>Без имени: <b>{peopleText(sm.unnamed.count)}</b> — состав нужно уточнить</span>
                <span className={styles.todoActions}>
                  <button type="button" className={styles.link} onClick={() => { setFilters({ ...DEFAULT_FILTERS, unseatedOnly: false, unnamed: true }); setPane('guests'); }}>показать</button>
                </span>
              </li>
            )}
            {sm.excess.map((e) => (
              <li key={e.partyKey} className={styles.todoItem}>
                «{e.label}»: гость указал {e.want}, а в списке {e.have}
              </li>
            ))}
            {snap.tables.length > 0 && sm.unseated.count === 0 && sm.unnamed.count === 0 && sm.excess.length === 0 && (
              <li className={`${styles.todoItem} ${styles.todoDone}`}>✓ Все гости за столами и названы</li>
            )}
          </ul>
        </div>
      )}

      <section className={styles.panel} style={{ padding: '6px 14px' }}>
        <label className={styles.switchRow}>
          <input type="checkbox" checked={snap.settings.showTable} disabled={planner.pending > 0}
            onChange={(e) => act('put', '/settings', { showTable: e.target.checked })} />
          <span>
            <b>Показывать гостям их стол на сайте</b>
            <span className={styles.hint} style={{ display: 'block' }}>
              Гость, открывший свою персональную ссылку, увидит плашку «Ваш стол». Включите, когда рассадка готова.
              {seatedParties.size > 0 && (linked < seatedParties.size
                ? ` Сейчас увидят ${linked} из ${seatedParties.size} ${plural(seatedParties.size, 'группы', 'групп', 'групп')} за столами: остальные отвечали по общей ссылке, своей у них нет.`
                : ' Своя ссылка есть у всех, кто сидит за столами.')}
            </span>
          </span>
        </label>
      </section>

      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setDialog({ kind: 'table' })}>+ Стол</button>
        <button type="button" className={styles.btn} onClick={() => setDialog({ kind: 'bulk' })}>Столы пачкой</button>
        <button type="button" className={styles.btn} onClick={() => setDialog({ kind: 'guest' })}>+ Гость</button>
        <button type="button" className={styles.btn} onClick={() => setDialog({ kind: 'import' })}>Вставить список</button>
        <button type="button" className={styles.btn} onClick={() => setDialog({ kind: 'auto' })} disabled={snap.tables.length === 0}>Рассадить автоматически</button>
        <button type="button" className={styles.btn} onClick={download}>Скачать CSV</button>
      </div>

      <div className={styles.switch} role="group" aria-label="Что показать">
        <button type="button" className={`${styles.btn} ${pane === 'guests' ? styles.switchOn : ''}`} aria-pressed={pane === 'guests'} onClick={() => setPane('guests')}>Гости</button>
        <button type="button" className={`${styles.btn} ${pane === 'tables' ? styles.switchOn : ''}`} aria-pressed={pane === 'tables'} onClick={() => setPane('tables')}>Столы · {snap.tables.length}</button>
      </div>

      <div className={styles.board}>
        <section className={`${styles.pane} ${pane !== 'guests' ? styles.paneOff : ''}`} aria-label="Гости">
          <h3 className={styles.paneTitle}>Гости <span className={styles.paneHint}>перетащите на стол или нажмите «Посадить»</span></h3>
          <GuestPool ctl={ctl} filters={filters} setFilters={setFilters} />
        </section>
        <section className={`${styles.pane} ${pane !== 'tables' ? styles.paneOff : ''}`} aria-label="Столы">
          <h3 className={styles.paneTitle}>Столы <span className={styles.paneHint}>{snap.tables.length} {plural(snap.tables.length, 'стол', 'стола', 'столов')}</span></h3>
          <p className={styles.planHint}>
            Нажмите на <b>свободное место</b>, чтобы посадить гостя, или перетащите гостя из списка на стол.
            Нажмите на гостя за столом, чтобы пересадить его.
          </p>
          <div className={styles.tables}>
            {index.tables.map((t) => <TableCard key={t.id} table={t} people={seatedBy.get(t.id) ?? []} index={index} ctl={ctl} />)}
            {canAdd && (
              <button type="button" className={styles.addTile} onClick={() => { void addTable(); }} disabled={planner.pending > 0}>
                <span className={styles.addPlus} aria-hidden>+</span>
                Добавить стол
                <span className={styles.addTileHint}>{latest ? `на ${latest.capacity} ${plural(latest.capacity, 'место', 'места', 'мест')}, как предыдущий` : 'круглый, на 8 мест'}</span>
              </button>
            )}
          </div>
        </section>
      </div>

      {dlg?.kind === 'table' && (
        <TableDialog ctl={planner} snap={snap} table={dlg.table} onClose={() => setDialog(null)}
          onDelete={dlg.table ? () => setDialog({ kind: 'deleteTable', table: dlg.table! }) : undefined} />
      )}
      {dlg?.kind === 'deleteTable' && (
        <ConfirmDialog title={`Удалить «${tableTitle(dlg.table.name)}»?`} confirmLabel="Удалить стол" danger busy={planner.pending > 0}
          onClose={() => setDialog(null)}
          onConfirm={async () => { const r = await act('delete', `/tables/${dlg.table.id}?confirm=1`); if (r.ok) setDialog(null); }}>
          {(() => {
            const live = index.tableById.get(dlg.table.id);
            return live && live.occupied > 0
              ? <p style={{ margin: 0 }}>За столом сидят {peopleText(live.occupied)}. Они не пропадут из списка — просто станут «без стола».</p>
              : <p style={{ margin: 0 }}>За столом никто не сидит.</p>;
          })()}
        </ConfirmDialog>
      )}
      {dlg?.kind === 'bulk' && <BulkDialog ctl={planner} snap={snap} onClose={() => setDialog(null)} />}
      {dlg?.kind === 'guest' && <GuestDialog ctl={planner} snap={snap} onClose={() => setDialog(null)} />}
      {dlg?.kind === 'import' && <ImportDialog ctl={planner} snap={snap} onClose={() => setDialog(null)} />}
      {dlg?.kind === 'auto' && <AutoDialog ctl={planner} snap={snap} index={index} onClose={() => setDialog(null)} />}
      {dlg?.kind === 'fill' && fillTable && <FillTableDialog ctl={planner} snap={snap} index={index} table={fillTable} onClose={() => setDialog(null)} />}
      {dlg?.kind === 'seat' && (
        <SeatPicker title={dlg.title} index={index} ids={dlg.ids} onClose={() => setDialog(null)}
          onPick={async (tableId) => { if (await seat(dlg.ids, tableId)) setDialog(null); }}
          onUnseat={() => { void seat(dlg.ids, null).then((ok) => { if (ok) setDialog(null); }); }} />
      )}
    </div>
  );
}
