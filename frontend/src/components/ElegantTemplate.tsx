'use client';
import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import styles from './ElegantTemplate.module.css';
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
    const months = ['Января','Февраля','Марта','Апреля','Мая','Июня',
                    'Июля','Августа','Сентября','Октября','Ноября','Декабря'];
    return { day: d, monthName: months[m - 1] || '', year: y };
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

function Reveal({ children, active, delay = 0, effect = 'fade-up' }: {
  children: React.ReactNode; active: boolean; delay?: number; effect?: 'fade-up' | 'fade-in';
}) {
  const { ref, visible } = useInView();
  if (!active) return <>{children}</>;
  
  const transform = effect === 'fade-up' ? (visible ? 'none' : 'translateY(30px)') : 'none';
  
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform,
      transition: `opacity 0.8s ease ${delay}s, transform 0.8s ease ${delay}s`,
    }}>
      {children}
    </div>
  );
}

const OrnamentLine = () => (
  <div className={styles.ornamentLine}>
    <svg width="80" height="20" viewBox="0 0 100 20" fill="none" style={{ margin: '0 auto' }}>
      <path d="M10 10 L40 10 M60 10 L90 10" stroke="#d1bfae" strokeWidth="1" strokeLinecap="round" />
      <path d="M50 10 C46 6 42 6 40 10 C42 14 46 14 50 10 Z" fill="#d1bfae" opacity="0.8" />
      <path d="M50 10 C54 6 58 6 60 10 C58 14 54 14 50 10 Z" fill="#d1bfae" opacity="0.8" />
      <circle cx="50" cy="10" r="2.5" fill="#faf8f5" stroke="#d1bfae" strokeWidth="1" />
    </svg>
  </div>
);

const getDrinkIcon = (id: string) => {
  switch (id) {
    case 'wine':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
          <path d="M8 22h8M12 11v11M12 2a5 5 0 0 0-5 5v4a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z" />
        </svg>
      );
    case 'champagne':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
          <path d="M12 22h8M16 15v7M16 4a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3z" opacity="0.9" />
          <path d="M6 22h6M9 13v9M9 2a2.5 2.5 0 0 0-2.5 2.5v6a2.5 2.5 0 0 0 5 0v-6A2.5 2.5 0 0 0 9 2z" transform="rotate(-15 9 12)" />
        </svg>
      );
    case 'juice':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
          <rect x="5" y="6" width="12" height="14" rx="1.5" />
          <path d="M11 2v4M15 6V4a1 1 0 0 0-1-1h-4" />
        </svg>
      );
    case 'water':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      );
    case 'no_alcohol':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
          <circle cx="12" cy="12" r="10" />
          <path d="m4.93 4.93 14.14 14.14M9 10a3 3 0 0 1 6 0" />
        </svg>
      );
    default:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
          <path d="M12 22a7 7 0 0 0 7-7V4H5v11a7 7 0 0 0 7 7z" />
          <path d="M12 2v2M5 10h14" />
        </svg>
      );
  }
};

const getDetailIcon = (type: 'date' | 'time' | 'venue') => {
  switch (type) {
    case 'date':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'time':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'venue':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
  }
};

