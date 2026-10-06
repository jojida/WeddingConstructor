'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import styles from './GuestSeat.module.css';

/* «Ваш стол» на сайте приглашения: гость открыл свою персональную ссылку, пара включила показ
   рассадки или меню. Плашка лежит поверх шаблона (а не внутри него), поэтому одинаково работает
   во всех шаблонах. Данные — только своей группы, их отдаёт сервер (lib/planner/guestView.ts). */

export interface GuestSeatGroup { people: string[]; others: number }
export interface GuestSeatView {
  accent: string;
  size: number;   // людей в группе гостя
  tables: (GuestSeatGroup & { name: string; title: string })[];
  waiting: GuestSeatGroup | null;
  dishes: { name: string; dish: string }[];
  menu: { label: string; note: string }[];
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** «Анна, Борис и Вера» */
const joinRu = (parts: string[]): string =>
  parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} и ${parts[parts.length - 1]}`;

/** «Анна, Борис и ещё 1 гость»; без имён — «2 гостя». */
const who = (g: GuestSeatGroup): string =>
  joinRu([...g.people, ...(g.others ? [`${g.people.length ? 'ещё ' : ''}${g.others} ${plural(g.others, 'гость', 'гостя', 'гостей')}`] : [])]);

const headcount = (g: GuestSeatGroup): number => g.people.length + g.others;

export default function GuestSeat({ view }: { view: GuestSeatView }) {
  const [open, setOpen] = useState(false);
  const pillRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); pillRef.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => { setOpen(false); pillRef.current?.focus(); };

  const { tables, waiting, dishes, menu } = view;
  const label = tables.length === 1 ? `Ваш стол: ${tables[0].name}`
    : tables.length > 1 ? `Ваши столы: ${joinRu(tables.map((t) => t.name))}`
    : 'Меню';
  // Имена нужны, только если в группе больше одного человека: одному «Мария Петрова» под столом ни к чему
  const party = Math.max(view.size || 0, tables.reduce((n, t) => n + headcount(t), 0) + (waiting ? headcount(waiting) : 0));
  const chosen = new Set(dishes.map((d) => d.dish));
  const theme = { '--seat-accent': view.accent } as CSSProperties;

  return (
    <>
      <button ref={pillRef} type="button" className={styles.pill} style={theme} onClick={() => setOpen(true)}
        aria-haspopup="dialog" aria-expanded={open}>
        <span aria-hidden>{tables.length ? '🪑' : '🍽'}</span>
        <span className={styles.pillText}>{label}</span>
      </button>

      {open && (
        <div className={styles.overlay} style={theme} onClick={close}>
          <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
            <button ref={closeRef} type="button" className={styles.close} onClick={close} aria-label="Закрыть">×</button>

            {tables.length > 0 && (
              <section className={styles.section}>
                <div className={styles.kicker}>{tables.length > 1 ? 'Ваши столы' : 'Ваш стол'}</div>
                {tables.map((t) => (
                  <div key={t.name} className={styles.table}>
                    <div className={styles.tableTitle}>{t.title}</div>
                    {party > 1 && <div className={styles.people}>{who(t)}</div>}
                  </div>
                ))}
                {waiting && <p className={styles.muted}>Пока без стола: {who(waiting)}</p>}
              </section>
            )}

            {dishes.length > 0 && (
              <section className={styles.section}>
                <div className={styles.kicker}>{party > 1 ? 'Ваш выбор' : 'Ваше блюдо'}</div>
                <ul className={styles.list}>
                  {dishes.map((d, i) => (
                    <li key={i}>{party > 1 ? <>{d.name || 'Гость'} — </> : null}<b>{d.dish}</b></li>
                  ))}
                </ul>
              </section>
            )}

            {menu.length > 0 && (
              <section className={styles.section}>
                <div className={styles.kicker}>Меню</div>
                <ul className={styles.list}>
                  {menu.map((o) => (
                    <li key={o.label}>
                      <b>{o.label}</b>{o.note && <span className={styles.note}> — {o.note}</span>}
                      {chosen.has(o.label) && <span className={styles.mark}> · ваш выбор</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className={styles.foot}>Если что-то не так, напишите молодожёнам.</p>
          </div>
        </div>
      )}
    </>
  );
}
