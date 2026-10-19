'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { hasGuestReminders } from '@/lib/constants';

/* Вкладка кабинета «Напоминания» («Максимум»): пара включает галочку «Напомнить мне» в
   анкете и выбирает срок. Гостям, попросившим напомнить, за неделю (3 дня, неделю и
   накануне) приходит сообщение в Telegram или SMS — с ответом «Буду / Не смогу».
   Сервер — backend/src/lib/reminders.ts, API /api/reminders/:inviteId. */

const PRIMARY = '#685d4a';
const BORDER = '1px solid rgba(206,197,186,0.5)';

type Days = '7' | '3' | '7,1';
interface Overview {
  enabled: boolean;
  days: Days;
  weddingDate: string;
  daysLeft: number | null;
  channels: { telegram: boolean; sms: boolean };
  sms: { limit: number; spent: number };
  stats: { total: number; telegram: number; sms: number; waiting: number; confirmed: number; declined: number };
  schedule: { kind: number; date: string; sent: number }[];
  preview: { telegram: string; sms: string } | null;
}
interface InviteLike { id: string; plan: string; notifyChannel: string }

const DAY_OPTIONS: { v: Days; t: string; d: string }[] = [
  { v: '7', t: 'За неделю', d: 'Успеете назвать ресторану точное число гостей' },
  { v: '3', t: 'За 3 дня', d: 'Ближе к свадьбе, но поменять заказ может быть поздно' },
  { v: '7,1', t: 'За неделю и накануне', d: 'Накануне — коротко: время и адрес' },
];

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const dayMonth = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const before = (n: number) => (n === 7 ? 'за неделю' : n === 1 ? 'накануне' : `за ${n} дня`);
const guestsWord = (n: number) => {
  const m10 = n % 10, m100 = n % 100;
  return `${n} ${m10 === 1 && m100 !== 11 ? 'гостю' : 'гостям'}`;
};

