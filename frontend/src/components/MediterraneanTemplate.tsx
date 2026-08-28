'use client';
import { useEffect, useMemo, useRef } from 'react';
import { InviteData } from './TemplatePreview';

interface Props {
  data: InviteData;
  apiBase: string;
  fullPage?: boolean;
  slug?: string;
  editing?: boolean;
}

/* ─────────────────────────────────────────────────────────
   Full-page / editing → iframe реального дизайна.
     URL-параметры (страница гостя) + postMessage('wc:data') (живое превью).
     В режиме editing передаём editing=1 — стирание даты/скролл-гейт отключаются.
   Preview/card → миниатюра с именами поверх фото.
───────────────────────────────────────────────────────── */
export default function MediterraneanTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const live = !!(fullPage || editing);

  const initialSrc = useMemo(() => {
    const p = new URLSearchParams();
    p.set('apiBase', apiBase || '');
    if (slug) p.set('slug', slug);
    if (editing) p.set('editing', '1');
    if (data.groomName) p.set('groom', data.groomName);
    if (data.brideName) p.set('bride', data.brideName);
    if (data.weddingDate) p.set('date', data.weddingDate);
    if (data.weddingTime) p.set('time', data.weddingTime);
    return `/invite/index.html?${p.toString()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const postData = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const d = dataRef.current;
    win.postMessage(
      {
        type: 'wc:data',
        payload: {
          ...(d.customData || {}),
          apiBase,
          slug: slug || '',
          groomName: d.groomName,
          brideName: d.brideName,
          weddingDate: d.weddingDate,
          weddingTime: d.weddingTime,
          venue: d.venue,
          story: d.story,
          dressCodePhoto: d.dressCodePhoto,
          venueAddress: d.venueAddress,
          mapLink: d.mapLink,
          musicUrl: d.musicUrl,
          schedule: d.schedule,
        },
      },
      '*'
    );
  };

  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.data && e.data.type === 'wc:ready') postData(); };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  useEffect(() => {
    postData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, apiBase]);

  if (live) {
    if (fullPage) {
      return (
        <div style={{ width: '100%', minHeight: '100vh', background: '#0a1522' }}>
          <iframe
            ref={iframeRef}
            src={initialSrc}
            style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
            title="Средиземноморье — свадебное приглашение"
            allow="autoplay"
          />
        </div>
      );
    }
    return (
      <iframe
        ref={iframeRef}
        src={initialSrc}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#dbeeff' }}
        title="Превью «Средиземноморье»"
        allow="autoplay"
      />
    );
  }

  /* ── Preview card thumbnail — always shows the real invitation design ── */
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: '#dbeeff',
      fontFamily: "'Georgia', serif",
    }}>
      {/* SVG filter: removes black backgrounds from PNG botanical assets */}
      <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }}>
        <defs>
          <filter id="rm-blk-prev" colorInterpolationFilters="sRGB"
                  x="0%" y="0%" width="100%" height="100%">
            <feColorMatrix type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      1 1 1 0 0"/>
          </filter>
        </defs>
      </svg>

      {/* Actual hero background from the invitation */}
      <img
        src="/invite/assets/window.jpg"
        alt="Средиземноморье"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />

      {/* Watercolour botanical overlay — top-left (from real design) */}
      <img
        src="/invite/assets/branch.png"
        alt=""
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '42%', opacity: .9,
          filter: 'url(#rm-blk-prev)',
          pointerEvents: 'none',
        }}
      />

      {/* Name card — повторяет плашку из реального приглашения: декоративная
          рамка (вогнутые угловые вырезы + двойная обводка) и шрифт Gogol.
          Держать в согласии с .name-card в /invite/styles.css. */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        padding: '11px 26px',
        textAlign: 'center',
        minWidth: '128px',
        whiteSpace: 'nowrap',
      }}>
        {/* Рамка — фоновый слой под именами */}
        <svg
          viewBox="0 0 300 176"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
        >
          <path
            d="M 31 5 L 269 5 A 26 26 0 0 0 295 31 L 295 145 A 26 26 0 0 0 269 171 L 31 171 A 26 26 0 0 0 5 145 L 5 31 A 26 26 0 0 0 31 5 Z"
            fill="rgba(233,242,252,0.94)"
          />
          <path
            d="M 31 5 L 269 5 A 26 26 0 0 0 295 31 L 295 145 A 26 26 0 0 0 269 171 L 31 171 A 26 26 0 0 0 5 145 L 5 31 A 26 26 0 0 0 31 5 Z"
            fill="none" stroke="#114e88" strokeWidth="2.4"
            vectorEffect="non-scaling-stroke" strokeLinejoin="round"
          />
          <path
            d="M 33 13 L 267 13 A 20 20 0 0 0 287 33 L 287 143 A 20 20 0 0 0 267 163 L 33 163 A 20 20 0 0 0 13 143 L 13 33 A 20 20 0 0 0 33 13 Z"
            fill="none" stroke="#114e88" strokeWidth="1" opacity={0.85}
            vectorEffect="non-scaling-stroke" strokeLinejoin="round"
          />
        </svg>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <span style={{ display: 'block', fontSize: '10px', color: '#114e88', marginBottom: 1 }}>♥</span>
          <p style={{
            fontFamily: "'Gogol', 'Marck Script', cursive, Georgia, serif",
            fontSize: '18px', color: '#354366',
            letterSpacing: '.04em', margin: 0, lineHeight: 1.02,
          }}>
            Катерина
          </p>
          <p style={{
            fontFamily: "'Gogol', 'Marck Script', cursive, Georgia, serif",
            fontSize: '13px', color: '#354366', margin: '-2px 0', lineHeight: 1.02,
          }}>
            и
          </p>
          <p style={{
            fontFamily: "'Gogol', 'Marck Script', cursive, Georgia, serif",
            fontSize: '18px', color: '#354366',
            letterSpacing: '.04em', margin: 0, lineHeight: 1.02,
          }}>
            Максим
          </p>
          {/* Small wavy flourish */}
          <svg width="60" height="12" viewBox="0 0 60 12" fill="none" style={{ marginTop: 3 }}>
            <path d="M3 6 Q10 1 17 6 Q24 11 31 6 Q38 1 45 6 Q52 11 57 6"
              stroke="#354366" strokeWidth="1" strokeLinecap="round" fill="none"/>
          </svg>
        </div>
      </div>

      {/* Flower cluster bottom-right */}
      <img
        src="/invite/assets/flower-cluster.png"
        alt=""
        style={{
          position: 'absolute', bottom: 0, right: 0,
          width: '40%', opacity: .88,
          filter: 'url(#rm-blk-prev)',
          pointerEvents: 'none',
          transform: 'scaleX(-1)',
        }}
      />
    </div>
  );
}
