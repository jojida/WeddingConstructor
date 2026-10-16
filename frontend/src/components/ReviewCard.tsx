'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import styles from './ReviewCard.module.css';

/* «Как вам WeddingCraft?» — внизу кабинета опубликованного сайта. Сюда же ведёт письмо после
   свадьбы (?review=1). На главную отзыв попадает, только если пара разрешила и мы его проверили
   (backend/src/lib/reviews.ts); оценки 1–3 не публикуются — их читаем, чтобы исправить. */

interface OwnReview { rating: number; text: string; names: string; publish: boolean; status: 'pending' | 'published' | 'hidden' }
interface ReviewState { review: OwnReview | null; canReview: boolean; names: string }

const LIMIT = { text: 1000, names: 80 };
const GOOD = 4;   // с этой оценки отзыв можно показать на сайте

function errorText(e: unknown): string {
  const data = (e as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof data?.error === 'string' && data.error ? data.error : 'Не получилось сохранить. Попробуйте ещё раз';
}

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  if (!onChange) return <span className={styles.starsStatic} aria-label={`Оценка ${value} из 5`}>{'★'.repeat(value)}{'☆'.repeat(5 - value)}</span>;
  return (
    <div className={styles.stars} role="radiogroup" aria-label="Оценка" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} из 5`}
          className={`${styles.star} ${n <= shown ? styles.starOn : ''}`}
          onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onBlur={() => setHover(0)} onClick={() => onChange(n)}>
          ★
        </button>
      ))}
    </div>
  );
}

export default function ReviewCard({ inviteId }: { inviteId: string }) {
  const [state, setState] = useState<ReviewState | null>(null);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [names, setNames] = useState('');
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let live = true;
    api.get<ReviewState>(`/api/reviews/invite/${inviteId}`)
      .then((res) => {
        if (!live) return;
        const r = res.data.review;
        setState(res.data);
        setRating(r?.rating ?? 0);
        setText(r?.text ?? '');
        setNames(r?.names ?? res.data.names ?? '');
        setPublish(r?.publish ?? false);
      })
      .catch(() => { /* карточка просто не покажется */ });
    return () => { live = false; };
  }, [inviteId]);

  // Ссылка из письма после свадьбы: прокрутить к карточке
  useEffect(() => {
    if (!state?.canReview || new URLSearchParams(window.location.search).get('review') !== '1') return;
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [state]);

  if (!state?.canReview) return null;
  const saved = state.review;
  const good = rating >= GOOD;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.put<{ review: OwnReview }>(`/api/reviews/invite/${inviteId}`, { rating, text, names, publish: good && publish });
      setState({ ...state, review: res.data.review });
      setEditing(false);
      toast.success('Спасибо за отзыв!');
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setEditing(false);
    if (!saved) return;
    setRating(saved.rating); setText(saved.text); setNames(saved.names); setPublish(saved.publish);
  };

  // Отзыв уже есть — спасибо и что с ним будет
  if (saved && !editing) {
    const note = saved.rating < GOOD ? 'Спасибо за честность — прочитаем и постараемся исправить.'
      : saved.status === 'published' && saved.publish ? 'Ваш отзыв на главной WeddingCraft — спасибо, что разрешили его показать.'
      : saved.publish && saved.status === 'pending' ? 'Покажем его на главной после проверки — обычно в течение дня.'
      : 'Отзыв видим только мы.';
    return (
      <section ref={rootRef} className={styles.card} aria-label="Ваш отзыв о WeddingCraft">
        <h3 className={styles.title}>Спасибо за отзыв!</h3>
        <Stars value={saved.rating} />
        {saved.text && <p className={styles.quote}>«{saved.text}»</p>}
        <p className={styles.hint}>
          {note}{' '}
          {saved.status === 'published' && saved.publish && <Link href="/#reviews" className={styles.link}>Посмотреть</Link>}
        </p>
        <button type="button" className={styles.secondary} onClick={() => setEditing(true)}>Изменить отзыв</button>
      </section>
    );
  }

  return (
    <section ref={rootRef} className={styles.card} aria-label="Отзыв о WeddingCraft">
      <h3 className={styles.title}>Как вам WeddingCraft?</h3>
      <p className={styles.hint} style={{ marginTop: 0 }}>Пара слов от вас поможет нам стать лучше. Показывать ли отзыв на сайте — решаете вы.</p>
      <Stars value={rating} onChange={setRating} />

      {rating > 0 && (
        <div className={styles.form}>
          <label className={styles.field}>
            <span>{good ? 'Что понравилось? Как гости встретили приглашение?' : 'Что пошло не так? Чего не хватило?'}</span>
            <textarea className={styles.input} rows={4} maxLength={LIMIT.text} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          {good && (
            <>
              <label className={styles.field}>
                <span>Подпись</span>
                <input className={styles.input} maxLength={LIMIT.names} value={names} onChange={(e) => setNames(e.target.value)} placeholder="Например: Анна и Максим" />
              </label>
              <label className={styles.check}>
                <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
                <span>Можно показать отзыв на weddingcraft.ru с этой подписью</span>
              </label>
            </>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={busy} onClick={submit}>{busy ? 'Отправляем…' : saved ? 'Сохранить' : 'Отправить отзыв'}</button>
            {saved && <button type="button" className={styles.secondary} onClick={cancel}>Отмена</button>}
          </div>
        </div>
      )}
    </section>
  );
}
