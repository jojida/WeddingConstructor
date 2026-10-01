import Link from 'next/link';
import styles from './PrintInvitationsTeaser.module.css';

export default function PrintInvitationsTeaser() {
  return <section className={styles.section} aria-labelledby="print-invitations-title">
    <div className={styles.art} aria-hidden="true"><img src="/print/boarding.svg" alt="" loading="lazy" /><img src="/print/petals.svg" alt="" loading="lazy" /></div>
    <div className={styles.content}><span className={styles.eyebrow}>НОВОЕ · ПЕЧАТНЫЕ ПРИГЛАШЕНИЯ</span><h2 id="print-invitations-title">Ваша история.<br /><em>На красивой бумаге.</em></h2><p>Двенадцать готовых дизайнов, ваши слова и тёплое приглашение, которое останется на память. Настройте макет онлайн и скачайте PDF для печати.</p><div className={styles.actions}><Link href="/print">Выбрать дизайн <span aria-hidden="true">↗</span></Link><span><b>290 ₽</b> за один дизайн</span></div><small>A6 · PDF для дома и типографии · Любой тираж</small></div>
  </section>;
}
