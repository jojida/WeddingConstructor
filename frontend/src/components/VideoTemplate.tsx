'use client';
import { useState, useEffect, useRef } from 'react';
import styles from './VideoTemplate.module.css';
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
    const months = ['января','февраля','марта','апреля','мая','июня',
                    'июля','августа','сентября','октября','ноября','декабря'];
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

export default function VideoTemplate({ data, apiBase, fullPage = false, slug }: Props) {
  const schedule = Array.isArray(data.schedule) ? data.schedule : [];
  const sec = data.enabledSections ?? {};
  const isOn = (key: string) => sec[key] !== false;

  // State for interactive envelope
  const [isOpened, setIsOpened] = useState(false);
  const [showEnvelope, setShowEnvelope] = useState(true);
  const [scale, setScale] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Default romantic background video and audio tracks from the original Tilda website
  const defaultVideoUrl = 'https://www.dropbox.com/scl/fi/6ae12725vg66z0pod40ri/IMG_6230.MP4?rlkey=dbg8tok7qonoqpx0ppz5dh2jo&st=xgf5bsuk&raw=1';
  const defaultAudioUrl = 'https://dl.dropboxusercontent.com/scl/fi/v3h8kkw607tx9cb31r02h/Alex-Warren-Ordinary-Official-Video.mp3?rlkey=9taqn02332fuabd4175jdwxdw&st=dkeamyq2';

  const videoUrl = data.coverVideo ? getImageUrl(apiBase, data.coverVideo) : defaultVideoUrl;
  const photoUrl = data.coverPhoto ? getImageUrl(apiBase, data.coverPhoto) : '';
  const dateParts = parseDateParts(data.weddingDate);

  // RSVP Form States
  const [rsvpName, setRsvpName]     = useState('');
  const [attending, setAttending]   = useState<boolean | null>(null);
  const [drink, setDrink]           = useState('');
  const [wishes, setWishes]         = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle');

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({ days: '00', hours: '00', minutes: '00', seconds: '00' });

  // Handle envelope scaling to keep pixel-perfect Zero Block proportions on mobile
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 1200) {
        setScale(width / 1200);
      } else {
        setScale(1);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Countdown timer logic
  useEffect(() => {
    let targetDate = new Date(2026, 6, 10, 16, 15, 0); // Fallback to original date: July 10, 2026
    if (data.weddingDate) {
      try {
        const [y, m, d] = data.weddingDate.split('-').map(Number);
        let hour = 16, min = 0;
        if (data.weddingTime) {
          const [h, mi] = data.weddingTime.split(':').map(Number);
          if (!isNaN(h)) hour = h;
          if (!isNaN(mi)) min = mi;
        }
        targetDate = new Date(y, m - 1, d, hour, min, 0);
      } catch (e) {
        console.error("Error parsing countdown date:", e);
      }
    }

    const interval = setInterval(() => {
      const now = new Date();
      const distance = targetDate.getTime() - now.getTime();
      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft({ days: '00', hours: '00', minutes: '00', seconds: '00' });
        return;
      }
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft({
        days: String(days).padStart(2, '0'),
        hours: String(hours).padStart(2, '0'),
        minutes: String(minutes).padStart(2, '0'),
        seconds: String(seconds).padStart(2, '0'),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [data.weddingDate, data.weddingTime]);

  const handleOpenEnvelope = () => {
    setIsOpened(true);
    // Play music
    if (audioRef.current) {
      audioRef.current.play().catch(err => {
        console.log("Audio autoplay prevented. User action will enable it.", err);
      });
    }
    // Remove envelope from DOM after slide out transitions are done
    setTimeout(() => {
      setShowEnvelope(false);
    }, 2200);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleRsvp = async () => {
    if (!rsvpName.trim()) return;
    setRsvpStatus('sending');
    try {
      const effectiveSlug = slug || data.slug || '';
      if (!effectiveSlug) {
        setRsvpStatus('sent');
        return;
      }
      const res = await fetch(`${apiBase}/api/rsvp/${effectiveSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: rsvpName,
          attending: attending !== false,
          drinkChoice: drink,
          wishes
        }),
      });
      setRsvpStatus(res.ok ? 'sent' : 'error');
    } catch {
      setRsvpStatus('error');
    }
  };

  const containerCls = `${styles.container} ${fullPage ? styles.containerFull : ''} ${!showEnvelope ? styles.scrollable : styles.locked}`;

  return (
    <div className={containerCls}>
      {/* ─── AUDIO ELEMENT ─────────────────────────────────────────────────── */}
      <audio ref={audioRef} loop src={defaultAudioUrl} />

      {/* ─── FLOATING AUDIO CONTROLLER ─────────────────────────────────────── */}
      {!showEnvelope && (
        <button className={styles.musicToggle} onClick={toggleMute} aria-label="Toggle Music">
          <div className={`${styles.musicWave} ${isMuted ? styles.muted : ''}`}>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>
      )}

      {/* ─── INTERACTIVE ENVELOPE OVERLAY ──────────────────────────────────── */}
      {showEnvelope && (
        <div className={`${styles.envelopeOverlay} ${isOpened ? styles.opened : styles.closed}`}>
          <div 
            className={styles.envelopeArtboard}
            style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
          >
            {/* Left flap */}
            <img 
              className={`${styles.flap} ${styles.flapLeft}`} 
              src="https://static.tildacdn.net/tild6338-3733-4431-a363-306634383864/Polygon_4.png" 
              alt="envelope-left" 
            />
            {/* Right flap */}
            <img 
              className={`${styles.flap} ${styles.flapRight}`} 
              src="https://static.tildacdn.net/tild3636-6566-4132-b665-343766326335/Polygon_3.png" 
              alt="envelope-right" 
            />
            {/* Bottom flap */}
            <img 
              className={`${styles.flap} ${styles.flapBottom}`} 
              src="https://static.tildacdn.net/tild6262-6339-4933-b833-343039643037/Polygon_2_1.png" 
              alt="envelope-bottom" 
            />
            {/* Top flap */}
            <img 
              className={`${styles.flap} ${styles.flapTop}`} 
              src="https://static.tildacdn.net/tild3762-3738-4361-b134-333538333135/Polygon_1_3.png" 
              alt="envelope-top" 
            />
            {/* Central Seal wax sticker */}
            <img 
              className={styles.seal} 
              src="https://static.tildacdn.net/tild3435-3731-4464-a537-636664626563/ChatGPT_Image_Aug_3_.png" 
              alt="seal" 
              onClick={handleOpenEnvelope}
            />
            {/* Instructions */}
            <div className={styles.clickToOpen} onClick={handleOpenEnvelope}>
              Click to open
            </div>
          </div>
        </div>
      )}

      {/* ─── FIXED CINEMATIC BACKGROUND VIDEO ───────────────────────────────── */}
      <div className={styles.videoBgContainer}>
        {videoUrl ? (
          <video className={styles.videoBg} autoPlay loop muted playsInline poster={photoUrl}>
            <source src={videoUrl} type="video/mp4" />
          </video>
        ) : photoUrl ? (
          <div className={styles.videoBg} style={{ backgroundImage: `url(${photoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        ) : null}
        <div className={styles.videoOverlay} />
      </div>

      {/* ─── MAIN SCROLLABLE CONTENT ────────────────────────────────────────── */}
      <div className={styles.contentWrapper}>
        
        {/* ═══ HERO SECTION ══════════════════════════════════════════════════ */}
        <header className={styles.heroSection}>
          <div className={styles.heroInner}>
            <span className={styles.heroLabel}>Wedding Day</span>
            <h1 className={`${styles.heroNames} ${styles.serif}`}>
              {data.groomName || 'Viktor'}<br />
              <span className={styles.ampersand}>&</span><br />
              {data.brideName || 'Paula'}
            </h1>
            {dateParts ? (
              <span className={`${styles.heroDate} ${styles.serif}`}>
                {String(dateParts.day).padStart(2, '0')}.{String(dateParts.monthName === 'января' ? 1 : dateParts.monthName === 'февраля' ? 2 : dateParts.monthName === 'марта' ? 3 : dateParts.monthName === 'апреля' ? 4 : dateParts.monthName === 'мая' ? 5 : dateParts.monthName === 'июня' ? 6 : dateParts.monthName === 'июля' ? 7 : dateParts.monthName === 'августа' ? 8 : dateParts.monthName === 'сентября' ? 9 : dateParts.monthName === 'октября' ? 10 : dateParts.monthName === 'ноября' ? 11 : 12).padStart(2, '0')}.{String(dateParts.year).substring(2)}
              </span>
            ) : (
              <span className={`${styles.heroDate} ${styles.serif}`}>05.07.26</span>
            )}
          </div>
        </header>

        {/* ═══ WELCOME SECTION ═══════════════════════════════════════════════ */}
        {isOn('couple') && (
          <section className={styles.cardSection}>
            <div className={styles.welcomeCard}>
              <h2 className={`${styles.cardTitle} ${styles.serif}`}>Dear Friends and Family,</h2>
              <p className={styles.welcomeText}>
                {data.inviteText || "As we get ready to say “I do,” we feel grateful for the wonderful people in our lives. Your support means the world to us, and we would be honored to have you with us as we begin our life together."}
              </p>
              <div className={styles.divider}>✦</div>
            </div>
          </section>
        )}

        {/* ═══ COUNTDOWN TIMER SECTION ══════════════════════════════════════ */}
        <section className={styles.cardSection}>
          <div className={styles.countdownCard}>
            <h2 className={`${styles.cardTitle} ${styles.serif}`}>The Celebration Begins In</h2>
            <div className={styles.countdownContainer}>
              <div className={styles.timeBlock}>
                <span className={`${styles.timeNumber} ${styles.serif}`}>{timeLeft.days}</span>
                <span className={styles.timeLabel}>Days</span>
              </div>
              <span className={styles.timeSeparator}>:</span>
              <div className={styles.timeBlock}>
                <span className={`${styles.timeNumber} ${styles.serif}`}>{timeLeft.hours}</span>
                <span className={styles.timeLabel}>Hours</span>
              </div>
              <span className={styles.timeSeparator}>:</span>
              <div className={styles.timeBlock}>
                <span className={`${styles.timeNumber} ${styles.serif}`}>{timeLeft.minutes}</span>
                <span className={styles.timeLabel}>Minutes</span>
              </div>
              <span className={styles.timeSeparator}>:</span>
              <div className={styles.timeBlock}>
                <span className={`${styles.timeNumber} ${styles.serif}`}>{timeLeft.seconds}</span>
                <span className={styles.timeLabel}>Seconds</span>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ PROGRAM / SCHEDULE SECTION ═════════════════════════════════════ */}
        {isOn('schedule') && (
          <section className={styles.cardSection}>
            <div className={styles.scheduleCard}>
              <h2 className={`${styles.cardTitle} ${styles.serif}`}>Schedule of Events</h2>
              <div className={styles.scheduleList}>
                {schedule.length > 0 ? (
                  schedule.map((item, i) => (
                    <div key={i} className={styles.scheduleItem}>
                      <span className={styles.scheduleIcon}>{item.icon || '✨'}</span>
                      <div className={styles.scheduleDetails}>
                        <h3 className={`${styles.scheduleTitle} ${styles.serif}`}>{item.title}</h3>
                        <span className={styles.scheduleTime}>{item.time}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className={styles.scheduleItem}>
                      <span className={styles.scheduleIcon}>💍</span>
                      <div className={styles.scheduleDetails}>
                        <h3 className={`${styles.scheduleTitle} ${styles.serif}`}>Wedding Ceremony</h3>
                        <span className={styles.scheduleTime}>16:00</span>
                      </div>
                    </div>
                    <div className={styles.scheduleItem}>
                      <span className={styles.scheduleIcon}>🥂</span>
                      <div className={styles.scheduleDetails}>
                        <h3 className={`${styles.scheduleTitle} ${styles.serif}`}>Cocktail</h3>
                        <span className={styles.scheduleTime}>17:00</span>
                      </div>
                    </div>
                    <div className={styles.scheduleItem}>
                      <span className={styles.scheduleIcon}>🍽️</span>
                      <div className={styles.scheduleDetails}>
                        <h3 className={`${styles.scheduleTitle} ${styles.serif}`}>Dinner</h3>
                        <span className={styles.scheduleTime}>19:00</span>
                      </div>
                    </div>
                    <div className={styles.scheduleItem}>
                      <span className={styles.scheduleIcon}>💃</span>
                      <div className={styles.scheduleDetails}>
                        <h3 className={`${styles.scheduleTitle} ${styles.serif}`}>Party</h3>
                        <span className={styles.scheduleTime}>20:00</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ═══ LOCATION SECTION ══════════════════════════════════════════════ */}
        {isOn('event') && (
          <section className={styles.cardSection}>
            <div className={styles.locationCard}>
              <h2 className={`${styles.cardTitle} ${styles.serif}`}>Location</h2>
              <h3 className={`${styles.locationName} ${styles.serif}`}>{data.venue || "Chateau de Paon"}</h3>
              {data.venueAddress && <p className={styles.locationAddress}>{data.venueAddress}</p>}
              {data.mapLink && (
                <a href={data.mapLink} target="_blank" rel="noopener noreferrer" className={styles.mapButton}>
                  View Map ✦
                </a>
              )}
            </div>
          </section>
        )}

        {/* ═══ DRESS CODE SECTION ════════════════════════════════════════════ */}
        {isOn('style') && data.dressCode && (
          <section className={styles.cardSection}>
            <div className={styles.dressCodeCard}>
              <h2 className={`${styles.cardTitle} ${styles.serif}`}>Dress Code</h2>
              <p className={styles.dressCodeText}>{data.dressCode}</p>
              <div className={styles.colorsPalette}>
                <span style={{ backgroundColor: '#2C2418' }}></span>
                <span style={{ backgroundColor: '#66021f' }}></span>
                <span style={{ backgroundColor: '#a0978f' }}></span>
                <span style={{ backgroundColor: '#ede4d4' }}></span>
              </div>
            </div>
          </section>
        )}

        {/* ═══ STORY SECTION ═════════════════════════════════════════════════ */}
        {isOn('style') && data.story && (
          <section className={styles.cardSection}>
            <div className={styles.storyCard}>
              <h2 className={`${styles.cardTitle} ${styles.serif}`}>Our Story</h2>
              <p className={styles.storyText}>{data.story}</p>
            </div>
          </section>
        )}

        {/* ═══ GALLERY SECTION ═══════════════════════════════════════════════ */}
        {isOn('gallery') && data.galleryPhotos && data.galleryPhotos.length > 0 && (
          <section className={styles.cardSection}>
            <div className={styles.galleryCard}>
              <h2 className={`${styles.cardTitle} ${styles.serif}`}>Moments</h2>
              <div className={styles.galleryGrid}>
                {data.galleryPhotos.map((url, i) => (
                  <div 
                    key={i} 
                    className={styles.galleryItem} 
                    style={{ backgroundImage: `url(${getImageUrl(apiBase, url)})` }}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ═══ RSVP SURVEY FORM ══════════════════════════════════════════════ */}
        <section className={styles.cardSection}>
          <div className={styles.rsvpCard}>
            <h2 className={`${styles.cardTitle} ${styles.serif}`}>RSVP</h2>
            {data.weddingDate && (
              <p className={styles.rsvpDeadline}>
                Please respond before {formatDeadline(data.weddingDate)}
              </p>
            )}

            {rsvpStatus === 'sent' ? (
              <div className={styles.rsvpSuccess}>
                <span className={styles.successHeart}>🤍</span>
                <h3 className={`${styles.successTitle} ${styles.serif}`}>Thank you!</h3>
                <p>Your response has been sent successfully.</p>
              </div>
            ) : (
              <div className={styles.rsvpForm}>
                <div className={styles.inputGroup}>
                  <input 
                    type="text" 
                    className={styles.formInput} 
                    placeholder="Guest Name(s)" 
                    value={rsvpName} 
                    onChange={e => setRsvpName(e.target.value)} 
                  />
                </div>

                <div className={styles.radioGroup}>
                  <button 
                    type="button"
                    className={`${styles.formBtn} ${attending === true ? styles.activeYes : ''}`} 
                    onClick={() => setAttending(true)}
                  >
                    Accepts with Pleasure
                  </button>
                  <button 
                    type="button"
                    className={`${styles.formBtn} ${attending === false ? styles.activeNo : ''}`} 
                    onClick={() => setAttending(false)}
                  >
                    Declines with Regret
                  </button>
                </div>

                {attending === true && (
                  <div className={styles.drinkBlock}>
                    <p className={styles.drinkQuestion}>Drink preferences:</p>
                    <div className={styles.drinkSelection}>
                      {DRINKS.map(d => (
                        <button 
                          key={d.id} 
                          type="button"
                          className={`${styles.drinkOption} ${drink === d.id ? styles.activeDrink : ''}`} 
                          onClick={() => setDrink(d.id)}
                        >
                          <span className={styles.drinkEmoji}>{d.emoji}</span>
                          <span className={styles.drinkName}>{d.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.inputGroup}>
                  <textarea 
                    className={styles.formTextarea} 
                    placeholder="Wishes for the couple or other comments..." 
                    value={wishes} 
                    onChange={e => setWishes(e.target.value)} 
                  />
                </div>

                <button 
                  className={styles.rsvpSubmitBtn} 
                  onClick={handleRsvp} 
                  disabled={!rsvpName.trim() || rsvpStatus === 'sending'}
                >
                  {rsvpStatus === 'sending' ? 'Sending...' : 'Send Response'}
                </button>

                {rsvpStatus === 'error' && (
                  <p className={styles.rsvpErrorMsg}>Failed to send. Please try again.</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ═══ FOOTER ════════════════════════════════════════════════════════ */}
        <footer className={styles.footer}>
          <p className={`${styles.footerNames} ${styles.serif}`}>
            {data.groomName || 'Viktor'} & {data.brideName || 'Paula'}
          </p>
          <span className={styles.footerBrand}>Created with WeddingCraft</span>
        </footer>

      </div>
    </div>
  );
}
