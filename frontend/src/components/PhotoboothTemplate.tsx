'use client';
import { CSSProperties, useEffect, useMemo, useRef } from 'react';
import { InviteData } from './TemplatePreview';
import { hasIntro } from '@/lib/plans';

interface Props {
  data: InviteData;
  apiBase: string;
  fullPage?: boolean;
  slug?: string;
  editing?: boolean;
}

/* Шрифты миниатюры — те же локальные файлы, что у шаблона: Fallout (имена,
   обращение) и Open Sans (дата, текст). Только кириллица и латиница. */
const F = '/invite/assets/fonts/';
const G = '/invite/assets/fonts/google/';
const CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';
const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const face = (family: string, weight: string, url: string, range: string) =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url('${url}') format('woff2');unicode-range:${range}}`;
const CARD_FONTS = [
  `@font-face{font-family:'Fallout';font-style:normal;font-weight:400;font-display:swap;src:url('${F}fallout.woff2') format('woff2')}`,
  face('Open Sans', '300 800', `${G}2809606237a64bd9c146.woff2`, CYR),
  face('Open Sans', '300 800', `${G}d8e4fe0452aa2076429a.woff2`, LAT),
].join('');

/* «Мы женимся» в чёрных кружках — координаты макета, как в index.html */
const DOTS: [string, number, number][] = [
  ['М', 137, 840], ['Ы', 238, 840], ['Ж', 444, 1000], ['Е', 568, 1020], ['Н', 680, 1003],
  ['И', 776, 1047], ['М', 864, 1017], ['С', 983, 1058], ['Я', 1072, 1017],
];
const SPARKS: [number, number, number][] = [[11, 29, 123], [1000, 27, 127], [162, 154, 96], [176, 1080, 123], [92, 1374, 117], [1029, 1279, 110]];

/* ─────────────────────────────────────────────────────────
   «Фотобудка» (Canva-макеты «Текст абзаца», 25.11.2026) — гость и
   редактор → iframe реального дизайна. У гостя заставка-фотобудка:
   нажатие на красную кнопку — вспышка, камера печатает ленту с фото пары
   и датой, потом открывается сайт (только на платных — intro=0 у
   бесплатного). В редакторе (editing=1) заставка играет по кнопке на
   обложке. Данные: URL-параметры + postMessage('wc:data').
   Превью-карточка → обложка без iframe (её же печатает «Открытка с QR»).
───────────────────────────────────────────────────────── */
export default function PhotoboothTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  const live = !!(fullPage || editing);

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
    return `/invite/photobooth/index.html?${p.toString()}`;
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
          coverPhoto: d.coverPhoto,
          venue: d.venue,
          venueAddress: d.venueAddress,
          mapLink: d.mapLink,
          story: d.story,
          schedule: d.schedule,
          dressCodeColors: d.dressCodeColors,
          dressCodePhoto: d.dressCodePhoto,
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
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#fffaf2' }}
          title="Превью «Фотобудка»"
          allow="autoplay"
        />
      );
    }
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#ecebe6' }}>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
          title="Фотобудка — свадебное приглашение"
          allow="autoplay"
        />
      </div>
    );
  }

  /* ── Карточка-превью: обложка из тех же слоёв, что на странице (координаты
     макета 1366px), под ней — пластинка и обращение, как у гостя на телефоне.
     Единица — от ширины и высоты карточки. */
  const A = '/invite/photobooth/assets/';
  const u = (n: number) => `calc(${n} * var(--e))`;
  const abs = (x: number, y: number, extra: CSSProperties = {}): CSSProperties => ({ position: 'absolute', left: u(x), top: u(y), margin: 0, ...extra });
  const head = "'Fallout', 'Arial Narrow', Arial, sans-serif";
  const text = "'Open Sans', 'Segoe UI', Arial, sans-serif";
  const custom = data.customData || {};
  const groom = data.groomName || 'Артём';
  const bride = data.brideName || 'Вера';
  const names = `${bride} & ${groom}`;
  // Как fitNames в script.js: строка не шире 1240, ~0,62 кегля на знак с разрядкой
  const nfs = Math.min(69, 1240 / (names.length * 0.62));
  const [y, m, d] = (data.weddingDate || '').split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = y && m && d ? `${pad(d)}/${pad(m)}/${y}` : '';
  const cover = !data.coverPhoto ? `${A}cover.jpg`
    : data.coverPhoto.startsWith('/uploads') ? `${apiBase}${data.coverPhoto}` : data.coverPhoto;
  const bw = custom.coverBw !== false;
  const greeting = typeof custom.greetingTitle === 'string' && custom.greetingTitle.trim() ? custom.greetingTitle.trim() : 'Дорогие гости';
  const gm = greeting.match(/^(Дорог\S*|Милы\S*|Мил\S*|Уважаем\S*|Любим\S*|Родн\S*)\s+(.+)$/i);
  const gLabel = gm ? gm[1] : '';
  const gTitle = gm ? gm[2] : greeting;

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#fffaf2',
      containerType: 'size', ['--e' as string]: 'min(100cqw / 1366, 100cqh / 1740)',
    } as CSSProperties}>
      <style>{CARD_FONTS}</style>
      <div style={{ position: 'absolute', left: '50%', top: 0, width: u(1366), height: u(2700), transform: 'translateX(-50%)' }}>
        <img src={`${A}hero-card.webp`} alt="" style={abs(72, 5, { width: u(1193), height: 'auto' })} />
        <div style={abs(138, 239, {
          width: u(1089), height: u(1145), background: '#d9d9d9',
          WebkitMask: `url(${A}heart-mask.png) center / 100% 100% no-repeat`, mask: `url(${A}heart-mask.png) center / 100% 100% no-repeat`,
        })}>
          <img src={cover} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', filter: bw ? 'grayscale(1) contrast(1.05)' : undefined }} />
        </div>
        <img src={`${A}heart-line.webp`} alt="" style={abs(139, 239, { width: u(1088), height: 'auto' })} />
        {DOTS.map(([ch, x, yy], i) => (
          <span key={i} style={abs(x, yy, {
            width: u(136), height: u(136), borderRadius: '50%', background: '#000', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: text, fontWeight: 600, fontSize: u(70), lineHeight: 1,
          })}>{ch}</span>
        ))}
        {SPARKS.map(([x, yy, w], i) => (
          <img key={i} src={`${A}spark-black.webp`} alt="" style={abs(x, yy, { width: u(w), height: 'auto' })} />
        ))}
        <p style={abs(0, 1453.1, {
          width: '100%', textAlign: 'center', fontFamily: head, fontWeight: 400, fontSize: u(nfs), lineHeight: u(92),
          letterSpacing: '.12em', paddingLeft: '.12em', textTransform: 'uppercase', whiteSpace: 'nowrap', color: '#000',
        })}>{names}</p>
        {date ? (
          <p style={abs(-30, 1616, {
            width: '100%', textAlign: 'center', fontFamily: text, fontWeight: 400, fontSize: u(62), lineHeight: u(80),
            letterSpacing: '.08em', color: '#000',
          })}>{date}</p>
        ) : null}
        {/* Под обложкой — пластинка и обращение (как на странице: 1740 + отступы) */}
        <img src={`${A}vinyl.webp`} alt="" style={abs(-324.5, 1755.9, { width: u(711), height: 'auto' })} />
        <div style={abs(460, 1808.7, { width: u(758), textAlign: 'right', color: '#000' })}>
          {gLabel ? <p style={{ margin: 0, fontFamily: text, fontSize: u(36), lineHeight: u(44), letterSpacing: '.1em', textTransform: 'uppercase' }}>{gLabel}</p> : null}
          <p style={{
            margin: `${u(8)} 0 0`, fontFamily: head, fontWeight: 400, fontSize: u(150), lineHeight: u(168),
            letterSpacing: '.03em', textTransform: 'uppercase', overflowWrap: 'anywhere',
          }}>{gTitle}</p>
        </div>
      </div>
    </div>
  );
}
