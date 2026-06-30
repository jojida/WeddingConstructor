'use client';
import { useState, useEffect, useRef } from 'react';
import styles from './EnvelopeTemplate.module.css';
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

const DRESSCODE_COLORS = ['#60603b', '#40312c', '#5a5a38', '#efdfcd'];

function getImageUrl(a: string, u: string) {
  if (!u) return '';
  return u.startsWith('http') ? u : `${a}${u}`;
}

function parseDateParts(d: string) {
  if (!d) return null;
  try {
    const [y, m, dd] = d.split('-').map(Number);
    return { day: String(dd).padStart(2, '0'), month: String(m).padStart(2, '0'), year: y };
  } catch { return null; }
}

function formatDeadline(d: string) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    dt.setDate(dt.getDate() - 14);
    return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  } catch { return ''; }
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
  const t: Record<string, string> = { up: 'translateY(50px)', left: 'translateX(-40px)', right: 'translateX(40px)', zoom: 'scale(0.9)' };
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : (t[dir] || t.up),
      transition: `opacity 0.8s ease ${delay}s, transform 0.8s ease ${delay}s`,
    }}>
      {children}
    </div>
  );
}

/* Torn paper edge SVG separator between cream and burgundy sections */
function TornEdge({ topColor, bottomColor }: { topColor: string; bottomColor: string }) {
  return (
    <div className={styles.tornWrap} style={{ background: bottomColor }}>
      <svg className={styles.tornSvg} viewBox="0 0 1440 80" preserveAspectRatio="none">
        <path fill={topColor} d={
          'M0,0 H1440 V40 ' +
          'C1420,48 1400,30 1380,42 C1360,54 1340,32 1310,44 C1280,56 1260,34 1230,42 ' +
          'C1200,50 1180,28 1150,40 C1120,54 1100,30 1070,44 C1040,58 1020,32 990,42 ' +
          'C960,52 940,28 910,38 C880,50 860,30 830,42 C800,56 780,32 750,44 ' +
          'C720,56 700,30 670,40 C640,52 620,28 590,40 C560,54 540,30 510,42 ' +
          'C480,56 460,32 430,44 C400,56 380,28 350,38 C320,50 300,30 270,42 ' +
          'C240,56 220,32 190,44 C160,56 140,28 110,38 C80,50 60,30 30,42 ' +
          'C10,50 5,36 0,44 V0 Z'
        } />
      </svg>
    </div>
  );
}

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

