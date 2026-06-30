'use client';
import { useState, useEffect, useRef } from 'react';
import styles from './ClassicTemplate.module.css';
import type { InviteData } from './TemplatePreview';

interface Props {
  data: InviteData;
  apiBase: string;
  fullPage?: boolean;
  slug?: string;
}

const DRINKS = [
  { id: 'wine',       label: 'Вино',        emoji: '🍷' },
  { id: 'champagne',  label: 'Шампанское',  emoji: '🥂' },
  { id: 'juice',      label: 'Сок',         emoji: '🧃' },
  { id: 'water',      label: 'Вода',        emoji: '💧' },
  { id: 'no_alcohol', label: 'Без алкоголя',emoji: '🚫' },
  { id: 'other',      label: 'Другое',      emoji: '🍹' },
];

function getImageUrl(apiBase: string, url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${apiBase}${url}`;
}

function parseDateParts(dateStr: string): { day: number; monthName: string; year: number } | null {
  if (!dateStr) return null;
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const months = ['ЯНВАРЯ','ФЕВРАЛЯ','МАРТА','АПРЕЛЯ','МАЯ','ИЮНЯ',
                    'ИЮЛЯ','АВГУСТА','СЕНТЯБРЯ','ОКТЯБРЯ','НОЯБРЯ','ДЕКАБРЯ'];
    return { day: d, monthName: months[m - 1] || '', year: y };
  } catch { return null; }
}

function parseDatePartsScript(dateStr: string): { day: number; monthName: string } | null {
  if (!dateStr) return null;
  try {
    const [, m, d] = dateStr.split('-').map(Number);
    const months = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                    'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    return { day: d, monthName: months[m - 1] || '' };
  } catch { return null; }
}

function formatDeadline(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 14);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  } catch { return ''; }
}

// ── Scroll reveal ──────────────────────────────────────────────────────────
function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, active, delay = 0 }: {
  children: React.ReactNode; active: boolean; delay?: number;
}) {
  const { ref, visible } = useInView();
  if (!active) return <>{children}</>;
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : 'translateY(36px)',
      transition: `opacity 0.65s ease ${delay}s, transform 0.65s ease ${delay}s`,
    }}>
      {children}
    </div>
  );
}

const ClassicOrnament = () => (
  <div className={styles.ornamentDivider}>
    <svg width="80" height="30" viewBox="0 0 100 30" fill="none" style={{ margin: '0 auto' }}>
      <path d="M10 15 L40 15 M60 15 L90 15" stroke="#c9b89a" strokeWidth="1" strokeLinecap="round" />
      <path d="M50 15 C45 9 38 15 50 15 Z" fill="#c9b89a" opacity="0.8" />
      <path d="M50 15 C55 9 62 15 50 15 Z" fill="#c9b89a" opacity="0.8" />
      <circle cx="50" cy="15" r="2.5" fill="#f5f2ee" stroke="#c9b89a" strokeWidth="1" />
    </svg>
  </div>
);

const ClassicBuilding = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#b0a090" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
    <path d="M3 22h18" />
    <path d="M6 18v-7h12v7" />
    <path d="M4 11h16L12 4z" />
    <path d="M9 18v-4h6v4" />
  </svg>
);

const getDrinkIcon = (id: string) => {
  switch (id) {
    case 'wine':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
          <path d="M8 22h8M12 11v11M12 2a5 5 0 0 0-5 5v4a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z" />
        </svg>
      );
    case 'champagne':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
          <path d="M12 22h8M16 15v7M16 4a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3z" opacity="0.9" />
          <path d="M6 22h6M9 13v9M9 2a2.5 2.5 0 0 0-2.5 2.5v6a2.5 2.5 0 0 0 5 0v-6A2.5 2.5 0 0 0 9 2z" transform="rotate(-15 9 12)" />
        </svg>
      );
    case 'juice':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
          <rect x="5" y="6" width="12" height="14" rx="1.5" />
          <path d="M11 2v4M15 6V4a1 1 0 0 0-1-1h-4" />
        </svg>
      );
    case 'water':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      );
    case 'no_alcohol':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
          <circle cx="12" cy="12" r="10" />
          <path d="m4.93 4.93 14.14 14.14M9 10a3 3 0 0 1 6 0" />
        </svg>
      );
    default:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
          <path d="M12 22a7 7 0 0 0 7-7V4H5v11a7 7 0 0 0 7 7z" />
          <path d="M12 2v2M5 10h14" />
        </svg>
      );
  }
};

export default function ClassicTemplate({ data, apiBase, fullPage = false, slug }: Props) {
  const schedule = Array.isArray(data.schedule) ? data.schedule : [];
  const sec = data.enabledSections ?? {};
  const isOn = (key: string) => sec[key] !== false;
  const coverUrl = data.coverPhoto ? getImageUrl(apiBase, data.coverPhoto) : '';
  const dateParts = parseDateParts(data.weddingDate);
  const dateScript = parseDatePartsScript(data.weddingDate);

  const [rsvpName, setRsvpName]     = useState('');
  const [attending, setAttending]   = useState<boolean | null>(null);
  const [drink, setDrink]           = useState('');
  const [wishes, setWishes]         = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle');

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

  const cls = `${styles.classic} ${fullPage ? styles.classicFull : ''}`;

  return (
    <div className={cls}>

      {/* ═══ HERO ═══════════════════════════════════════════════════════════ */}
      <div className={styles.hero}>
        {coverUrl && (
          <div className={styles.heroBg} style={{ backgroundImage: `url(${coverUrl})` }} />
        )}
        <div className={styles.heroBgOverlay} />
        <div className={styles.heroContent}>
          {/* Top label */}
          <div className={`${styles.heroLabel} ${styles.heroAnimLabel}`}>Приглашение на свадьбу</div>

          {/* Names stacked */}
          <div className={styles.heroNames}>
            <div className={`${styles.heroName} ${styles.heroAnimName1}`}>{data.groomName || 'Жених'}</div>
            <div className={`${styles.heroAmpersand} ${styles.heroAnimAmp}`}>&</div>
            <div className={`${styles.heroName} ${styles.heroAnimName2}`}>{data.brideName || 'Невеста'}</div>
          </div>

          {/* Date */}
          {dateParts && (
            <div className={`${styles.heroDate} ${styles.heroAnimDate}`}>
              <span className={styles.heroDatePart}>{dateParts.day}</span>
              <div className={styles.heroDateDot} />
              <span className={styles.heroDatePart}>{dateParts.monthName}</span>
              <div className={styles.heroDateDot} />
              <span className={styles.heroDatePart}>{dateParts.year}</span>
            </div>
          )}
        </div>
      </div>

      {/* INVITE + VENUE */}
      {isOn('couple') && (
        <Reveal active={fullPage}>
          <div className={styles.inviteSection}>
            <div className={styles.ovalCard}>
              <div className={styles.ovalTitle}>Дорогие гости!</div>
            </div>
            {data.inviteText && <p className={styles.inviteText}>{data.inviteText}</p>}
            {dateScript && (
              <div className={styles.dateStrip}>
                <span className={styles.dateStripMonth}>{dateScript.monthName}</span>
                {[-2, -1, 0, 1, 2].map(offset => {
                  const d = dateScript.day + offset;
                  return (
                    <div key={offset}
                      className={`${styles.dateStripDay} ${offset === 0 ? styles.dateStripDayActive : ''} ${Math.abs(offset) === 2 ? styles.dateStripDaySide : ''}`}
                    >{d}</div>
                  );
                })}
              </div>
            )}
            {isOn('event') && data.venue && (
              <><div className={styles.venueDivider}>Ждем вас в</div><div className={styles.venueName}>«{data.venue}»</div></>
            )}
            {isOn('event') && (
              data.galleryPhotos?.[0]
                ? <img src={getImageUrl(apiBase, data.galleryPhotos[0])} alt={data.venue} className={styles.venuePhoto} />
                : <div className={styles.venuePhotoPlaceholder}><ClassicBuilding /></div>
            )}
            {data.mapLink && (
              <a href={data.mapLink} target="_blank" rel="noopener noreferrer" className={styles.mapLink}>Посмотреть на карте →</a>
            )}
          </div>
        </Reveal>
      )}

      {/* SCHEDULE */}
      {isOn('schedule') && schedule.length > 0 && (
        <Reveal active={fullPage} delay={0.05}>
          <ClassicOrnament />
          <div className={styles.scheduleSection}>
            <div className={styles.scheduleTitle}>Программа дня</div>
            <div className={styles.timeline}>
              {schedule.map((item, i) => (
                <div key={i} className={styles.timelineItem}>
                  <div className={styles.timelineTime}>{item.time}</div>
                  <div className={styles.timelineConnector}>
                    <div className={styles.timelineDot} />
                    {i < schedule.length - 1 && <div className={styles.timelineLine} />}
                  </div>
                  <div className={styles.timelineBody}>
                    <div className={styles.timelineEventTitle}>{item.icon} {item.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* DRESS CODE */}
      {isOn('style') && data.dressCode && (
        <Reveal active={fullPage}>
          <div className={styles.dressSection}>
            <div className={styles.dressSectionTitle}>Дресс-код</div>
            <div className={styles.dressCode}>{data.dressCode}</div>
            <div className={styles.dressHint}>Пожалуйста, соблюдайте цветовую гамму</div>
          </div>
        </Reveal>
      )}

      {/* STORY */}
      {isOn('style') && data.story && (
        <Reveal active={fullPage}>
          <div className={styles.storySection}>
            <div className={styles.storyTitle}>Наша история</div>
            <p className={styles.storyText}>{data.story}</p>
          </div>
        </Reveal>
      )}

      {/* GALLERY */}
      {isOn('gallery') && data.galleryPhotos.length > 0 && (
        <Reveal active={fullPage} delay={0.05}>
          <div className={styles.gallerySection}>
            <div className={styles.galleryGrid}>
              {data.galleryPhotos.slice(0, 6).map((url, i) => (
                <div key={i}
                  className={`${styles.galleryItem} ${i === 0 ? styles.galleryItemLarge : ''}`}
                  style={{ backgroundImage: `url(${getImageUrl(apiBase, url)})` }}
                />
              ))}
            </div>
          </div>
        </Reveal>
      )}


      {/* RSVP */}
      <Reveal active={fullPage}>
        <div className={styles.rsvpSection}>
          <div className={styles.rsvpOval}>
            <div className={styles.rsvpTitle}>Анкета гостя</div>
          </div>
          {data.weddingDate && (
            <p className={styles.rsvpSubtitle}>Ответьте до {formatDeadline(data.weddingDate)}</p>
          )}
          {rsvpStatus === 'sent' ? (
            <div className={styles.rsvpThanks}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontStyle: 'italic', color: '#2c2418', marginBottom: 4 }}>Спасибо!</div>
              <div style={{ fontSize: 12, color: '#9a8878' }}>Ваши пожелания приняты</div>
            </div>
          ) : (
            <div className={styles.rsvpForm}>
              <input className={styles.rsvpInput} placeholder="Ваше имя и фамилия" value={rsvpName} onChange={e => setRsvpName(e.target.value)} />
              <div className={styles.rsvpButtons}>
                <button className={`${styles.rsvpBtn} ${attending === true ? styles.rsvpBtnYes : ''}`} onClick={() => setAttending(true)}>Буду</button>
                <button className={`${styles.rsvpBtn} ${attending === false ? styles.rsvpBtnNo : ''}`} onClick={() => setAttending(false)}>Не смогу</button>
              </div>
              {attending === true && (
                <>
                  <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#b0a090', textAlign: 'center' }}>Предпочтения в напитках</div>
                  <div className={styles.drinkGrid}>
                    {DRINKS.map(d => (
                      <button key={d.id} className={`${styles.drinkBtn} ${drink === d.id ? styles.drinkBtnActive : ''}`} onClick={() => setDrink(d.id)}>
                        <div className={styles.drinkIcon}>{getDrinkIcon(d.id)}</div>
                        <span className={styles.drinkLabel}>{d.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <textarea className={styles.rsvpInput} style={{ minHeight: 72, resize: 'none' }} placeholder="Пожелания молодожёнам 💌" value={wishes} onChange={e => setWishes(e.target.value)} />
              <button className={styles.rsvpSubmit} onClick={handleRsvp} disabled={!rsvpName.trim() || rsvpStatus === 'sending'}>
                {rsvpStatus === 'sending' ? 'Отправляем...' : '✦ Отправить'}
              </button>
              {rsvpStatus === 'error' && <div style={{ color: '#b43c3c', fontSize: 12, textAlign: 'center' }}>Попробуйте ещё раз</div>}
            </div>
          )}
        </div>
      </Reveal>

      {/* ═══ FOOTER ═════════════════════════════════════════════════════════ */}
      <div className={styles.footer}>
        <div className={styles.footerNames}>
          {data.groomName || 'Жених'} <span style={{ color: '#c9a96e' }}>&</span> {data.brideName || 'Невеста'}
        </div>
        {dateParts && (
          <div className={styles.footerDate}>
            {dateParts.day} {dateParts.monthName} {dateParts.year}
          </div>
        )}
        <div className={styles.footerBrand}>✦ Eloquence ✦</div>
      </div>

    </div>
  );
}
