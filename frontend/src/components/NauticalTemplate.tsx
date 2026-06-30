'use client';
import { useState, useEffect, useRef } from 'react';
import styles from './NauticalTemplate.module.css';
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

function getImageUrl(apiBase: string, url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${apiBase}${url}`;
}

function parseDateParts(dateStr: string) {
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

function useCountdown(dateStr: string) {
  const [parts, setParts] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  useEffect(() => {
    if (!dateStr) return;
    const calc = () => {
      const diff = new Date(dateStr).getTime() - Date.now();
      if (diff <= 0) { setParts({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setParts({ days, hours, minutes, seconds });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [dateStr]);
  return parts;
}

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, active, delay = 0, dir = 'up' }: {
  children: React.ReactNode; active: boolean; delay?: number; dir?: 'up' | 'left' | 'right' | 'scale';
}) {
  const { ref, visible } = useInView();
  if (!active) return <>{children}</>;

  let transform = 'translateY(40px)';
  if (dir === 'left') transform = 'translateX(-40px)';
  if (dir === 'right') transform = 'translateX(40px)';
  if (dir === 'scale') transform = 'scale(0.85)';

  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : transform,
      transition: `opacity 0.9s cubic-bezier(0.2,0.8,0.2,1) ${delay}s, transform 0.9s cubic-bezier(0.2,0.8,0.2,1) ${delay}s`,
    }}>
      {children}
    </div>
  );
}

/* ── SVG Decorations ─────────────────────────────────────────────── */
function SeaShell({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 10 C55 10 70 22 70 38 C70 58 55 70 40 70 C25 70 10 58 10 38 C10 22 25 10 40 10Z" stroke="#b5c9d8" strokeWidth="1.5" fill="none"/>
      <path d="M40 18 C50 18 60 27 60 38 C60 52 50 62 40 62" stroke="#b5c9d8" strokeWidth="1" fill="none"/>
      <path d="M40 10 L40 70" stroke="#b5c9d8" strokeWidth="0.8" fill="none"/>
      <path d="M25 20 C30 35 30 45 25 60" stroke="#b5c9d8" strokeWidth="0.8" fill="none"/>
      <path d="M55 20 C50 35 50 45 55 60" stroke="#b5c9d8" strokeWidth="0.8" fill="none"/>
    </svg>
  );
}

function Starfish({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 5 L44 28 L65 18 L50 38 L72 48 L48 45 L44 70 L38 46 L15 56 L33 39 L10 26 L34 32Z" fill="#d4a574" fillOpacity="0.4" stroke="#c4935a" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}

function Anchor({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="14" r="8" stroke="#3a5f7d" strokeWidth="2" fill="none"/>
      <line x1="30" y1="22" x2="30" y2="70" stroke="#3a5f7d" strokeWidth="2"/>
      <path d="M10 38 L50 38" stroke="#3a5f7d" strokeWidth="2"/>
      <path d="M10 70 Q30 60 50 70" stroke="#3a5f7d" strokeWidth="2" fill="none"/>
    </svg>
  );
}

function Rope({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 20" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <path d="M0 10 Q25 5 50 10 Q75 15 100 10 Q125 5 150 10 Q175 15 200 10 Q225 5 250 10 Q275 15 300 10 Q325 5 350 10 Q375 15 400 10" stroke="#8b9eb0" strokeWidth="2" fill="none"/>
    </svg>
  );
}

function WaveDivider({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1200 60" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <path d="M0 30 Q150 0 300 30 Q450 60 600 30 Q750 0 900 30 Q1050 60 1200 30 L1200 60 L0 60Z" fill="#e8eef3"/>
    </svg>
  );
}

function FlagBunting({ className }: { className?: string }) {
  const flags = [
    { x: 20, color: '#2a4a6b', label: '♥' },
    { x: 90, color: '#8baec4', label: '★' },
    { x: 160, color: '#3a5f7d', label: '♥' },
    { x: 230, color: '#b5c9d8', label: '★' },
    { x: 300, color: '#2a4a6b', label: '♥' },
    { x: 370, color: '#8baec4', label: '★' },
    { x: 440, color: '#3a5f7d', label: '♥' },
    { x: 510, color: '#b5c9d8', label: '★' },
    { x: 580, color: '#2a4a6b', label: '♥' },
  ];
  return (
    <svg className={className} viewBox="0 0 620 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Rope */}
      <path d="M10 15 Q55 8 90 18 Q135 8 160 18 Q205 8 230 18 Q275 8 300 18 Q345 8 370 18 Q415 8 440 18 Q485 8 510 18 Q555 8 580 18 Q600 12 610 15" stroke="#8b9eb0" strokeWidth="1.5" fill="none"/>
      {/* Flags */}
      {flags.map((f, i) => (
        <g key={i}>
          <polygon points={`${f.x},18 ${f.x+25},18 ${f.x+12.5},44`} fill={f.color} fillOpacity="0.85"/>
          <text x={f.x + 12.5} y={36} textAnchor="middle" fontSize="10" fill="white">{f.label}</text>
        </g>
      ))}
    </svg>
  );
}

export default function NauticalTemplate({ data, apiBase, fullPage = false, slug }: Props) {
  const schedule = Array.isArray(data.schedule) ? data.schedule : [];
  const sec = data.enabledSections ?? {};
  const isOn = (key: string) => sec[key] !== false;
  const coverUrl = data.coverPhoto ? getImageUrl(apiBase, data.coverPhoto) : '';
  const dateParts = parseDateParts(data.weddingDate);
  const countdown = useCountdown(data.weddingDate);

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

  const cls = `${styles.nautical} ${fullPage ? styles.nauticalFull : ''}`;

  return (
    <div className={cls}>

      {/* ═══ HERO ══════════════════════════════════════════════════════════ */}
      <div className={styles.hero}>
        {/* Decorative top stripe border */}
        <div className={styles.stripeBorder} />

        {/* Background photo */}
        {coverUrl && (
          <div className={styles.heroBg} style={{ backgroundImage: `url(${coverUrl})` }} />
        )}
        <div className={styles.heroBgOverlay} />

        {/* Decorative elements */}
        <Anchor className={`${styles.deco} ${styles.decoAnchor}`} />
        <SeaShell className={`${styles.deco} ${styles.decoShell1}`} />

        <div className={styles.heroContent}>
          <div className={`${styles.heroEyebrow} ${styles.animFadeDown}`}>
            — приглашение на свадьбу —
          </div>

          <div className={styles.heroNamesWrap}>
            <h1 className={`${styles.heroName} ${styles.animFadeLeft}`}>
              {data.brideName || 'Невеста'}
            </h1>
            <div className={`${styles.heroAnd} ${styles.animZoomIn}`}>&</div>
            <h1 className={`${styles.heroName} ${styles.animFadeRight}`}>
              {data.groomName || 'Жених'}
            </h1>
          </div>

          {dateParts && (
            <div className={`${styles.heroDateRow} ${styles.animFadeUp}`}>
              <span className={styles.heroDateNum}>{dateParts.day}</span>
              <span className={styles.heroDateDot}>·</span>
              <span className={styles.heroDateMonth}>{dateParts.monthName.toUpperCase()}</span>
              <span className={styles.heroDateDot}>·</span>
              <span className={styles.heroDateNum}>{dateParts.year}</span>
            </div>
          )}

          {data.venue && (
            <div className={`${styles.heroVenue} ${styles.animFadeUp}`} style={{ animationDelay: '0.3s' }}>
              {data.venue}
            </div>
          )}
        </div>

        {/* Bottom wave shape */}
        <WaveDivider className={styles.waveDivider} />
      </div>

      {/* ═══ COUNTDOWN ═════════════════════════════════════════════════════ */}
      {countdown && (countdown.days > 0 || countdown.hours > 0) && (
        <Reveal active={fullPage}>
          <div className={styles.countdownSection}>
            <Rope className={styles.ropeTop} />
            <div className={styles.countdownLabel}>До нашего праздника</div>
            <div className={styles.countdownRow}>
              <div className={styles.countdownItem}>
                <div className={styles.countdownNum}>{countdown.days}</div>
                <div className={styles.countdownUnit}>дней</div>
              </div>
              <div className={styles.countdownSep}>:</div>
              <div className={styles.countdownItem}>
                <div className={styles.countdownNum}>{countdown.hours}</div>
                <div className={styles.countdownUnit}>часов</div>
              </div>
              <div className={styles.countdownSep}>:</div>
              <div className={styles.countdownItem}>
                <div className={styles.countdownNum}>{countdown.minutes}</div>
                <div className={styles.countdownUnit}>минут</div>
              </div>
              <div className={styles.countdownSep}>:</div>
              <div className={styles.countdownItem}>
                <div className={styles.countdownNum}>{countdown.seconds}</div>
                <div className={styles.countdownUnit}>секунд</div>
              </div>
            </div>
            <Rope className={styles.ropeBottom} />
          </div>
        </Reveal>
      )}

      {/* ═══ INVITE TEXT ════════════════════════════════════════════════════ */}
      {isOn('couple') && data.inviteText && (
        <Reveal active={fullPage} delay={0.05}>
          <div className={styles.inviteSection}>
            <div className={styles.inviteCard}>
              <div className={styles.inviteCardCornerTL} />
              <div className={styles.inviteCardCornerTR} />
              <div className={styles.inviteCardCornerBL} />
              <div className={styles.inviteCardCornerBR} />

              <div className={styles.inviteCardEyebrow}>Дорогие гости!</div>
              <div className={styles.inviteCardDivider} />
              <p className={styles.inviteCardText}>{data.inviteText}</p>
            </div>

            <SeaShell className={`${styles.deco} ${styles.decoShell2}`} />
            <Starfish className={`${styles.deco} ${styles.decoStarfish}`} />
          </div>
        </Reveal>
      )}

      {/* ═══ SCHEDULE ══════════════════════════════════════════════════════ */}
      {isOn('schedule') && schedule.length > 0 && (
        <Reveal active={fullPage} delay={0.05}>
          <div className={styles.scheduleSection}>
            <div className={styles.sectionTag}>Программа</div>
            <div className={styles.sectionTitle}>Расписание дня</div>
            <div className={styles.sectionTitleDeco}>⚓</div>

            <div className={styles.scheduleCard}>
              {schedule.map((item, i) => (
                <div key={i} className={styles.scheduleItem}>
                  <div className={styles.scheduleTime}>{item.time}</div>
                  <div className={styles.scheduleConnector}>
                    <div className={styles.scheduleDot} />
                    {i < schedule.length - 1 && <div className={styles.scheduleLine} />}
                  </div>
                  <div className={styles.scheduleContent}>
                    <span className={styles.scheduleIcon}>{item.icon}</span>
                    <span className={styles.scheduleTitle2}>{item.title}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* ═══ VENUE MAP AREA ════════════════════════════════════════════════ */}
      {isOn('event') && (data.venue || data.weddingDate) && (
        <Reveal active={fullPage} dir="scale">
          <div className={styles.venueSection}>
            <div className={styles.stripeBorder} />

            <div className={styles.venueGrid}>
              {/* Left: watercolor map placeholder */}
              <div className={styles.venueMapBox}>
                <div className={styles.venueMapInner}>
                  <div className={styles.venueMapDecor}>
                    <div className={styles.venueMapCompass}>🧭</div>
                    <div className={styles.venueMapLine} />
                    <div className={styles.venueMapPin}>📍</div>
                    <div className={styles.venueMapVenueName}>{data.venue || 'Место'}</div>
                  </div>
                </div>
              </div>

              {/* Right: details */}
              <div className={styles.venueDetails}>
                <div className={styles.sectionTag}>Детали</div>
                <div className={styles.sectionTitle}>Торжество</div>
                <div className={styles.sectionTitleDeco}>⚓</div>

                {data.weddingDate && dateParts && (
                  <div className={styles.venueDetailItem}>
                    <div className={styles.venueDetailIcon}>🗓</div>
                    <div>
                      <div className={styles.venueDetailLabel}>Дата свадьбы</div>
                      <div className={styles.venueDetailVal}>{dateParts.day} {dateParts.monthName} {dateParts.year}</div>
                    </div>
                  </div>
                )}
                {data.weddingTime && (
                  <div className={styles.venueDetailItem}>
                    <div className={styles.venueDetailIcon}>🕐</div>
                    <div>
                      <div className={styles.venueDetailLabel}>Начало</div>
                      <div className={styles.venueDetailVal}>{data.weddingTime}</div>
                    </div>
                  </div>
                )}
                {data.venue && (
                  <div className={styles.venueDetailItem}>
                    <div className={styles.venueDetailIcon}>📍</div>
                    <div>
                      <div className={styles.venueDetailLabel}>Место</div>
                      <div className={styles.venueDetailVal}>{data.venue}</div>
                      {data.venueAddress && <div className={styles.venueDetailSub}>{data.venueAddress}</div>}
                    </div>
                  </div>
                )}

                {data.mapLink && (
                  <a href={data.mapLink} target="_blank" rel="noopener noreferrer" className={styles.mapBtn}>
                    Открыть маршрут →
                  </a>
                )}
              </div>
            </div>

            <div className={styles.stripeBorder} />
          </div>
        </Reveal>
      )}

      {/* ═══ DRESS CODE ════════════════════════════════════════════════════ */}
      {isOn('style') && data.dressCode && (
        <Reveal active={fullPage}>
          <div className={styles.dressSection}>
            <div className={styles.sectionTag}>Внешний вид</div>
            <div className={styles.sectionTitle}>Дресс-код</div>
            <div className={styles.sectionTitleDeco}>⚓</div>
            <div className={styles.dressPaletteRow}>
              <div className={styles.dressSwatch} style={{ background: '#e8eef3' }} />
              <div className={styles.dressSwatch} style={{ background: '#b5c9d8' }} />
              <div className={styles.dressSwatch} style={{ background: '#8baec4' }} />
              <div className={styles.dressSwatch} style={{ background: '#3a5f7d' }} />
              <div className={styles.dressSwatch} style={{ background: '#2a4a6b' }} />
            </div>
            <div className={styles.dressCodeText}>{data.dressCode}</div>
            <div className={styles.dressHint}>Пожалуйста, придерживайтесь морской гаммы</div>
          </div>
        </Reveal>
      )}

      {/* ═══ STORY ═════════════════════════════════════════════════════════ */}
      {isOn('style') && data.story && (
        <Reveal active={fullPage}>
          <div className={styles.storySection}>
            <div className={styles.sectionTag}>О нас</div>
            <div className={styles.sectionTitle}>Наша история</div>
            <div className={styles.sectionTitleDeco}>⚓</div>
            <p className={styles.storyText}>{data.story}</p>
          </div>
        </Reveal>
      )}

      {/* ═══ GALLERY ═══════════════════════════════════════════════════════ */}
      {isOn('gallery') && data.galleryPhotos.length > 0 && (
        <Reveal active={fullPage}>
          <div className={styles.gallerySection}>
            <div className={styles.sectionTag}>Фотографии</div>
            <div className={styles.sectionTitle}>Фотогалерея</div>
            <div className={styles.sectionTitleDeco}>⚓</div>
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

      {/* ═══ RSVP ══════════════════════════════════════════════════════════ */}
      <Reveal active={fullPage}>
        <div className={styles.rsvpSection}>
          {/* Nautical stripe background */}
          <div className={styles.rsvpStripes} />

          <div className={styles.rsvpInner}>
            <div className={styles.sectionTag} style={{ color: '#fff' }}>Подтверждение</div>
            <div className={styles.sectionTitle} style={{ color: '#fff' }}>Анкета гостя</div>
            <div className={styles.sectionTitleDeco}>⚓</div>

            {data.weddingDate && (
              <p className={styles.rsvpSubtitle}>Ответьте до {formatDeadline(data.weddingDate)}</p>
            )}

            {rsvpStatus === 'sent' ? (
              <div className={styles.rsvpThanks}>
                <div className={styles.rsvpThanksIcon}>⚓</div>
                <div className={styles.rsvpThanksTitle}>Спасибо!</div>
                <div className={styles.rsvpThanksText}>Ваш ответ принят. До встречи на нашем празднике!</div>
              </div>
            ) : (
              <div className={styles.rsvpForm}>
                <input
                  className={styles.input}
                  placeholder="Ваше имя и фамилия"
                  value={rsvpName}
                  onChange={e => setRsvpName(e.target.value)}
                />

                <div className={styles.attendRow}>
                  <button
                    className={`${styles.attendBtn} ${attending === true ? styles.attendBtnYes : ''}`}
                    onClick={() => setAttending(true)}
                  >
                    ✓ С удовольствием
                  </button>
                  <button
                    className={`${styles.attendBtn} ${attending === false ? styles.attendBtnNo : ''}`}
                    onClick={() => setAttending(false)}
                  >
                    ✕ Не смогу
                  </button>
                </div>

                {attending === true && (
                  <div className={styles.drinkSection}>
                    <div className={styles.drinkLabel}>Напитки на ваш вкус</div>
                    <div className={styles.drinkGrid}>
                      {DRINKS.map(d => (
                        <button
                          key={d.id}
                          className={`${styles.drinkBtn} ${drink === d.id ? styles.drinkBtnActive : ''}`}
                          onClick={() => setDrink(d.id)}
                        >
                          <span>{d.emoji}</span>
                          <span>{d.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <textarea
                  className={styles.textarea}
                  placeholder="Пожелания молодожёнам 💌"
                  value={wishes}
                  onChange={e => setWishes(e.target.value)}
                />

                <button
                  className={styles.submitBtn}
                  onClick={handleRsvp}
                  disabled={!rsvpName.trim() || rsvpStatus === 'sending'}
                >
                  {rsvpStatus === 'sending' ? 'Отправляем...' : '⚓ Отправить'}
                </button>

                {rsvpStatus === 'error' && (
                  <p className={styles.errorText}>Ошибка. Попробуйте ещё раз.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </Reveal>

      {/* ═══ FOOTER ════════════════════════════════════════════════════════ */}
      <div className={styles.footer}>
        <FlagBunting className={styles.footerBunting} />
        <div className={styles.footerNames}>
          {data.brideName || 'Невеста'} & {data.groomName || 'Жених'}
        </div>
        {dateParts && (
          <div className={styles.footerDate}>
            {dateParts.day} · {dateParts.monthName.toUpperCase()} · {dateParts.year}
          </div>
        )}
        <div className={styles.footerAnchorRow}>
          <Anchor className={styles.footerAnchor} />
        </div>
        <div className={styles.footerBrand}>⚓ Eloquence</div>
      </div>

    </div>
  );
}
