'use client';
import { useState, useEffect, useRef } from 'react';
import styles from './ParchmentTemplate.module.css';
import type { InviteData } from './TemplatePreview';

interface Props {
  data: InviteData;
  apiBase: string;
  fullPage?: boolean;
  slug?: string;
}

const DRINKS = [
  { id: 'wine', label: 'Вино', emoji: '🍷' },
  { id: 'champagne', label: 'Шампанское', emoji: '🥂' },
  { id: 'juice', label: 'Сок', emoji: '🧃' },
  { id: 'water', label: 'Вода', emoji: '💧' },
  { id: 'no_alcohol', label: 'Без алкоголя', emoji: '🚫' },
  { id: 'other', label: 'Другое', emoji: '🍹' },
];

function img(a: string, u: string) {
  if (!u) return '';
  return u.startsWith('http') ? u : `${a}${u}`;
}

function parseDateParts(d: string) {
  if (!d) return null;
  try {
    const dt = new Date(d);
    const months = ['Января','Февраля','Марта','Апреля','Мая','Июня','Июля','Августа','Сентября','Октября','Ноября','Декабря'];
    const monthsShort = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    return {
      day: dt.getDate(),
      month: months[dt.getMonth()],
      monthShort: monthsShort[dt.getMonth()],
      year: dt.getFullYear(),
      monthIdx: dt.getMonth(),
      dayOfWeek: dt.getDay(),
    };
  } catch { return null; }
}

/* Build a mini calendar grid for the wedding month */
function buildCalendar(dateStr: string) {
  if (!dateStr) return null;
  const dt = new Date(dateStr);
  const year = dt.getFullYear();
  const month = dt.getMonth();
  const weddingDay = dt.getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Shift so Monday=0
  const startOffset = (firstDay + 6) % 7;
  const cells: { day: number; isWedding: boolean; isEmpty: boolean }[] = [];
  for (let i = 0; i < startOffset; i++) cells.push({ day: 0, isWedding: false, isEmpty: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, isWedding: d === weddingDay, isEmpty: false });
  return { cells, weddingDay };
}

function useCountdown(dateStr: string) {
  const [t, setT] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  useEffect(() => {
    if (!dateStr) return;
    const calc = () => {
      const diff = new Date(dateStr).getTime() - Date.now();
      if (diff <= 0) { setT({ d: 0, h: 0, m: 0, s: 0 }); return; }
      setT({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [dateStr]);
  return t;
}

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible: v };
}

function Reveal({ children, on, delay = 0, dir = 'up' }: {
  children: React.ReactNode; on: boolean; delay?: number; dir?: string;
}) {
  const { ref, visible } = useInView();
  if (!on) return <>{children}</>;
  const t: Record<string, string> = { up: 'translateY(40px)', left: 'translateX(-30px)', right: 'translateX(30px)' };
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : (t[dir] || t.up),
      transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
    }}>
      {children}
    </div>
  );
}

const SvgHanger = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M2 17h20" />
    <path d="M12 17V8a2 2 0 1 1 4 0v1h-8V8a2 2 0 0 1 2-2" />
    <path d="M12 2v4" />
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

