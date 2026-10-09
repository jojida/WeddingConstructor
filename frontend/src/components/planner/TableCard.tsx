'use client';
import { useState, type CSSProperties } from 'react';
import { STATUS_COLOR, STATUS_LABEL, personTitle, seatsText, tableTitle, type PlannerPerson, type PlannerTable, type SnapshotIndex } from '@/lib/planner';
import type { BoardCtl } from './SeatingBoard';
import styles from './planner.module.css';

/* ── Раскладка мест (как на seatory.ru): большой стол, вокруг — «таблички» с номером
   места и именем. Считается в условных единицах, рисуется в процентах и cqw, поэтому
   схема целиком масштабируется под ширину карточки. Номер места — это порядок за
   столом в списке, а не сохранённое место. */
const PILL_L = 124;   // длина таблички
const PILL_H = 38;    // её высота
const GAP = 8;        // от края стола до таблички
const MAX_DRAWN = 20; // больше мест — списком: таблички стали бы нечитаемо мелкими

interface SeatSpot { x: number; y: number; deg: number; flip: boolean }
interface Layout { w: number; h: number; table: { x: number; y: number; w: number; h: number; round: boolean }; seats: SeatSpot[] }

function layout(shape: PlannerTable['shape'], n: number): Layout {
  if (shape === 'long') {
    const top = Math.ceil(n / 2), bottom = n - top;
    const rw = Math.max(150, top * (PILL_H + 10) + 16), rh = 64;
    const w = rw + 24, h = rh + 2 * (GAP + PILL_L) + 8;
    const tx = w / 2, ty = h / 2;
    const row = (count: number, i: number) => (w - rw) / 2 + 8 + ((rw - 16) / count) * (i + 0.5);
    const seats: SeatSpot[] = [
      ...Array.from({ length: top }, (_, i) => ({ x: row(top, i), y: ty - rh / 2 - GAP - PILL_L / 2, deg: -90, flip: false })),
      ...Array.from({ length: bottom }, (_, i) => ({ x: row(bottom, i), y: ty + rh / 2 + GAP + PILL_L / 2, deg: 90, flip: false })),
    ];
    return { w, h, table: { x: tx, y: ty, w: rw, h: rh, round: false }, seats };
  }
  // Внутренний край табличек — на окружности, где соседние не налезают друг на друга
  const inner = Math.max(78, (n * (PILL_H + 6)) / (2 * Math.PI));
  const s = 2 * (inner + PILL_L) + 8, c = s / 2, r = inner + PILL_L / 2;
  const seats = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;   // первое место сверху, дальше по часовой
    const flip = Math.cos(a) < -1e-6;                 // слева — текст не вверх ногами, номер у стола
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a), deg: (a * 180) / Math.PI + (flip ? 180 : 0), flip };
  });
  const d = 2 * (inner - GAP);
  return { w: s, h: s, table: { x: c, y: c, w: d, h: d, round: true }, seats };
}

