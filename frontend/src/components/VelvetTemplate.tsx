'use client';
import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { InviteData } from './TemplatePreview';
import { hasIntro } from '@/lib/plans';

interface Props {
  data: InviteData;
  apiBase: string;
  fullPage?: boolean;
  slug?: string;
  editing?: boolean;
}

/* Шрифты миниатюры — те же локальные файлы, что у шаблона
   (/invite/assets/fonts/google/0f1ebb90d8209a2657ff.css): Great Vibes (заголовок,
   имена) и Open Sans (подзаголовок; переменный — один файл на все веса).
   Только кириллица и латиница — больше на обложке ничего нет. */
const G = '/invite/assets/fonts/google/';
const CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';
const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const face = (family: string, weight: string, file: string, range: string) =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url('${G}${file}') format('woff2');unicode-range:${range}}`;
const CARD_FONTS = [
  face('Great Vibes', '400', '80b935e653c6426a8780.woff2', CYR),
  face('Great Vibes', '400', 'c59dc73d29daf142ef24.woff2', LAT),
  face('Open Sans', '400 600', '2809606237a64bd9c146.woff2', CYR),
  face('Open Sans', '400 600', 'd8e4fe0452aa2076429a.woff2', LAT),
].join('');
/** Высота обложки .cover в единицах макета (styles.css) */
const COVER_H = 1970;

/* ─────────────────────────────────────────────────────────
   «Бархат» (Canva-шаблон «бордовый бархат», 16.11.2026) — гость и
   редактор → iframe реального дизайна. У гостя заголовок и конверт в руках
   проявляются, имена пишутся; в редакторе (editing=1) сразу финал.
   Данные: URL-параметры + postMessage('wc:data') без перезагрузки iframe.
   Превью-карточка → обложка шаблона с живыми именами (без iframe — её же
   печатает «Открытка с QR»): та же вёрстка, что у .cover в styles.css.
───────────────────────────────────────────────────────── */
export default function VelvetTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  const live = !!(fullPage || editing);

  /* Миниатюра: обложка (1080×1970 в единицах макета) целиком помещается в блок.
     Блок ниже обложки (открытка) — композиция уменьшается по высоте и встаёт по
     центру, бархат и кружево остаются до краёв: имена не срезаются и на печати. */
  const boxRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  useEffect(() => {
    const el = boxRef.current;
    if (live || !el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const need = (w * COVER_H) / 1080;
      setFit(h < need ? Math.max(0.55, h / need) : 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [live]);

  const initialSrc = useMemo(() => {
    const p = new URLSearchParams();
    p.set('apiBase', apiBase || '');
    if (slug) p.set('slug', slug);
    if (editing) p.set('editing', '1');
    if (!hasIntro(data.plan)) p.set('intro', '0');   // анимация открытия — платная
    if (data.groomName) p.set('groom', data.groomName);
    if (data.brideName) p.set('bride', data.brideName);
    if (data.weddingDate) p.set('date', data.weddingDate);
    if (data.weddingTime) p.set('time', data.weddingTime);
    return `/invite/velvet/index.html?${p.toString()}`;
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
          enabledSections: dataRef.current.enabledSections || {},
          ...(d.customData || {}),
          apiBase,
          slug: slug || '',
          groomName: d.groomName,
          brideName: d.brideName,
          weddingDate: d.weddingDate,
          weddingTime: d.weddingTime,
          inviteText: d.inviteText,
          venue: d.venue,
          venueAddress: d.venueAddress,
          mapLink: d.mapLink,
          story: d.story,
          schedule: d.schedule,
          dressCodeColors: d.dressCodeColors,
          musicUrl: d.musicUrl,
        },
      },
      window.location.origin
    );
  };

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== iframeRef.current?.contentWindow) return;
      if (e.data && e.data.type === 'wc:ready') postData();
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, slug]);

  useEffect(() => {
    postData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, apiBase, slug]);

  if (live) {
    if (editing) {
      return (
        <iframe
          ref={iframeRef}
          src={initialSrc}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#480c19' }}
          title="Превью «Бархат»"
          allow="autoplay"
        />
      );
    }
    return (
      <div className="wc-guest-page" style={{ width: '100%', minHeight: '100vh', background: '#24040b' }}>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          className="wc-guest-frame" style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
          title="Бархат — свадебное приглашение"
          allow="autoplay"
        />
      </div>
    );
  }

  /* ── Карточка-превью: обложка — бархат, кружево, конверт в руках и живые
     имена. Размеры — в пикселях макета (1080) через ширину контейнера,
     fit < 1 — блок ниже обложки, композиция уменьшена до его высоты. */
  const u = (n: number) => `calc(${n} * ${fit} * 100cqw / 1080)`;
  const light = '#f4e9df';
  const script = "'Great Vibes', 'Marck Script', cursive";
  const custom = data.customData || {};
  const groom = data.groomName || 'Михаил';
  const bride = data.brideName || 'Анастасия';
  const title = typeof custom.heroTitle === 'string' ? custom.heroTitle.trim() : 'Приглашение';
  const sub = typeof custom.heroSub === 'string' ? custom.heroSub.trim() : 'на свадьбу';
  // Как fitNames в script.js: длинное имя (с учётом сдвига строки) уменьшает кегль,
  // ~0,45 кегля на букву Great Vibes
  const fs = Math.min(200, 880 / (groom.length * 0.45), 940 / (bride.length * 0.45));
  const line = (shift: number, extra: CSSProperties = {}): CSSProperties => ({
    display: 'block', width: 'max-content', margin: '0 auto', transform: `translateX(${u(shift)})`, ...extra,
  });
  const shadow = `0 ${u(2)} ${u(12)} rgba(20, 0, 6, .45)`;

  return (
    <div ref={boxRef} style={{
      position: 'relative', width: '100%', height: '100%', overflow: 'hidden', containerType: 'inline-size',
      background: "#480c19 url('/invite/velvet/assets/velvet.jpg') center top / 100% auto repeat-y",
      color: light, textAlign: 'center', textShadow: shadow,
    }}>
      <style>{CARD_FONTS}</style>
      {/* кружево — в углах самого блока; левое уходит под нижний край, как под карточку на странице */}
      <img src="/invite/velvet/assets/lace-tr.webp" alt=""
        style={{ position: 'absolute', right: 0, top: 0, width: u(540), height: 'auto', display: 'block' }} />
      <img src="/invite/velvet/assets/lace-l.webp" alt=""
        style={{ position: 'absolute', left: 0, top: u(1540), width: u(560), height: 'auto', display: 'block' }} />
      <div style={{ position: 'relative', width: `calc(${fit} * 100cqw)`, margin: '0 auto' }}>
      <div style={{ position: 'relative', paddingTop: u(150), paddingRight: u(70) }}>
        {title ? <p style={{ margin: 0, fontFamily: script, fontSize: u(172), lineHeight: 1.05 }}>{title}</p> : null}
        {sub ? (
          <p style={{
            margin: `${u(2)} 0 0`, fontFamily: "'Open Sans', Arial, sans-serif", fontSize: u(46), lineHeight: 1.3,
            letterSpacing: '.14em', paddingLeft: '.14em', textTransform: 'uppercase',
          }}>{sub}</p>
        ) : null}
      </div>
      <img src="/invite/velvet/assets/envelope-hands.webp" alt=""
        style={{ position: 'relative', display: 'block', width: u(1300), maxWidth: 'none', height: 'auto', margin: `${u(30)} 0 0 ${u(-110)}` }} />
      <div style={{
        position: 'relative', margin: `${u(-90)} 0 0`, fontFamily: script, fontWeight: 400,
        fontSize: u(fs), lineHeight: 0.95, whiteSpace: 'nowrap',
      }}>
        <span style={line(-90)}>{groom}</span>
        <span style={line(-170, { fontSize: '.75em', lineHeight: 1.15 })}>и</span>
        <span style={line(50)}>{bride}</span>
      </div>
      </div>
    </div>
  );
}