export default function ParchmentTemplate({ data, apiBase, fullPage = false, slug }: Props) {
  const dp = parseDateParts(data.weddingDate);
  const cd = useCountdown(data.weddingDate);
  const cal = buildCalendar(data.weddingDate);
  const schedule = Array.isArray(data.schedule) ? data.schedule : [];
  const sec = data.enabledSections ?? {};
  const isOn = (k: string) => sec[k] !== false;
  const coverUrl = data.coverPhoto ? img(apiBase, data.coverPhoto) : '';

  const [rsvpName, setRsvpName] = useState('');
  const [attending, setAttending] = useState<boolean | null>(null);
  const [drink, setDrink] = useState('');
  const [wishes, setWishes] = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleRsvp = async () => {
    if (!rsvpName.trim()) return;
    setRsvpStatus('sending');
    try {
      const s = slug || data.slug || '';
      if (!s) { setRsvpStatus('sent'); return; }
      const res = await fetch(`${apiBase}/api/rsvp/${s}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName: rsvpName, attending: attending !== false, drinkChoice: drink, wishes }),
      });
      setRsvpStatus(res.ok ? 'sent' : 'error');
    } catch { setRsvpStatus('error'); }
  };

  const weekDays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

  return (
    <div className={`${styles.root} ${fullPage ? styles.rootFull : ''}`}>

      {/* ═══ HERO ═══ */}
      <section className={styles.hero}>
        {/* Background photo */}
        {coverUrl && <div className={styles.heroBg} style={{ backgroundImage: `url(${coverUrl})` }} />}
        <div className={styles.heroOverlay} />

        {/* Parchment ornament — top triangle */}
        <div className={styles.ornamentTop}>
          <svg viewBox="0 0 400 200" preserveAspectRatio="none" className={styles.ornamentSvg}>
            <polygon points="0,0 400,0 200,200" fill="#583434" opacity="0.35" />
          </svg>
        </div>

        {/* Parchment ornament — bottom arch */}
        <div className={styles.ornamentBottom}>
          <svg viewBox="0 0 400 120" preserveAspectRatio="none" className={styles.ornamentSvg}>
            <path d="M0,120 C100,20 300,20 400,120 L400,0 L0,0 Z" fill="#583434" opacity="0.25" />
          </svg>
        </div>

        {/* Hero content */}
        <div className={styles.heroContent}>
          <div className={styles.heroLabel}>Приглашение на свадьбу</div>

          <div className={styles.heroNames}>
            <span className={styles.heroName}>{data.brideName || 'Дарья'}</span>
            <span className={styles.heroAmp}>&</span>
            <span className={styles.heroName}>{data.groomName || 'Вадим'}</span>
          </div>

          {dp && (
            <div className={styles.heroDate}>
              {dp.day}<span className={styles.heroDateSep}></span>{dp.month.toUpperCase()}<span className={styles.heroDateSep}></span>{dp.year}
            </div>
          )}
        </div>

        {/* Scroll hint */}
        {fullPage && (
          <div className={styles.scrollHint}>
            <div className={styles.scrollLine} />
          </div>
        )}
      </section>

      {/* ═══ PARCHMENT CONTENT ═══ */}
      <div className={styles.parchment}>
        {/* Double border frame */}
        <div className={styles.frameOuter}>
          <div className={styles.frameInner}>

            {/* Greeting */}
            {isOn('couple') && (
              <Reveal on={fullPage}>
                <section className={styles.section}>
                  <h2 className={styles.calliTitle}>Дорогие гости!</h2>
                  <p className={styles.bodyText}>
                    {data.inviteText || 'Приглашаем вас разделить радость того особенного для нас события и стать частью начала семейной истории'}
                  </p>
                </section>
              </Reveal>
            )}

            {/* Calendar */}
            {dp && cal && (
              <Reveal on={fullPage} delay={0.1}>
                <section className={styles.section}>
                  <h2 className={styles.calliTitle}>{dp.monthShort}</h2>
                  <div className={styles.calendar}>
                    <div className={styles.calWeekRow}>
                      {weekDays.map(w => (
                        <div key={w} className={styles.calWeekDay}>{w}</div>
                      ))}
                    </div>
                    <div className={styles.calGrid}>
                      {cal.cells.map((c, i) => (
                        <div key={i} className={`${styles.calDay} ${c.isWedding ? styles.calDayWedding : ''} ${c.isEmpty ? styles.calDayEmpty : ''}`}>
                          {!c.isEmpty && c.day}
                          {c.isWedding && <span className={styles.calHeart}>♥</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </Reveal>
            )}

            {/* Venue */}
            {isOn('event') && data.venue && (
              <Reveal on={fullPage} delay={0.15}>
                <section className={styles.section}>
                  <div className={styles.venueLabel}>Ждем вас в</div>
                  <div className={styles.venueName}>&ldquo;{data.venue}&rdquo;</div>
                  {data.venueAddress && <div className={styles.venueAddr}>{data.venueAddress}</div>}
                  {data.galleryPhotos?.[0] && (
                    <div className={styles.venueImgWrap}>
                      <img src={img(apiBase, data.galleryPhotos[0])} alt={data.venue} className={styles.venueImg} />
                    </div>
                  )}
                  {data.mapLink && (
                    <a href={data.mapLink} target="_blank" rel="noopener noreferrer" className={styles.mapBtn}>
                      Показать на карте →
                    </a>
                  )}
                </section>
              </Reveal>
            )}

            {/* Schedule / Program */}
            {isOn('schedule') && schedule.length > 0 && (
              <Reveal on={fullPage} delay={0.1} dir="left">
                <section className={styles.section}>
                  <h2 className={styles.calliTitle}>Программа дня</h2>
                  <div className={styles.timeline}>
                    {schedule.map((item, i) => (
                      <div key={i} className={styles.tlItem}>
                        <div className={styles.tlLeft}>
                          <div className={styles.tlTime}>{item.time}</div>
                        </div>
                        <div className={styles.tlCenter}>
                          <div className={styles.tlDot} />
                          {i < schedule.length - 1 && <div className={styles.tlLine} />}
                        </div>
                        <div className={styles.tlRight}>
                          <div className={styles.tlTitle}>{item.title}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </Reveal>
            )}

            {/* Dress code */}
            {isOn('style') && data.dressCode && (
              <Reveal on={fullPage} delay={0.05}>
                <section className={styles.section}>
                  <h2 className={styles.calliTitle}>Дресс-код</h2>
                  <div className={styles.dressBlock}>
                    <span className={styles.dressIcon}><SvgHanger /></span>
                    <span className={styles.dressValue}>{data.dressCode}</span>
                  </div>
                </section>
              </Reveal>
            )}

            {/* RSVP */}
            <Reveal on={fullPage} delay={0.1}>
              <section className={styles.section}>
                <h2 className={styles.calliTitle}>Подтверждение</h2>
                <p className={styles.bodyTextSm}>
                  Пожалуйста, подтвердите своё присутствие, это важно для нас.
                </p>

                {rsvpStatus === 'sent' ? (
                  <div className={styles.rsvpThanks}>
                    <div className={styles.rsvpThanksIcon}>💌</div>
                    <div className={styles.rsvpThanksText}>Спасибо! Ваш ответ принят.</div>
                  </div>
                ) : (
                  <div className={styles.rsvpForm}>
                    <input className={styles.rsvpInput} placeholder="Ваше имя" value={rsvpName} onChange={e => setRsvpName(e.target.value)} />
                    <div className={styles.rsvpBtns}>
                      <button className={`${styles.rsvpBtn} ${attending === true ? styles.rsvpBtnYes : ''}`} onClick={() => setAttending(true)}>Буду</button>
                      <button className={`${styles.rsvpBtn} ${attending === false ? styles.rsvpBtnNo : ''}`} onClick={() => setAttending(false)}>Не смогу</button>
                    </div>
                    {attending === true && (
                      <>
                        <div className={styles.drinkLabel}>Предпочтения в напитках</div>
                        <div className={styles.drinkGrid}>
                          {DRINKS.map(d => (
                            <button key={d.id} className={`${styles.drinkBtn} ${drink === d.id ? styles.drinkBtnActive : ''}`} onClick={() => setDrink(d.id)}>
                              <div className={styles.drinkIcon}>{getDrinkIcon(d.id)}</div><span className={styles.drinkName}>{d.label}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <textarea className={styles.rsvpInput} style={{ minHeight: 70, resize: 'none' }} placeholder="Пожелания молодожёнам 💌" value={wishes} onChange={e => setWishes(e.target.value)} />
                    <button className={styles.rsvpSubmit} onClick={handleRsvp} disabled={!rsvpName.trim() || rsvpStatus === 'sending'}>
                      {rsvpStatus === 'sending' ? 'Отправляем...' : 'Отправить'}
                    </button>
                    {rsvpStatus === 'error' && <div className={styles.rsvpError}>Попробуйте ещё раз</div>}
                  </div>
                )}
              </section>
            </Reveal>

          </div>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer className={styles.footer}>
        <div className={styles.footerNames}>
          {data.brideName || 'Дарья'} & {data.groomName || 'Вадим'}
        </div>
        {dp && <div className={styles.footerDate}>{dp.day} {dp.month} {dp.year}</div>}
        <div className={styles.footerBrand}>✦ Eloquence ✦</div>
      </footer>
    </div>
  );
}