export default function RemindersTab({ invite, onOpenNotify }: { invite: InviteLike; onOpenNotify: () => void }) {
  if (!hasGuestReminders(invite.plan)) return (
    <div style={{ background: 'linear-gradient(135deg,#fff,#f7f1e8)', border: BORDER, borderRadius: 14, padding: 28, textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>⏰</div>
      <h3 style={{ margin: '0 0 8px', color: '#0e1d26', fontFamily: 'var(--font-playfair, Georgia), serif', fontSize: 22 }}>Напоминание гостям — в тарифе «Максимум»</h3>
      <p style={{ color: '#7d766c', fontSize: 14, maxWidth: 480, margin: '0 auto 16px' }}>
        За неделю до свадьбы гости получат напоминание в Telegram или по SMS и подтвердят участие одной кнопкой.
        Обзванивать всех перед заказом в ресторане не придётся.
      </p>
      <Link href={`/payment?id=${invite.id}&plan=maximum`} className="btn-primary" style={{ textDecoration: 'none', padding: '11px 26px', fontSize: 14 }}>
        Улучшить тариф →
      </Link>
    </div>
  );
  return <RemindersSettings invite={invite} onOpenNotify={onOpenNotify} />;
}

function RemindersSettings({ invite, onOpenNotify }: { invite: InviteLike; onOpenNotify: () => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/api/reminders/${invite.id}`)
      .then((res) => setData(res.data))
      .catch(() => setFailed(true));
  }, [invite.id]);

  const save = async (next: { enabled: boolean; days: Days }) => {
    if (!data) return;
    const prev = data;
    setData({ ...data, ...next });
    setSaving(true);
    try {
      const res = await api.put(`/api/reminders/${invite.id}`, next);
      setData(res.data);
      toast.success(next.enabled ? 'Сохранено' : 'Напоминания выключены');
    } catch {
      setData(prev);
      toast.error('Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (failed) return <div style={{ padding: 40, textAlign: 'center', color: '#9a948a', fontSize: 14 }}>Не удалось загрузить настройки</div>;
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: '#9a948a', fontSize: 14 }}>Загрузка…</div>;

  const s = data.stats;
  const past = data.daysLeft !== null && data.daysLeft < 0;
  const noChannel = !data.channels.telegram && !data.channels.sms;

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ fontSize: 14, color: '#5b554c', margin: '0 0 18px', lineHeight: 1.6 }}>
        Гости, которые ответили «Буду» или «Пока не знаю», могут попросить напомнить им о свадьбе.
        В срок им придёт сообщение с вопросом «Вы придёте?» — ответить можно одной кнопкой.
        Если кто-то ответит «Не смогу», мы сразу сообщим вам.
      </p>

      <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 16, border: data.enabled ? `2px solid ${PRIMARY}` : BORDER, borderRadius: 12, background: '#fff', cursor: 'pointer' }}>
        <input type="checkbox" checked={data.enabled} disabled={saving} onChange={(e) => save({ enabled: e.target.checked, days: data.days })} style={{ marginTop: 3, width: 18, height: 18, accentColor: PRIMARY }} />
        <span>
          <span style={{ fontWeight: 600, color: '#0e1d26' }}>Предлагать гостям напоминание</span>
          <span style={{ display: 'block', fontSize: 13, color: '#7d766c', marginTop: 2 }}>
            В анкете появится галочка «Напомнить мне»
            {data.channels.sms && data.channels.telegram ? ' — с телефоном или Telegram' : data.channels.sms ? ' и поле для телефона' : ' с кнопкой Telegram'}.
          </span>
        </span>
      </label>

      <div style={{ marginTop: 18, opacity: data.enabled ? 1 : 0.55 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#7d766c', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Когда напомнить</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          {DAY_OPTIONS.map((o) => (
            <label key={o.v} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: 12, border: data.days === o.v ? `2px solid ${PRIMARY}` : BORDER, borderRadius: 10, background: '#fff', cursor: data.enabled ? 'pointer' : 'default' }}>
              <input type="radio" name="remind-days" checked={data.days === o.v} disabled={!data.enabled || saving} onChange={() => save({ enabled: true, days: o.v })} style={{ marginTop: 3, accentColor: PRIMARY }} />
              <span>
                <span style={{ fontWeight: 600, color: '#0e1d26', fontSize: 14 }}>{o.t}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#7d766c', marginTop: 2 }}>{o.d}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {data.enabled && (
        <div style={{ marginTop: 18, padding: 14, background: '#f7f3ec', borderRadius: 10, fontSize: 14, color: '#5b554c', lineHeight: 1.6 }}>
          {!data.weddingDate ? (
            <>Укажите дату свадьбы в <Link href={`/editor?id=${invite.id}`} style={{ color: PRIMARY, fontWeight: 600 }}>редакторе</Link> — без неё напоминание не отправить.</>
          ) : past ? (
            <>Свадьба уже прошла.</>
          ) : noChannel ? (
            <>Отправка напоминаний сейчас недоступна — напишите нам на support@weddingcraft.ru.</>
          ) : (
            data.schedule.map((x, i) => {
              // Срок действует, пока не наступил следующий (как на сервере, dueKind)
              const left = data.daysLeft ?? 0;
              const next = data.schedule[i + 1]?.kind ?? 0;
              return (
                <div key={x.kind}>
                  {x.sent > 0
                    ? `✓ Напоминание ${before(x.kind)} отправлено ${guestsWord(x.sent)}.`
                    : left > x.kind
                      ? `Напоминание ${before(x.kind)} уйдёт ${dayMonth(x.date)}, с 10 до 15 по Москве.`
                      : left > next && left >= 1
                        ? `Напоминание ${before(x.kind)} уйдёт в ближайшее время, с 10 до 15 по Москве, — тем, кто уже попросил.`
                        : `Срок напоминания ${before(x.kind)} прошёл.`}
                </div>
              );
            })
          )}
        </div>
      )}

      {(data.enabled || s.total > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginTop: 18 }}>
          <Tile n={s.total} label="Попросили напомнить" />
          <Tile n={s.telegram} label="в Telegram" />
          {(data.channels.sms || s.sms > 0) && <Tile n={s.sms} label="по SMS" />}
          <Tile n={s.confirmed} label="Подтвердили" color="#2e8b57" />
          <Tile n={s.declined} label="Ответили «Не смогу»" color="#b85c5c" />
        </div>
      )}

      {data.enabled && (
        <div style={{ marginTop: 12, fontSize: 13, color: '#7d766c', lineHeight: 1.6 }}>
          {data.channels.sms && data.channels.telegram
            ? <>Telegram — в первую очередь, SMS — тем, у кого его нет. SMS на эту свадьбу: {data.sms.spent} из {data.sms.limit}.</>
            : data.channels.sms
              ? <>Напоминания приходят по SMS. SMS на эту свадьбу: {data.sms.spent} из {data.sms.limit}.</>
              : <>Сейчас напоминания приходят в Telegram; номер телефона анкета пока не спрашивает.</>}
          {' '}Кто попросил напомнить, видно во вкладке «Ответы».
        </div>
      )}

      {data.enabled && invite.notifyChannel === 'none' && (
        <div style={{ marginTop: 14, padding: 14, background: '#fff8ec', border: '1px solid #f0dcb4', borderRadius: 10, fontSize: 14, color: '#7a5a22' }}>
          Чтобы сразу узнавать, кто ответил «Не смогу», включите уведомления.{' '}
          <button onClick={onOpenNotify} style={{ border: 'none', background: 'none', padding: 0, color: PRIMARY, fontWeight: 700, cursor: 'pointer', fontSize: 14, textDecoration: 'underline' }}>
            Настроить →
          </button>
        </div>
      )}

      {data.enabled && data.preview && (
        <div style={{ marginTop: 26 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#7d766c', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Что получит гость</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, alignItems: 'start' }}>
            {data.channels.telegram && (
              <div>
                <div style={{ fontSize: 12, color: '#9a948a', marginBottom: 6 }}>Telegram</div>
                <div style={{ background: '#fff', border: BORDER, borderRadius: '14px 14px 14px 4px', padding: '12px 14px', fontSize: 13.5, lineHeight: 1.5, color: '#2b2925', whiteSpace: 'pre-line' }}>
                  {data.preview.telegram}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                  {['✅ Буду', '❌ Не смогу'].map((t) => (
                    <div key={t} style={{ background: '#eef2f6', borderRadius: 8, padding: '8px 6px', textAlign: 'center', fontSize: 13, color: '#3a567d' }}>{t}</div>
                  ))}
                </div>
              </div>
            )}
            {data.channels.sms && (
              <div>
                <div style={{ fontSize: 12, color: '#9a948a', marginBottom: 6 }}>SMS</div>
                <div style={{ background: '#e9f3e6', borderRadius: '14px 14px 14px 4px', padding: '12px 14px', fontSize: 13.5, lineHeight: 1.5, color: '#2b2925', overflowWrap: 'anywhere' }}>
                  {data.preview.sms}
                </div>
                <div style={{ fontSize: 12, color: '#9a948a', marginTop: 6 }}>По ссылке гость подтвердит участие и число гостей.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ n, label, color }: { n: number; label: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: BORDER, borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || '#0e1d26', fontFamily: 'var(--font-playfair, Georgia), serif' }}>{n}</div>
      <div style={{ fontSize: 12, color: '#7d766c', marginTop: 2 }}>{label}</div>
    </div>
  );
}
