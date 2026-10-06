'use client';
import { usePlanner } from './usePlanner';
import SeatingBoard from './SeatingBoard';
import MenuBoard from './MenuBoard';
import styles from './planner.module.css';

export type PlannerView = 'seating' | 'menu';

/** Раздел кабинета «Меню и рассадка». Состояние живёт здесь один раз: переключение между
    вкладками «Рассадка» и «Меню» не перезагружает гостей. */
export default function PlannerSection({ inviteId, slug, view }: { inviteId: string; slug: string; view: PlannerView }) {
  const planner = usePlanner(inviteId);
  const { snap, load } = planner;

  if (load === 'loading') return <div className={styles.note}>Собираем список гостей…</div>;
  if (load === 'plan') return <div className={styles.note}>Меню и рассадка доступны на тарифе «Премиум».</div>;
  if (load === 'beta') return <div className={styles.note}>Меню и рассадка скоро откроются — мы вас предупредим.</div>;
  if (load === 'error' || !snap) {
    return <div className={styles.note}>Не удалось загрузить гостей. <button type="button" className={styles.link} onClick={planner.retry}>Повторить</button></div>;
  }
  return (
    <div className={styles.root}>
      {view === 'seating' ? <SeatingBoard planner={planner} snap={snap} /> : <MenuBoard planner={planner} snap={snap} slug={slug} />}
    </div>
  );
}