export default function EnvelopeTemplate({ data, apiBase, fullPage = false, slug }: Props) {
  const [opened, setOpened] = useState(false);
  const [revealed, setRevealed] = useState(!fullPage);

  const dp = parseDateParts(data.weddingDate);
  const cd = useCountdown(data.weddingDate);
  const schedule = Array.isArray(data.schedule) ? data.schedule : [];
  const sec = data.enabledSections ?? {};
  const isOn = (k: string) => sec[k] !== false;
  const coverUrl = data.coverPhoto ? getImageUrl(apiBase, data.coverPhoto) : '';
  const shortDate = dp ? `${dp.day}.${dp.month}.${String(dp.year).slice(2)}` : '';

  const [rsvpName, setRsvpName] = useState('');
  const [attending, setAttending] = useState<boolean | null>(null);
  const [drink, setDrink] = useState('');
  const [wishes, setWishes] = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleOpen = () => {
    if (opened) return;
    setOpened(true);
    setTimeout(() => setRevealed(true), 2600);
  };

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

  // Lock body scroll while envelope is shown
  useEffect(() => {
    if (!fullPage) return;
    if (!revealed) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [fullPage, revealed]);

  return (
    <div className={`${styles.root} ${fullPage ? styles.rootFull : ''}`}>

      {/* ═══ ENVELOPE OVERLAY — always in DOM, hidden via CSS ═══ */}
      {fullPage && (
        <div
          className={`${styles.envScreen} ${revealed ? styles.envScreenDone : ''}`}
          onClick={!opened ? handleOpen : undefined}
        >
          {/* Hero visible behind the flaps when they open */}
          {coverUrl && <div className={styles.envBg} style={{ backgroundImage: `url(${coverUrl})` }} />}
          <div className={styles.envBgOverlay} />
          <div className={styles.envHeroText}>
            <span className={styles.envHeroScript}>Wedding Day</span>
            {shortDate && <span className={styles.envHeroDate}>{shortDate}</span>}
            <span className={styles.envHeroName}>{data.brideName || 'Viktor'}</span>
            <span className={styles.envHeroAmp}>&amp;</span>
            <span className={styles.envHeroName}>{data.groomName || 'Paula'}</span>
          </div>

          {/* 4 triangular flaps — paper texture */}
          <div className={`${styles.flapTop} ${opened ? styles.flapTopGo : ''}`} />
          <div className={`${styles.flapRight} ${opened ? styles.flapRightGo : ''}`} />
          <div className={`${styles.flapBottom} ${opened ? styles.flapBottomGo : ''}`} />
          <div className={`${styles.flapLeft} ${opened ? styles.flapLeftGo : ''}`} />

          {/* Diagonal fold lines */}
          <div className={`${styles.foldLines} ${opened ? styles.foldLinesGo : ''}`} />

          {/* Gold wax seal */}
          <div className={`${styles.seal} ${opened ? styles.sealBreak : ''}`}>
            <div className={styles.sealRim} />
            <div className={styles.sealCenter}>
              <svg className={styles.sealFlower} viewBox="0 0 60 60" fill="none">
                {/* 3 flowers with stems */}
                <g opacity="0.85">
                  <circle cx="20" cy="18" r="5" fill="#c9a050" stroke="#b8903c" strokeWidth="0.5"/>
                  <circle cx="15" cy="15" r="4" fill="#d4b060" stroke="#b8903c" strokeWidth="0.5"/>
                  <circle cx="25" cy="14" r="4" fill="#d4b060" stroke="#b8903c" strokeWidth="0.5"/>
                  <circle cx="20" cy="12" r="4" fill="#d4b060" stroke="#b8903c" strokeWidth="0.5"/>
                  <circle cx="17" cy="20" r="3.5" fill="#d4b060" stroke="#b8903c" strokeWidth="0.5"/>
                  <circle cx="40" cy="22" r="5" fill="#c9a050" stroke="#b8903c" strokeWidth="0.5"/>
                  <circle cx="35" cy="19" r="4" fill="#d4b060" stroke="#b8903c" strokeWidth="0.5"/>
                  <circle cx="45" cy="19" r="4" fill="#d4b060" stroke="#b8903c" strokeWidth="0.5"/>
                  <circle cx="40" cy="16" r="4" fill="#d4b060" stroke="#b8903c" strokeWidth="0.5"/>
                  <circle cx="30" cy="36" r="6" fill="#c9a050" stroke="#b8903c" strokeWidth="0.5"/>
                  <circle cx="24" cy="33" r="4.5" fill="#d4b060" stroke="#b8903c" strokeWidth="0.5"/>
                  <circle cx="36" cy="33" r="4.5" fill="#d4b060" stroke="#b8903c" strokeWidth="0.5"/>
                  <circle cx="30" cy="30" r="4.5" fill="#d4b060" stroke="#b8903c" strokeWidth="0.5"/>
                  {/* Stems & leaves */}
                  <path d="M20,23 C18,32 22,38 30,42" stroke="#b8903c" strokeWidth="1.2" fill="none"/>
                  <path d="M40,27 C38,34 34,38 30,42" stroke="#b8903c" strokeWidth="1.2" fill="none"/>
                  <path d="M30,42 L30,52" stroke="#b8903c" strokeWidth="1.2"/>
                  <path d="M24,28 C20,30 18,34 20,36" stroke="#b8903c" strokeWidth="0.8" fill="none"/>
                  <path d="M36,30 C40,32 42,36 40,38" stroke="#b8903c" strokeWidth="0.8" fill="none"/>
                  <ellipse cx="22" cy="44" rx="5" ry="3" fill="#c4a050" opacity="0.5" transform="rotate(-30 22 44)"/>
                  <ellipse cx="38" cy="44" rx="5" ry="3" fill="#c4a050" opacity="0.5" transform="rotate(30 38 44)"/>
                </g>
              </svg>
            </div>
          </div>

          {/* Click hint */}
          <div className={`${styles.envHint} ${opened ? styles.envHintGone : ''}`}>
            <span className={styles.envHintText}>Click to open</span>
          </div>
        </div>
      )}

      {/* ═══ MAIN PAGE — always rendered, overlay is fixed on top ═══ */}
      <div className={styles.page}>

        {/* ── HERO ── */}
        <section className={styles.hero}>
          {coverUrl && <div className={styles.heroBg} style={{ backgroundImage: `url(${coverUrl})` }} />}
          <div className={styles.heroOverlay} />
          <div className={styles.heroCornerTL} /><div className={styles.heroCornerTR} />
          <div className={styles.heroCornerBL} /><div className={styles.heroCornerBR} />
          <div className={styles.heroContent}>
            <div className={styles.heroEyebrow}>Wedding Day</div>
            {shortDate && <div className={styles.heroDate}>{shortDate}</div>}
            <h1 className={styles.heroNames}>
              <span className={styles.heroNameAnim}>{data.brideName || 'Viktor'}</span>
              <span className={styles.heroAmp}>&amp;</span>
              <span className={styles.heroNameAnim}>{data.groomName || 'Paula'}</span>
            </h1>
          </div>
          <div className={styles.heroScroll}><div className={styles.heroScrollBar} /></div>
        </section>

        {/* ── INVITE TEXT ── */}
        {isOn('couple') && data.inviteText && (
          <Reveal on={fullPage}>
            <section className={styles.creamSection}>
              <div className={styles.ornament}>— ◆ —</div>
              <p className={styles.inviteText}>{data.inviteText}</p>
            </section>
          </Reveal>
        )}

        {/* ── COUNTDOWN ── */}
        {cd && cd.d > 0 && (
          <Reveal on={fullPage} dir="zoom">
            <section className={styles.creamSection}>
              <div className={styles.cdLabel}>The Celebration Begins In</div>
              <div className={styles.cdRow}>
                {[
                  { v: cd.d, l: 'Days' },
                  { v: cd.h, l: 'Hours' },
                  { v: cd.m, l: 'Minutes' },
                  { v: cd.s, l: 'Seconds' },
                ].map(({ v, l }) => (
                  <div key={l} className={styles.cdUnit}>
                    <div className={styles.cdNum}>{String(v).padStart(2, '0')}</div>
                    <div className={styles.cdUnitLabel}>{l}</div>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>
        )}

        {/* ── TORN EDGE → SCHEDULE (burgundy) ── */}
        {isOn('schedule') && schedule.length > 0 && (
          <>
            <TornEdge topColor="#fffaf8" bottomColor="#66021f" />
            <Reveal on={fullPage} dir="up">
              <section className={styles.burgundySection}>
                <h2 className={styles.scriptTitle}>Schedule of Events</h2>
                <div className={styles.timeline}>
                  {schedule.map((item, i) => (
                    <div key={i} className={styles.tlItem}>
                      <div className={styles.tlTime}>{item.time}</div>
                      <div className={styles.tlCenter}>
                        <div className={styles.tlDiamond} />
                        {i < schedule.length - 1 && <div className={styles.tlLine} />}
                        {i === Math.floor(schedule.length / 2) && (
                          <div className={styles.tlFlower}>🌹</div>
                        )}
                      </div>
                      <div className={styles.tlTitle}>{item.title}</div>
                    </div>
                  ))}
                </div>
              </section>
            </Reveal>
            <TornEdge topColor="#66021f" bottomColor="#fffaf8" />
          </>
        )}

        {/* ── LOCATION ── */}
        {isOn('event') && data.venue && (
          <Reveal on={fullPage}>
            <section className={styles.creamSection}>
              <h2 className={styles.scriptTitleDark}>Location</h2>
              <div className={styles.locName}>{data.venue}</div>
              {data.venueAddress && <div className={styles.locAddr}>Address: {data.venueAddress}</div>}
              {/* Venue image with sketch filter */}
              {data.galleryPhotos?.[0] && (
                <div className={styles.locImageWrap}>
                  <img
                    src={getImageUrl(apiBase, data.galleryPhotos[0])}
                    alt={data.venue}
                    className={styles.locImage}
                  />
                </div>
              )}
              {data.mapLink && (
                <a href={data.mapLink} target="_blank" rel="noopener noreferrer" className={styles.locMapBtn}>
                  Open on map →
                </a>
              )}
            </section>
          </Reveal>
        )}

        {/* ── TORN EDGE → DRESS CODE (burgundy) ── */}
        {isOn('style') && data.dressCode && (
          <>
            <TornEdge topColor="#fffaf8" bottomColor="#66021f" />
            <Reveal on={fullPage} dir="left">
              <section className={styles.burgundySection}>
                <h2 className={styles.scriptTitle}>Dress Code</h2>
                <p className={styles.dressText}>
                  We kindly invite you to dress in elegant attire that reflects the style and spirit of our special day.
                </p>
                {/* Color palette circles */}
                <div className={styles.colorRow}>
                  {DRESSCODE_COLORS.map((c, i) => (
                    <div key={i} className={styles.colorCircle} style={{ background: c }} />
                  ))}
                </div>
                {/* Gentlemen + Ladies in golden frames */}
                <div className={styles.dressGrid}>
                  <div className={styles.dressCol}>
                    {data.galleryPhotos?.[1] && (
                      <div className={styles.goldenFrame}>
                        <img src={getImageUrl(apiBase, data.galleryPhotos[1])} alt="Gentlemen" className={styles.frameImg} />
                      </div>
                    )}
                    <div className={styles.dressColTitle}>Gentlemen:</div>
                    <div className={styles.dressColText}>Well-tailored suits with classic dress shoes are preferred.</div>
                  </div>
                  <div className={styles.dressCol}>
                    {data.galleryPhotos?.[2] && (
                      <div className={styles.goldenFrame}>
                        <img src={getImageUrl(apiBase, data.galleryPhotos[2])} alt="Ladies" className={styles.frameImg} />
                      </div>
                    )}
                    <div className={styles.dressColTitle}>Ladies:</div>
                    <div className={styles.dressColText}>Formal dresses in elegant, polished styles are encouraged.</div>
                  </div>
                </div>
              </section>
            </Reveal>
            <TornEdge topColor="#66021f" bottomColor="#fffaf8" />
          </>
        )}

        {/* ── DETAILS ── */}
        <Reveal on={fullPage}>
          <section className={styles.creamSection}>
            <h2 className={styles.scriptTitleDark}>Details</h2>
            <p className={styles.detailText}>
              For additional information or questions, please contact the wedding organizers.
            </p>
            <p className={styles.detailText}>
              Your presence is the greatest gift to us. However, if you wish to honor us with a present, a contribution toward our future would be sincerely appreciated.
            </p>
          </section>
        </Reveal>

        {/* ── RSVP CTA ── */}
        <Reveal on={fullPage}>
          <section className={styles.rsvpCTA}>
            <p className={styles.rsvpCTAText}>
              To help us prepare for a joyful celebration, kindly confirm your attendance.
            </p>
            {rsvpStatus === 'sent' ? (
              <div className={styles.rsvpThanks}>
                <div className={styles.rsvpThanksScript}>Hope to see you there!</div>
                <div className={styles.rsvpThanksNames}>{data.brideName || 'Viktor'} and {data.groomName || 'Paula'}</div>
              </div>
            ) : (
              <>
                <button className={styles.rsvpCTABtn} onClick={() => {
                  const el = document.getElementById('env-rsvp-form');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}>RSVP</button>

                {/* Inline RSVP form */}
                <div id="env-rsvp-form" className={styles.rsvpForm}>
                  <input className={styles.rsvpInput} placeholder="Your name" value={rsvpName} onChange={e => setRsvpName(e.target.value)} />
                  <div className={styles.rsvpBtns}>
                    <button className={`${styles.rsvpBtn} ${attending === true ? styles.rsvpBtnYes : ''}`} onClick={() => setAttending(true)}>Yes, I will</button>
                    <button className={`${styles.rsvpBtn} ${attending === false ? styles.rsvpBtnNo : ''}`} onClick={() => setAttending(false)}>Unfortunately, I can&apos;t :(</button>
                  </div>
                  {attending === true && (
                    <>
                      <div className={styles.drinkLabel}>Drink preferences</div>
                      <div className={styles.drinkGrid}>
                        {DRINKS.map(d => (
                          <button key={d.id} className={`${styles.drinkBtn} ${drink === d.id ? styles.drinkBtnActive : ''}`} onClick={() => setDrink(d.id)}>
                            <div className={styles.drinkIcon}>{getDrinkIcon(d.id)}</div><span className={styles.drinkName}>{d.label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <textarea className={styles.rsvpInput} style={{ minHeight: 80, resize: 'none' }} placeholder="Wishes for the couple 💌" value={wishes} onChange={e => setWishes(e.target.value)} />
                  <button className={styles.rsvpSubmit} onClick={handleRsvp} disabled={!rsvpName.trim() || rsvpStatus === 'sending'}>
                    {rsvpStatus === 'sending' ? 'Sending...' : 'Confirm'}
                  </button>
                  {rsvpStatus === 'error' && <div className={styles.rsvpError}>Please try again</div>}
                </div>
              </>
            )}
          </section>
        </Reveal>

        {/* ── FOOTER ── */}
        <footer className={styles.footer}>
          <div className={styles.footerScript}>Hope to see you there!</div>
          <div className={styles.footerNames}>{data.brideName || 'Viktor'} and {data.groomName || 'Paula'}</div>
          {/* Couple photo at bottom */}
          {coverUrl && <div className={styles.footerPhoto} style={{ backgroundImage: `url(${coverUrl})` }} />}
          <div className={styles.footerBrand}>✦ WeddingCraft ✦</div>
        </footer>
      </div>
    </div>
  );
}
