'use client';
import { CSSProperties, useEffect, useMemo, useRef } from 'react';
import { InviteData } from './TemplatePreview';
import { introParams } from '@/lib/intro-choice';

interface Props {
  data: InviteData;
  apiBase: string;
  fullPage?: boolean;
  slug?: string;
  editing?: boolean;
  /** Главная показывает заставку даже в упрощённом режиме превью. */
  showIntro?: boolean;
  /** load iframe живого превью — hero лендинга ждёт его, чтобы сменить миниатюру */
  onFrameLoad?: () => void;
}

/* ─────────────────────────────────────────────────────────
   Full-page / editing → iframe реального дизайна.
     URL-параметры (страница гостя) + postMessage('wc:data') (живое превью).
     В режиме editing передаём editing=1 — «слив воды» с даты/скролл-гейт отключаются.
   Preview/card → миниатюра с именами поверх фото.
───────────────────────────────────────────────────────── */
export default function MediterraneanTemplate({ data, apiBase, fullPage, slug, editing, showIntro, onFrameLoad }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  const live = !!(fullPage || editing);

  const initialSrc = useMemo(() => {
    const p = new URLSearchParams();
    p.set('apiBase', apiBase || '');
    if (slug) p.set('slug', slug);
    if (editing) p.set('editing', '1');
    introParams(p, data);   // заставка: своя, общий конверт или никакой (бесплатный)
    if (showIntro) p.set('intro', '1');
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
          enabledSections: d.enabledSections || {},
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
      window.location.origin
    );
  };

  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.origin !== window.location.origin || e.source !== iframeRef.current?.contentWindow) return; if (e.data && e.data.type === 'wc:ready') postData(); };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, slug]);

  useEffect(() => {
    postData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, apiBase, slug]);

  if (live) {
    if (fullPage) {
      return (
        <div className="wc-guest-page" style={{ width: '100%', minHeight: '100vh', background: '#0a1522' }}>
          <iframe
            ref={iframeRef}
            src={initialSrc}
            className="wc-guest-frame" style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
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
        onLoad={onFrameLoad}
      />
    );
  }

  /* ── Карточка-превью: обложка как на странице (/invite/index.html, .hero) ──
     Окно window.jpg (1080×1439) — во всю карточку (cover). Плашка с именами,
     цветы по бокам и размеры — как на странице, где окно 4:5 во всю ширину:
     плашка 56 % ширины окна, по центру обрезанной картинки (675 px картинки от
     верха), имена Gogol 6 % ширины окна, цветы на 51 % высоты окна. --s —
     пикселей карточки на пиксель картинки, поэтому плашка стоит на том же месте
     картинки при любой форме карточки. Держать в согласии с .name-card,
     .couple-names и .hero-deco в /invite/styles.css. */
  const S = (n: number) => `calc(${n} * var(--s))`;
  const k = 1080 / 480;          // страница шириной 480: px макета → px картинки
  const ink = '#354366';
  const frame = 'M 31 5 L 269 5 A 26 26 0 0 0 295 31 L 295 145 A 26 26 0 0 0 269 171 L 31 171 A 26 26 0 0 0 5 145 L 5 31 A 26 26 0 0 0 31 5 Z';
  const flower = (side: 'left' | 'right'): CSSProperties => ({
    position: 'absolute', top: `calc(50% - ${S(31)})`, [side]: `calc(50% - ${S(383.4)})`,
    width: S(108), height: 'auto', pointerEvents: 'none', filter: 'url(#rm-blk-prev)',
    transform: side === 'left' ? 'rotate(-25deg)' : 'rotate(25deg) scaleX(-1)',
  });
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#dbeeff',
      containerType: 'size', ['--s' as string]: 'max(100cqw / 1080, 100cqh / 1439)',
    } as CSSProperties}>
      {/* Цветы у плашки — PNG с чёрным фоном: убираем чёрное, как на странице */}
      <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }}>
        <defs>
          <filter id="rm-blk-prev" colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 1 1 0 0" />
          </filter>
        </defs>
      </svg>

      <img src="/invite/assets/window.jpg" alt="Средиземноморье"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />

      <div style={{
        position: 'absolute', top: `calc(50% - ${S(44.5)})`, left: '50%', transform: 'translate(-50%, -50%)',
        width: S(604.8), textAlign: 'center',
      }}>
        <svg viewBox="0 0 300 176" preserveAspectRatio="none" aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, filter: `drop-shadow(0 ${S(6 * k)} ${S(16 * k)} rgba(17, 78, 136, 0.18))` }}>
          <path d={frame} fill="rgba(233,242,252,0.94)" />
          <path d={frame} fill="none" stroke="#114e88" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <path d="M 33 13 L 267 13 A 20 20 0 0 0 287 33 L 287 143 A 20 20 0 0 0 267 163 L 33 163 A 20 20 0 0 0 13 143 L 13 33 A 20 20 0 0 0 33 13 Z"
            fill="none" stroke="#114e88" strokeWidth="1" opacity={0.85} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        <div style={{ position: 'relative', zIndex: 1, padding: `${S(11 * k)} ${S(26 * k)}` }}>
          <span aria-hidden="true" style={{ display: 'block', color: ink, marginBottom: S(1 * k), lineHeight: 0 }}>
            <svg viewBox="0 0 24 24" focusable="false" style={{ display: 'inline-block', width: S(12 * k), height: S(12 * k) }}>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor" />
            </svg>
          </span>
          <p style={{ margin: 0, fontFamily: "'Gogol', 'Marck Script', cursive", fontWeight: 400, fontSize: S(64.8), lineHeight: 1.02, color: ink }}>
            {data?.brideName || 'Катерина'}<br />
            <span style={{ fontSize: '0.7em', display: 'inline-block', margin: `${S(-2 * k)} 0` }}>и</span><br />
            {data?.groomName || 'Максим'}
          </p>
          <svg viewBox="0 0 90 18" fill="none" style={{ display: 'block', margin: `${S(3 * k)} auto 0`, width: S(90 * k), height: S(18 * k) }}>
            <path d="M5 9 Q15 3 25 9 Q35 15 45 9 Q55 3 65 9 Q75 15 85 9" stroke={ink} strokeWidth="1.2" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      </div>
      <img src="/invite/assets/flower-single.lossless.webp" alt="" style={flower('left')} />
      <img src="/invite/assets/flower-single.lossless.webp" alt="" style={flower('right')} />
    </div>
  );
}