export default function ElegantTemplate({ data, apiBase, fullPage = false, slug }: Props) {
  const schedule = Array.isArray(data.schedule) ? data.schedule : [];
  const sec = data.enabledSections ?? {};
  const isOn = (key: string) => sec[key] !== false;
  const coverUrl = data.coverPhoto ? getImageUrl(apiBase, data.coverPhoto) : '';
  const dateParts = parseDateParts(data.weddingDate);

  const [rsvpName, setRsvpName]     = useState('');
  const [attending, setAttending]   = useState<boolean | null>(null);
  const [drink, setDrink]           = useState('');
  const [wishes, setWishes]         = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle');

  // Trigger confetti on mount for fullPage view just like vadim-daria.ru
  useEffect(() => {
    if (fullPage) {
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#e4d5cc', '#d1bfae', '#ffffff']
        });
      }, 1000);
    }
  }, [fullPage]);

  const handleRsvp = async () => {
    if (!rsvpName.trim()) return;
    setRsvpStatus('sending');
    try {
      const effectiveSlug = slug || data.slug || '';
      if (!effectiveSlug) { 
        setRsvpStatus('sent'); 
        triggerConfetti();
        return; 
      }
      const res = await fetch(`${apiBase}/api/rsvp/${effectiveSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName: rsvpName, attending: attending !== false, drinkChoice: drink, wishes }),
      });
      if (res.ok) {
        setRsvpStatus('sent');
        triggerConfetti();
      } else {
        setRsvpStatus('error');
      }
    } catch { setRsvpStatus('error'); }
  };

  const triggerConfetti = () => {
    const end = Date.now() + 2 * 1000;
    const colors = ['#e4d5cc', '#d1bfae', '#f7ede8'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  const cls = `${styles.elegant} ${fullPage ? styles.elegantFull : ''}`;

  return (
    <div className={cls}>
      {/* HERO */}
      <div className={styles.hero}>
        <div className={styles.heroTopGradient} />
        {coverUrl && (
          <div className={styles.heroBg} style={{ backgroundImage: `url(${coverUrl})` }} />
        )}
        <div className={styles.heroBgOverlay} />
        
        <div className={styles.heroContent}>
          <div className={`${styles.heroSubtitle} ${styles.animFadeInUp}`}>Приглашение на свадьбу</div>
          
          <div className={styles.heroNames}>
            <div className={`${styles.heroName} ${styles.animFadeInLeft}`}>{data.groomName || 'Жених'}</div>
            <div className={`${styles.heroAmpersand} ${styles.animZoomIn}`}>&</div>
            <div className={`${styles.heroName} ${styles.animFadeInRight}`}>{data.brideName || 'Невеста'}</div>
          </div>

          {dateParts && (
            <div className={`${styles.heroDate} ${styles.animFadeInUpDelay}`}>
              <span>{dateParts.day}</span>
              <span className={styles.heroDateDivider}>|</span>
              <span className={styles.heroDateMonth}>{dateParts.monthName}</span>
              <span className={styles.heroDateDivider}>|</span>
              <span>{dateParts.year}</span>
            </div>
          )}
        </div>
      </div>

      {/* INVITE TEXT */}
      {isOn('couple') && (
        <Reveal active={fullPage}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Дорогие гости!</div>
            <OrnamentLine />
            {data.inviteText && <p className={styles.inviteText}>{data.inviteText}</p>}
          </div>
        </Reveal>
      )}

      {/* VENUE */}
      {isOn('event') && (data.venue || data.weddingTime) && (
        <Reveal active={fullPage}>
          <div className={`${styles.section} ${styles.venueSection}`}>
            <div className={styles.sectionTitle}>Детали торжества</div>
            <OrnamentLine />
            
            <div className={styles.detailsGrid}>
              {data.weddingDate && (
                <div className={styles.detailItem}>
                  <div className={styles.detailIcon}>{getDetailIcon('date')}</div>
                  <div className={styles.detailLabel}>Дата</div>
                  <div className={styles.detailValue}>
                    {dateParts?.day} {dateParts?.monthName?.toLowerCase()} {dateParts?.year}
                  </div>
                </div>
              )}
              {data.weddingTime && (
                <div className={styles.detailItem}>
                  <div className={styles.detailIcon}>{getDetailIcon('time')}</div>
                  <div className={styles.detailLabel}>Сбор гостей</div>
                  <div className={styles.detailValue}>{data.weddingTime}</div>
                </div>
              )}
              {data.venue && (
                <div className={styles.detailItem}>
                  <div className={styles.detailIcon}>{getDetailIcon('venue')}</div>
                  <div className={styles.detailLabel}>Место</div>
                  <div className={styles.detailValue}>{data.venue}</div>
                  {data.venueAddress && <div className={styles.detailSub}>{data.venueAddress}</div>}
                </div>
              )}
            </div>

            {data.mapLink && (
              <a href={data.mapLink} target="_blank" rel="noopener noreferrer" className={styles.btnPrimary}>
                Открыть на карте
              </a>
            )}
          </div>
        </Reveal>
      )}

      {/* SCHEDULE */}
      {isOn('schedule') && schedule.length > 0 && (
        <Reveal active={fullPage}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Программа дня</div>
            <OrnamentLine />
            
            <div className={styles.timeline}>
              {schedule.map((item, i) => (
                <div key={i} className={styles.timelineItem}>
                  <div className={styles.timelineTime}>{item.time}</div>
                  <div className={styles.timelineIconWrapper}>
                    <div className={styles.timelineLineUp} style={{ opacity: i === 0 ? 0 : 1 }} />
                    <div className={styles.timelineIcon}>{item.icon}</div>
                    <div className={styles.timelineLineDown} style={{ opacity: i === schedule.length - 1 ? 0 : 1 }} />
                  </div>
                  <div className={styles.timelineContent}>
                    <div className={styles.timelineTitle}>{item.title}</div>
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
          <div className={`${styles.section} ${styles.dressSection}`}>
            <div className={styles.sectionTitle}>Дресс-код</div>
            <OrnamentLine />
            <p className={styles.dressText}>
              Мы будем очень признательны, если вы поддержите цветовую гамму нашего праздника.
            </p>
            <div className={styles.dressCodeBox}>{data.dressCode}</div>
          </div>
        </Reveal>
      )}

      {/* STORY */}
      {isOn('style') && data.story && (
        <Reveal active={fullPage}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Наша история</div>
            <OrnamentLine />
            <p className={styles.storyText}>{data.story}</p>
          </div>
        </Reveal>
      )}

      {/* GALLERY */}
      {isOn('gallery') && data.galleryPhotos.length > 0 && (
        <Reveal active={fullPage}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Фото</div>
            <OrnamentLine />
            <div className={styles.galleryGrid}>
              {data.galleryPhotos.slice(0, 6).map((url, i) => (
                <div key={i}
                  className={`${styles.galleryItem} ${i % 3 === 0 ? styles.galleryItemWide : ''}`}
                  style={{ backgroundImage: `url(${getImageUrl(apiBase, url)})` }}
                />
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* RSVP */}
      <Reveal active={fullPage}>
        <div className={`${styles.section} ${styles.rsvpSection}`}>
          <div className={styles.sectionTitle}>Анкета гостя</div>
          <OrnamentLine />
          
          {data.weddingDate && (
            <p className={styles.rsvpSubtitle}>
              Пожалуйста, подтвердите ваше присутствие до {formatDeadline(data.weddingDate)}
            </p>
          )}

          {rsvpStatus === 'sent' ? (
            <div className={styles.rsvpThanks}>
              <div className={styles.rsvpThanksIcon}>🤍</div>
              <div className={styles.rsvpThanksTitle}>Спасибо!</div>
              <div className={styles.rsvpThanksText}>Ваш ответ успешно отправлен. Ждем вас на нашем празднике!</div>
            </div>
          ) : (
            <div className={styles.rsvpForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Ваше имя и фамилия</label>
                <input className={styles.input} placeholder="Например: Иванов Иван" value={rsvpName} onChange={e => setRsvpName(e.target.value)} />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Сможете ли вы присутствовать?</label>
                <div className={styles.rsvpButtons}>
                  <button className={`${styles.btnToggle} ${attending === true ? styles.btnToggleYes : ''}`} onClick={() => setAttending(true)}>Да, с удовольствием</button>
                  <button className={`${styles.btnToggle} ${attending === false ? styles.btnToggleNo : ''}`} onClick={() => setAttending(false)}>К сожалению, не смогу</button>
                </div>
              </div>

              {attending === true && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Предпочтения в напитках</label>
                  <div className={styles.drinkGrid}>
                    {DRINKS.map(d => (
                      <button key={d.id} className={`${styles.drinkBtn} ${drink === d.id ? styles.drinkBtnActive : ''}`} onClick={() => setDrink(d.id)}>
                        <div className={styles.drinkIcon}>{getDrinkIcon(d.id)}</div>
                        <div className={styles.drinkName}>{d.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Пожелания или вопросы (необязательно)</label>
                <textarea className={styles.textarea} placeholder="Напишите здесь..." value={wishes} onChange={e => setWishes(e.target.value)} />
              </div>

              <button className={styles.btnSubmit} onClick={handleRsvp} disabled={!rsvpName.trim() || rsvpStatus === 'sending'}>
                {rsvpStatus === 'sending' ? 'Отправляем...' : 'Отправить ответ'}
              </button>
              
              {rsvpStatus === 'error' && <div className={styles.errorText}>Произошла ошибка. Пожалуйста, попробуйте еще раз.</div>}
            </div>
          )}
        </div>
      </Reveal>

      {/* FOOTER */}
      <div className={styles.footer}>
        <div className={styles.footerNames}>
          {data.groomName || 'Жених'} & {data.brideName || 'Невеста'}
        </div>
        {dateParts && (
          <div className={styles.footerDate}>
            {dateParts.day} {dateParts.monthName} {dateParts.year}
          </div>
        )}
      </div>
    </div>
  );
}