function Plan({ table, people, ctl }: { table: PlannerTable; people: PlannerPerson[]; ctl: BoardCtl }) {
  const L = layout(table.shape, table.capacity);
  const u = (v: number) => `${(v * 100) / L.w}cqw`;           // условные единицы → ширина схемы
  const at = (x: number, y: number): CSSProperties => ({ left: `${(x / L.w) * 100}%`, top: `${(y / L.h) * 100}%` });
  const t = L.table;
  return (
    <div className={styles.plan} style={{ aspectRatio: `${L.w} / ${L.h}`, maxWidth: L.w * 1.25 }}>
      <button type="button" className={styles.planTable} onClick={() => ctl.editTable(table)} title="Изменить стол"
        style={{ ...at(t.x, t.y), width: u(t.w), height: u(t.h), borderRadius: t.round ? '50%' : u(16), fontSize: u(14) }}>
        <span className={styles.planTableName} style={{ fontSize: u(19) }}>{tableTitle(table.name)}</span>
        <span className={styles.planTableCount}>{table.occupied}/{table.capacity}</span>
      </button>
      {L.seats.map((s, i) => {
        const p = people[i];
        const style: CSSProperties = {
          ...at(s.x, s.y), width: u(PILL_L), height: u(PILL_H), fontSize: u(13),
          transform: `translate(-50%, -50%) rotate(${s.deg.toFixed(2)}deg)`,
        };
        const cls = `${styles.seat} ${s.flip ? styles.seatFlip : ''}`;
        if (!p) {
          return (
            <button key={i} type="button" className={`${cls} ${styles.seatEmpty}`} style={style}
              onClick={() => ctl.fillTable(table)} title="Свободное место — нажмите, чтобы посадить гостя">
              <span className={styles.seatNum}>{i + 1}</span>
              <span className={styles.seatName}>Свободно</span>
            </button>
          );
        }
        const party = ctl.index.partyByKey.get(p.partyKey);
        const label = p.name || `${personTitle(p)}${party ? ` · ${party.label}` : ''}`;
        return (
          <button key={p.id} type="button" className={cls} style={style} draggable
            title={`${label} — ${STATUS_LABEL[p.status].toLowerCase()}${p.isChild ? ', ребёнок' : ''}. Нажмите, чтобы пересадить или снять со стола`}
            onClick={() => ctl.pick([p.id], label)}
            onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; ctl.dragStart([p.id]); }}
            onDragEnd={() => ctl.dragEnd()}>
            <span className={styles.seatNum} style={{ background: STATUS_COLOR[p.status] }}>{i + 1}</span>
            <span className={`${styles.seatName} ${p.name ? '' : styles.unnamed}`}>{p.name || 'Без имени'}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Большой стол на много мест — простым списком под счётчиком. */
function SeatList({ people, index, ctl }: { people: PlannerPerson[]; index: SnapshotIndex; ctl: BoardCtl }) {
  return (
    <ul className={styles.seated}>
      {people.map((p) => {
        const party = index.partyByKey.get(p.partyKey);
        const menu = p.menuOptionId ? index.optionById.get(p.menuOptionId)?.label : p.menuReview ? 'меню: уточнить' : '';
        return (
          <li key={p.id} className={styles.seatedRow} draggable
            onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; ctl.dragStart([p.id]); }}
            onDragEnd={() => ctl.dragEnd()}>
            <span className={styles.dot} style={{ background: STATUS_COLOR[p.status] }} title={STATUS_LABEL[p.status]} />
            <span className={styles.seatedName}>
              {p.name ? p.name : <span className={styles.unnamed}>{personTitle(p)}</span>}
              {(!p.name || p.isChild || menu) && (
                <span className={styles.seatedSub}>
                  {[!p.name ? party?.label : '', p.isChild ? 'ребёнок' : '', menu].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
            <button type="button" className={styles.iconBtn} onClick={() => ctl.pick([p.id], p.name || `${personTitle(p)} · ${party?.label ?? ''}`)} aria-label={`Пересадить: ${personTitle(p)}`} title="Пересадить за другой стол">⇄</button>
            <button type="button" className={styles.iconBtn} onClick={() => ctl.unseat([p.id])} aria-label={`Снять со стола: ${personTitle(p)}`} title="Снять со стола">✕</button>
          </li>
        );
      })}
    </ul>
  );
}

export default function TableCard({ table, people, index, ctl }: { table: PlannerTable; people: PlannerPerson[]; index: SnapshotIndex; ctl: BoardCtl }) {
  const [over, setOver] = useState(false);
  const full = table.free === 0;
  const hasDrag = () => ctl.dragIds.current !== null;
  const drawn = table.capacity <= MAX_DRAWN;

  return (
    <section
      className={`${styles.tableCard} ${over ? styles.tableOver : ''} ${full ? styles.tableFull : ''}`}
      aria-label={tableTitle(table.name)}
      onDragOver={(e) => { if (hasDrag()) { e.preventDefault(); setOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); ctl.dropOn(table.id); }}
    >
      <div className={styles.tableHead}>
        <div style={{ minWidth: 0 }}>
          <div className={styles.tableName}>{tableTitle(table.name)}</div>
          <div className={`${styles.tableCount} ${full ? styles.tableCountFull : ''}`}>
            {table.occupied} из {table.capacity}{full ? ' · заполнен' : ` · свободно ${seatsText(table.free)}`}
          </div>
        </div>
        <div className={styles.tableTools}>
          <button type="button" className={styles.iconBtn} aria-label={`Изменить: ${tableTitle(table.name)}`} title="Название, места и форма" onClick={() => ctl.editTable(table)}>✎</button>
          <button type="button" className={`${styles.iconBtn} ${styles.iconDanger}`} aria-label={`Удалить: ${tableTitle(table.name)}`} title="Удалить стол" onClick={() => ctl.deleteTable(table)}>🗑</button>
        </div>
      </div>

      {drawn ? <Plan table={table} people={people} ctl={ctl} /> : people.length > 0
        ? <SeatList people={people} index={index} ctl={ctl} />
        : <div className={styles.emptyTable}>Пока никого. Нажмите «Посадить гостя» или перетащите гостя сюда.</div>}

      <div className={styles.tableFoot}>
        <button type="button" className={`${styles.btn} ${styles.btnSmall}`} disabled={full} onClick={() => ctl.fillTable(table)}>+ Посадить гостя</button>
      </div>
    </section>
  );
}
