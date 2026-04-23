'use client';
import { useState, useEffect } from 'react';
import styles from './TemplatePreview.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface ScheduleItem { time: string; title: string; icon: string; }

export interface InviteData {
  templateId: string;
  groomName: string;
  brideName: string;
  weddingDate: string;
  weddingTime: string;
  venue: string;
  venueAddress: string;
  story: string;
  inviteText: string;
  dressCode: string;
  coverPhoto: string;
  galleryPhotos: string[];
  mapLink: string;
  schedule: ScheduleItem[];
  slug?: string;
}

interface Props {
  data: InviteData;
  apiBase: string;
  fullPage?: boolean;
  slug?: string;
}

// ─── Themes ─────────────────────────────────────────────────────────────────
const THEMES = {
  classic: {
    bg: '#f5f0e8', accent: '#c9a96e', dark: '#2c2c2c', light: '#9a8060',
    muted: '#b8a888', card: 'rgba(255,255,255,0.85)', divider: 'rgba(201,169,110,0.2)',
    font: 'Playfair Display', bodyBg: '#fffdf8',
    heroBg: 'linear-gradient(160deg, #2c1f12 0%, #1a1208 100%)',
    scheduleStyle: 'dots',
  },
  modern: {
    bg: '#ffffff', accent: '#111111', dark: '#111111', light: '#666666',
    muted: '#999', card: '#f5f5f5', divider: '#e0e0e0',
    font: 'Inter', bodyBg: '#fafafa',
    heroBg: 'linear-gradient(160deg, #111 0%, #333 100%)',
    scheduleStyle: 'lines',
  },
  bohemian: {
    bg: '#fdf6ec', accent: '#b5813d', dark: '#3d2b1f', light: '#6b8f5c',
    muted: '#a08060', card: 'rgba(255,255,255,0.7)', divider: 'rgba(181,129,61,0.2)',
    font: 'Playfair Display', bodyBg: '#fff8f0',
    heroBg: 'linear-gradient(160deg, #2d1f0e 0%, #3d2b1f 100%)',
    scheduleStyle: 'floral',
  },
  luxury: {
    bg: '#1a1a2e', accent: '#c9a96e', dark: '#f0f0f0', light: '#c9a96e',
    muted: '#8888aa', card: 'rgba(255,255,255,0.05)', divider: 'rgba(201,169,110,0.2)',
    font: 'Playfair Display', bodyBg: '#0d0d1a',
    heroBg: 'linear-gradient(160deg, #0d0d1a 0%, #1a1a2e 100%)',
    scheduleStyle: 'gold',
  },
  pastel: {
    bg: '#fce4ec', accent: '#e91e8c', dark: '#6d0038', light: '#f48fb1',
    muted: '#c48fb1', card: 'rgba(255,255,255,0.8)', divider: 'rgba(233,30,140,0.15)',
    font: 'Playfair Display', bodyBg: '#fff0f8',
    heroBg: 'linear-gradient(160deg, #6d0038 0%, #ad1457 100%)',
    scheduleStyle: 'petals',
  },
  vintage: {
    bg: '#f7ede8', accent: '#c4837a', dark: '#3d2420', light: '#6b8c7a',
    muted: '#9a7870', card: 'rgba(255,255,255,0.75)', divider: 'rgba(196,131,122,0.2)',
    font: 'Playfair Display', bodyBg: '#fdf7f4',
    heroBg: 'linear-gradient(160deg, #2d1510 0%, #3d2420 100%)',
    scheduleStyle: 'vintage',
  },
};

const DRINKS = [
  { id: 'wine',       label: 'Вино',        emoji: '🍷' },
  { id: 'champagne',  label: 'Шампанское',  emoji: '🥂' },
  { id: 'juice',      label: 'Сок',         emoji: '🧃' },
  { id: 'water',      label: 'Вода',        emoji: '💧' },
  { id: 'no_alcohol', label: 'Без алкоголя',emoji: '🚫🍷' },
  { id: 'other',      label: 'Другое',      emoji: '🍹' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  } catch { return dateStr; }
}

