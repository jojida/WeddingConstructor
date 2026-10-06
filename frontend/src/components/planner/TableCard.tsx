'use client';
import { useState } from 'react';
import { STATUS_COLOR, STATUS_LABEL, personTitle, seatsText, tableTitle, type PlannerPerson, type PlannerTable, type SnapshotIndex } from '@/lib/planner';
import type { BoardCtl } from './SeatingBoard';
import styles from './planner.module.css';

/** Схема стола: места вокруг (круглый) или по двум сторонам (длинный). Занятые окрашены цветом
    ответа гостя, свободные — пустые кружки. Для больших столов схему не рисуем. */
function Diagram({ table, people }: { table: PlannerTable; people: PlannerPerson[] }) {
  const n = table.capacity;
  if (n > 24) return null;
  const seat = (i: number, x: number, y: number) => {
    const p = people[i];
    return <circle key={i} cx={x} cy={y} r={5.5} fill={p ? STATUS_COLOR[p.status] : '#fff'} stroke={p ? 'none' : '#cfc4b3'} strokeWidth={1.4} />;
  };
  if (table.shape === 'long') {
    const top = Math.ceil(n / 2), bottom = n - top;
    const w = Math.max(72, top * 17 + 10);
    const step = (count: number) => (w - 20) / Math.max(1, count);
    return (
      <svg className={styles.diagram} width={w} height={58} viewBox={`0 0 ${w} 58`} role="img" aria-label={`${tableTitle(table.name)}: занято ${people.length} из ${n}`}>
        <rect x={6} y={19} width={w - 12} height={20} rx={7} fill="#f2ede7" stroke="#cfc4b3" />
        {Array.from({ length: top }, (_, i) => seat(i, 10 + step(top) * (i + 0.5), 10))}
        {Array.from({ length: bottom }, (_, i) => seat(top + i, 10 + step(bottom) * (i + 0.5), 48))}
      </svg>
    );
  }
  const c = 40, r = 30;
  return (
    <svg className={styles.diagram} width={80} height={80} viewBox="0 0 80 80" role="img" aria-label={`${tableTitle(table.name)}: занято ${people.length} из ${n}`}>
      <circle cx={c} cy={c} r={18} fill="#f2ede7" stroke="#cfc4b3" />
      {Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        return seat(i, c + r * Math.cos(a), c + r * Math.sin(a));
      })}
    </svg>
  );
}

export default function TableCard({ table, people, index, ctl }: { table: PlannerTable; people: PlannerPerson[]; index: SnapshotIndex; ctl: BoardCtl }) {
  const [over, setOver] = useState(false);
  const full = table.free === 0;
  const hasDrag = () => ctl.dragIds.current !== null;

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
        <button type="button" className={styles.iconBtn} aria-label={`Изменить: ${tableTitle(table.name)}`} title="Изменить стол" onClick={() => ctl.editTable(table)}>✎</button>
      </div>

      <div className={styles.tableMid}>
        <Diagram table={table} people={people} />
        <div className={styles.bar} aria-hidden>
          <div className={styles.barFill} style={{ width: `${Math.min(100, (table.occupied / Math.max(1, table.capacity)) * 100)}%` }} />
        </div>
      </div>

      {people.length > 0 ? (
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
      ) : <div className={styles.emptyTable}>Пока никого. Нажмите «Посадить» или перетащите гостя сюда.</div>}

      <div className={styles.tableFoot}>
        <button type="button" className={`${styles.btn} ${styles.btnSmall}`} disabled={full} onClick={() => ctl.fillTable(table)}>+ Посадить</button>
      </div>
    </section>
  );
}
