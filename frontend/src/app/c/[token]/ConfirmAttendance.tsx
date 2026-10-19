'use client';
import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import api from '@/lib/api';
import styles from './page.module.css';

type Attendance = 'yes' | 'no' | 'maybe';
interface PageData {
  guestName: string; groomName: string; brideName: string;
  weddingDate: string; weddingTime: string; venue: string; venueAddress: string;
  siteUrl: string; attendance: Attendance; guestsCount: number; answer: '' | 'yes' | 'no'; past: boolean;
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

function dateLine(date: string, time: string): string {
  if (!date) return '';
  const d = new Date(`${date}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${WEEKDAYS[d.getUTCDay()]}${time ? ` · ${time}` : ''}`;
}

const people = (n: number) => {
  const m10 = n % 10, m100 = n % 100;
  return `${n} ${m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'человека' : 'человек'}`;
};

export default function ConfirmAttendance({ token }: { token: string }) {
  const [data, setData] = useState<PageData | null>(null);
  const [failed, setFailed] = useState(false);
  const [count, setCount] = useState(1);
  const [step, setStep] = useState<'ask' | 'sure-no' | 'done-yes' | 'done-no'>('ask');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/reminders/c/${encodeURIComponent(token)}`)
      .then((res) => {
        setData(res.data);
        setCount(res.data.guestsCount || 1);
      })
      .catch(() => setFailed(true));
  }, [token]);

  const send = async (answer: 'yes' | 'no') => {
    setSaving(true);
    setError('');
    try {
      const res = await api.post(`/api/reminders/c/${encodeURIComponent(token)}`, answer === 'yes' ? { answer, guestsCount: count } : { answer });
      setData((d) => (d ? { ...d, attendance: res.data.attendance, guestsCount: res.data.guestsCount, answer } : d));
      setStep(answer === 'yes' ? 'done-yes' : 'done-no');
    } catch (e) {
      const gone = isAxiosError(e) && e.response?.status === 410;
      setError(gone ? 'Свадьба уже прошла — ответ больше не нужен.' : 'Не получилось сохранить ответ. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  if (failed) return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Ссылка недействительна</h1>
        <p className={styles.text}>Возможно, в ней опечатка. Откройте ссылку из сообщения ещё раз или ответьте на приглашении молодожёнов.</p>
      </div>
    </main>
  );

  if (!data) return (
    <main className={styles.page}>
      <div className={styles.spinner} aria-label="Загрузка" />
    </main>
  );

  const couple = [data.groomName, data.brideName].filter(Boolean).join(' & ') || 'Свадьба';
  const place = [data.venue, data.venueAddress].filter(Boolean).join(', ');
  const mapUrl = place ? `https://yandex.ru/maps/?text=${encodeURIComponent(place)}` : '';
  const when = dateLine(data.weddingDate, data.weddingTime);
  const name = data.guestName.trim();
  const current = data.attendance === 'yes'
    ? `Сейчас в анкете: придёте${data.guestsCount > 1 ? `, ${people(data.guestsCount)}` : ''}.`
    : data.attendance === 'maybe' ? 'Сейчас в анкете: «Пока не знаю».' : 'Сейчас в анкете: не сможете прийти.';

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Приглашение на свадьбу</div>
        <h1 className={styles.title}>{couple}</h1>
        {when && <div className={styles.when}>{when}</div>}
        {place && (
          <div className={styles.place}>
            {place}
            {mapUrl && <> · <a href={mapUrl} target="_blank" rel="noreferrer">Как добраться</a></>}
          </div>
        )}

        <div className={styles.divider} />

        {data.past ? (
          <p className={styles.text}>Свадьба уже прошла — спасибо, что были с молодожёнами!</p>
        ) : step === 'done-yes' ? (
          <div className={styles.result} role="status">
            <div className={styles.resultIcon}>✓</div>
            <p className={styles.lead}>Спасибо! Ждём {data.guestsCount > 1 ? `вас — ${people(data.guestsCount)}` : 'вас'}.</p>
            <p className={styles.text}>Молодожёны увидят ваш ответ.</p>
          </div>
        ) : step === 'done-no' ? (
          <div className={styles.result} role="status">
            <p className={styles.lead}>Жаль, что не получится.</p>
            <p className={styles.text}>Мы передали молодожёнам. Если планы снова изменятся — откройте эту ссылку ещё раз.</p>
          </div>
        ) : step === 'sure-no' ? (
          <>
            <p className={styles.lead}>Точно не сможете прийти?</p>
            <p className={styles.text}>Молодожёны получат уведомление, место за столом освободится.</p>
            <div className={styles.actions}>
              <button className={styles.danger} disabled={saving} onClick={() => send('no')}>Да, не смогу</button>
              <button className={styles.ghost} disabled={saving} onClick={() => setStep('ask')}>Назад</button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.lead}>{name ? `${name}, вы придёте?` : 'Вы придёте?'}</p>
            <p className={styles.text}>{current} Молодожёнам важно знать точное число гостей.</p>
            <div className={styles.count}>
              <span>Сколько вас будет</span>
              <div className={styles.stepper}>
                <button type="button" aria-label="Меньше" disabled={count <= 1} onClick={() => setCount((c) => Math.max(1, c - 1))}>−</button>
                <output aria-live="polite">{count}</output>
                <button type="button" aria-label="Больше" disabled={count >= 20} onClick={() => setCount((c) => Math.min(20, c + 1))}>+</button>
              </div>
            </div>
            <div className={styles.actions}>
              <button className="btn-primary" disabled={saving} onClick={() => send('yes')}>{saving ? 'Сохраняем…' : 'Да, буду'}</button>
              <button className={styles.ghost} disabled={saving} onClick={() => setStep('sure-no')}>Планы изменились</button>
            </div>
          </>
        )}
        {error && <p className={styles.error} role="alert">{error}</p>}

        {data.siteUrl && <a className={styles.site} href={data.siteUrl}>Открыть приглашение →</a>}
      </div>
      <div className={styles.footer}>WeddingCraft</div>
    </main>
  );
}