function useCountdown(dateStr: string) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    if (!dateStr) return;
    const calc = () => {
      const diff = new Date(dateStr).getTime() - Date.now();
      setDays(Math.max(0, Math.ceil(diff / 86400000)));
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [dateStr]);
  return days;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function TemplatePreview({ data, apiBase, fullPage = false, slug }: Props) {
  const theme = THEMES[data.templateId as keyof typeof THEMES] || THEMES.classic;
  const hasCouple = data.groomName || data.brideName;
  const daysLeft = useCountdown(data.weddingDate);
  const schedule: ScheduleItem[] = Array.isArray(data.schedule) ? data.schedule : [];

  const [rsvpName, setRsvpName]       = useState('');
  const [attending, setAttending]     = useState<boolean | null>(null);
  const [drink, setDrink]             = useState('');
  const [wishes, setWishes]           = useState('');
  const [rsvpStatus, setRsvpStatus]   = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleRsvp = async () => {
    if (!rsvpName.trim()) return;
    setRsvpStatus('sending');
    try {
      const effectiveSlug = slug || data.slug || '';
      if (!effectiveSlug) { setRsvpStatus('sent'); return; }
      const res = await fetch(`${apiBase}/api/rsvp/${effectiveSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName: rsvpName, attending: attending !== false, drinkChoice: drink, wishes }),
      });
      setRsvpStatus(res.ok ? 'sent' : 'error');
    } catch { setRsvpStatus('error'); }
  };

  const css = {
    '--accent': theme.accent,
    '--dark': theme.dark,
    '--light': theme.light,
  } as React.CSSProperties;

  return (
    <div className={`${styles.preview} ${fullPage ? styles.fullPage : ''}`}
      style={{ background: theme.bodyBg, ...css }}>

      {/* ══════════════════════════════════════════════════
          HERO — фото + имена + обратный отсчёт
      ══════════════════════════════════════════════════ */}
      <div className={styles.hero}
        style={{
          background: data.coverPhoto
            ? `linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.65) 100%), url(${apiBase}${data.coverPhoto}) center/cover no-repeat`
            : theme.heroBg,
        }}>

        {/* Top ornament / nav */}
        <div className={styles.heroTop}>
          <div className={styles.heroOrnament} style={{ color: theme.accent }}>
            {theme.scheduleStyle === 'floral' ? '❧' : theme.scheduleStyle === 'petals' ? '✿' : '✦'}
          </div>
          <div className={styles.heroEyebrow}>Вас приглашают</div>
          <div className={styles.heroOrnament} style={{ color: theme.accent }}>
            {theme.scheduleStyle === 'floral' ? '❧' : theme.scheduleStyle === 'petals' ? '✿' : '✦'}
          </div>
        </div>

        {/* Names */}
        <div className={styles.heroCenter}>
          <h1 className={styles.heroNames} style={{ fontFamily: `${theme.font}, serif`, color: '#fff' }}>
            {hasCouple
              ? <>{data.brideName || 'Невеста'} <span style={{ color: theme.accent, fontStyle: 'normal' }}>&</span> {data.groomName || 'Жених'}</>
              : <span style={{ opacity: 0.4 }}>Анна & Михаил</span>
            }
          </h1>

          {data.weddingDate && (
            <div className={styles.heroDate} style={{ color: 'rgba(255,255,255,0.85)' }}>
              {formatDate(data.weddingDate)}
              {data.venue && <> · {data.venue}</>}
            </div>
          )}
        </div>

        {/* Countdown */}
        {daysLeft !== null && daysLeft > 0 && (
          <div className={styles.heroCountdown}>
            <div className={styles.countdownNum} style={{ color: theme.accent }}>{daysLeft}</div>
            <div className={styles.countdownLabel}>дней до праздника</div>
          </div>
        )}
        {daysLeft === 0 && (
          <div className={styles.heroCountdown}>
            <div className={styles.countdownLabel} style={{ fontSize: 16, fontWeight: 700, color: theme.accent }}>
              🎉 Сегодня!
            </div>
          </div>
        )}

        {/* Scroll hint */}
        <div className={styles.heroScrollHint}>
          <div className={styles.scrollArrow}>↓</div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          INVITE TEXT
      ══════════════════════════════════════════════════ */}
      {data.inviteText && (
        <section className={styles.section} style={{ background: theme.card, borderBottom: `1px solid ${theme.divider}` }}>
          <p className={styles.inviteText} style={{ color: theme.dark, fontFamily: `${theme.font}, serif` }}>
            {data.inviteText}
          </p>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          EVENT DETAILS — дата, место, адрес, карта
      ══════════════════════════════════════════════════ */}
      {(data.venue || data.weddingDate) && (
        <section className={styles.section} style={{ background: `${theme.accent}0d`, borderBottom: `1px solid ${theme.divider}` }}>
          <SectionTitle title="Детали торжества" accent={theme.accent} style={theme.scheduleStyle} />
          <div className={styles.detailCards}>
            {data.weddingDate && (
              <DetailCard icon="📅" label="Дата" value={formatDate(data.weddingDate)} theme={theme} />
            )}
            {data.weddingTime && (
              <DetailCard icon="🕐" label="Начало" value={data.weddingTime} theme={theme} />
            )}
            {data.venue && (
              <DetailCard icon="📍" label="Место" value={data.venue} sub={data.venueAddress} theme={theme} />
            )}
          </div>
          {data.mapLink && (
            <a href={data.mapLink} target="_blank" rel="noopener noreferrer"
              className={styles.mapBtn} style={{ background: theme.accent, color: '#fff' }}>
              Открыть маршрут на карте →
            </a>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          SCHEDULE — расписание дня
      ══════════════════════════════════════════════════ */}
      {schedule.length > 0 && (
        <section className={styles.section} style={{ background: theme.bodyBg, borderBottom: `1px solid ${theme.divider}` }}>
          <SectionTitle title="Расписание дня" accent={theme.accent} style={theme.scheduleStyle} />
          <div className={styles.timeline}>
            {schedule.map((item, i) => (
              <div key={i} className={styles.timelineItem}>
                <div className={styles.timelineLeft}>
                  <div className={styles.timelineTime} style={{ color: theme.accent, fontFamily: `${theme.font}, serif` }}>
                    {item.time}
                  </div>
                </div>
                <div className={styles.timelineConnector}>
                  <div className={styles.timelineDot} style={{ background: theme.accent, boxShadow: `0 0 0 3px ${theme.accent}22` }} />
                  {i < schedule.length - 1 && <div className={styles.timelineLine} style={{ background: `${theme.accent}30` }} />}
                </div>
                <div className={styles.timelineRight}>
                  <div className={styles.timelineIcon}>{item.icon}</div>
                  <div className={styles.timelineTitle} style={{ color: theme.dark }}>{item.title}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          DRESS CODE
      ══════════════════════════════════════════════════ */}
      {data.dressCode && (
        <section className={styles.section} style={{ background: theme.card, borderBottom: `1px solid ${theme.divider}` }}>
          <SectionTitle title="Дресс-код" accent={theme.accent} style={theme.scheduleStyle} />
          <div className={styles.dressCodeBlock}
            style={{ borderColor: `${theme.accent}30`, background: `${theme.accent}07` }}>
            <div className={styles.dressCodeIcon}>👗</div>
            <div>
              <div className={styles.dressCodeName} style={{ color: theme.dark }}>{data.dressCode}</div>
              <div className={styles.dressCodeHint} style={{ color: theme.muted }}>
                Пожалуйста, соблюдайте цветовую гамму
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          STORY — история пары
      ══════════════════════════════════════════════════ */}
      {data.story && (
        <section className={styles.section} style={{ background: `${theme.accent}07`, borderBottom: `1px solid ${theme.divider}` }}>
          <SectionTitle title="Наша история" accent={theme.accent} style={theme.scheduleStyle} />
          <p className={styles.storyText} style={{ color: theme.dark, fontFamily: `${theme.font}, serif` }}>
            {data.story}
          </p>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          GALLERY
      ══════════════════════════════════════════════════ */}
      {data.galleryPhotos.length > 0 && (
        <section className={styles.section} style={{ background: theme.bodyBg, borderBottom: `1px solid ${theme.divider}` }}>
          <SectionTitle title="Фотографии" accent={theme.accent} style={theme.scheduleStyle} />
          <div className={styles.gallery}>
            {data.galleryPhotos.slice(0, 6).map((url, i) => (
              <div key={i}
                className={`${styles.galleryItem} ${i === 0 ? styles.galleryItemLarge : ''}`}
                style={{ backgroundImage: `url(${apiBase}${url})` }} />
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          RSVP — анкета гостя
      ══════════════════════════════════════════════════ */}
      <section className={styles.rsvpSection}
        style={{ background: `linear-gradient(160deg, ${theme.bg}, ${theme.accent}18)`, borderBottom: `1px solid ${theme.divider}` }}>
        <SectionTitle title="Анкета гостя" accent={theme.accent} style={theme.scheduleStyle} />
        <p className={styles.rsvpIntro} style={{ color: theme.muted }}>
          Пожалуйста, ответьте до {data.weddingDate ? formatDateShort(new Date(new Date(data.weddingDate).getTime() - 14 * 86400000).toISOString()) : 'даты свадьбы'}
        </p>

        {rsvpStatus === 'sent' ? (
          <div className={styles.rsvpThanks} style={{ color: theme.dark }}>
            <div style={{ fontSize: fullPage ? 48 : 32, marginBottom: 8 }}>🎉</div>
            <div style={{ fontFamily: `${theme.font}, serif`, fontSize: fullPage ? 24 : 18, marginBottom: 4 }}>Спасибо!</div>
            <div style={{ fontSize: 13, color: theme.muted }}>Ваши пожелания приняты</div>
          </div>
        ) : (
          <div className={styles.rsvpForm}>
            <input className={styles.rsvpInput} style={{ borderColor: `${theme.accent}44` }}
              placeholder="Ваше имя и фамилия" value={rsvpName}
              onChange={e => setRsvpName(e.target.value)} />

            <div className={styles.rsvpAttend}>
              <button
                className={`${styles.rsvpBtn} ${attending === true ? styles.rsvpBtnYes : ''}`}
                style={attending === true
                  ? { background: theme.accent, color: '#fff', borderColor: theme.accent }
                  : { borderColor: `${theme.accent}55`, color: theme.dark }}
                onClick={() => setAttending(true)}>✓ Буду</button>
              <button
                className={`${styles.rsvpBtn} ${attending === false ? styles.rsvpBtnNo : ''}`}
                style={attending === false
                  ? { background: '#e74c3c22', borderColor: '#e74c3c', color: '#e74c3c' }
                  : { borderColor: `${theme.accent}55`, color: theme.dark }}
                onClick={() => setAttending(false)}>✗ Не смогу</button>
            </div>

            {attending === true && (
              <>
                <div className={styles.drinkLabel2} style={{ color: theme.muted }}>Предпочтения в напитках</div>
                <div className={styles.drinkGrid}>
                  {DRINKS.map(d => (
                    <button key={d.id}
                      className={`${styles.drinkBtn} ${drink === d.id ? styles.drinkBtnActive : ''}`}
                      style={drink === d.id
                        ? { background: `${theme.accent}20`, borderColor: theme.accent }
                        : { borderColor: `${theme.accent}30` }}
                      onClick={() => setDrink(d.id)}>
                      <span style={{ fontSize: fullPage ? 22 : 16 }}>{d.emoji}</span>
                      <span className={styles.drinkItemLabel}>{d.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <textarea className={styles.rsvpInput}
              style={{ borderColor: `${theme.accent}44`, minHeight: 72, resize: 'none' }}
              placeholder="Пожелания молодожёнам 💌"
              value={wishes} onChange={e => setWishes(e.target.value)} />

            <button className={styles.rsvpSubmit}
              style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.light})`, color: '#fff' }}
              onClick={handleRsvp}
              disabled={!rsvpName.trim() || rsvpStatus === 'sending'}>
              {rsvpStatus === 'sending' ? 'Отправляем...' : '✦ Отправить'}
            </button>

            {rsvpStatus === 'error' && (
              <div style={{ color: '#e74c3c', fontSize: 12, textAlign: 'center' }}>Попробуйте ещё раз</div>
            )}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════ */}
      <div className={styles.footer} style={{ background: theme.heroBg }}>
        <div className={styles.footerNames} style={{ fontFamily: `${theme.font}, serif`, color: '#fff' }}>
          {data.brideName || 'Невеста'} <span style={{ color: theme.accent }}>&</span> {data.groomName || 'Жених'}
        </div>
        {data.weddingDate && (
          <div className={styles.footerDate} style={{ color: 'rgba(255,255,255,0.6)' }}>
            {formatDate(data.weddingDate)}
          </div>
        )}
        <div className={styles.footerBrand} style={{ color: theme.accent }}>
          ✦ WeddingCraft ✦
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function SectionTitle({ title, accent, style: s }: { title: string; accent: string; style: string }) {
  const ornament = s === 'floral' ? '❧' : s === 'petals' ? '✿' : s === 'vintage' ? '⚘' : '✦';
  return (
    <div style={{ textAlign: 'center', marginBottom: 20 }}>
      <div style={{ color: accent, fontSize: 11, letterSpacing: 4, marginBottom: 6, opacity: 0.7 }}>
        {ornament}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 3,
        textTransform: 'uppercase', color: accent, opacity: 0.9,
      }}>{title}</div>
      <div style={{ width: 40, height: 1, background: accent, margin: '8px auto 0', opacity: 0.4 }} />
    </div>
  );
}

function DetailCard({ icon, label, value, sub, theme }: {
  icon: string; label: string; value: string; sub?: string;
  theme: typeof THEMES.classic;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 14px',
      background: theme.card,
      borderRadius: 12,
      border: `1px solid ${theme.divider}`,
      marginBottom: 8,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: theme.muted, fontWeight: 700, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: theme.dark }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}
