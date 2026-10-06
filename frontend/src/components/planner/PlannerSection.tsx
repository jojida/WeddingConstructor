'use client';
import { usePlanner } from './usePlanner';
import SeatingBoard from './SeatingBoard';
import styles from './planner.module.css';

export type PlannerView = 'seating';

/** Раздел кабинета «Меню и рассадка». Состояние живёт здесь один раз: переключение между
    видами (рассадка, меню, печать) не перезагружает гостей. */
export default function PlannerSection({ inviteId, view }: { inviteId: string; view: PlannerView }) {
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
      {view === 'seating' && <SeatingBoard planner={planner} snap={snap} />}
    </div>
  );
}
