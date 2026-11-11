import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import ReviewCard from '@/components/ReviewCard';
import { LEGAL } from '@/lib/constants';
import styles from '../blog/blog.module.css';

/* Отзыв по ссылке «напишите только нам» из письма «Как вам WeddingCraft?» (backend lifecycleEmails,
   review_ask) — без входа в кабинет: в ссылке id сайта и подпись (backend/src/lib/reviews.ts),
   r — заранее выбранная звезда, если есть. Сохраняется только кнопкой «Отправить»: почтовые сканеры,
   открывающие ссылки из писем, оценку за пару не поставят. Страница закрыта от поиска,
   а в Метрику её адрес с подписью не уходит (нет в ANALYTICS_PATHS).
   С 11.11.26 отзыв принимаем только у оплативших: у бесплатных пар остались ссылки из писем
   до этого дня — им запасной текст, без отсылки в кабинет (там блока отзыва у них нет). */
export const metadata: Metadata = {
  title: 'Отзыв о WeddingCraft',
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ i?: string | string[]; t?: string | string[]; r?: string | string[] }>;
}

export default async function ReviewPage({ searchParams }: Props) {
  const { i, t, r } = await searchParams;
  const inviteId = typeof i === 'string' && /^[0-9a-f-]{36}$/.test(i) ? i : '';
  const token = typeof t === 'string' && /^[0-9a-f]{32}$/.test(t) ? t : '';
  const star = Number(r);
  const rating = Number.isInteger(star) && star >= 1 && star <= 5 ? star : undefined;
  const fallback = (
    <p className={styles.lead}>
      Эта ссылка больше не действует. Если хотите что-то рассказать или спросить —
      напишите нам: <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
    </p>
  );
  return (
    <div className={styles.page}>
      <Navbar />
      <div className={styles.container}>
        {inviteId && token
          ? <ReviewCard inviteId={inviteId} link={{ token, rating }} fallback={fallback} />
          : fallback}
      </div>
    </div>
  );
}
