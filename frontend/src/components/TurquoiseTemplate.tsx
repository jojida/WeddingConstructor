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
}

/* Шрифты миниатюры — те же локальные файлы, что у шаблона: Kurale (имена)
   и Open Sans (подпись, дата, адрес). Только кириллица и латиница. */
const F = '/invite/assets/fonts/';
const G = '/invite/assets/fonts/google/';
const CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';
const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const face = (family: string, weight: string, url: string, range: string) =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url('${url}') format('woff2');unicode-range:${range}}`;
const CARD_FONTS = [
  face('Kurale', '400', `${F}kurale-cyrillic.woff2`, CYR),
  face('Kurale', '400', `${F}kurale-latin.woff2`, LAT),
  face('Open Sans', '300 800', `${G}2809606237a64bd9c146.woff2`, CYR),
  face('Open Sans', '300 800', `${G}d8e4fe0452aa2076429a.woff2`, LAT),
].join('');

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

/* ─────────────────────────────────────────────────────────
   «Бирюза» (Canva-макет «Blue and White Watercolor Wedding Invitation»,
   26.11.2026) — гость и редактор → iframe реального дизайна. У гостя агат
   «наплывает» слева, имена и дата проявляются (только на платных — intro=0
   у бесплатного); в редакторе (editing=1) сразу финал. Данные:
   URL-параметры + postMessage('wc:data') без перезагрузки iframe.
   Превью-карточка → обложка из слоёв страницы (без iframe — её же печатает
   «Открытка с QR»).
───────────────────────────────────────────────────────── */
export default function TurquoiseTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
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
    if (data.groomName) p.set('groom', data.groomName);
    if (data.brideName) p.set('bride', data.brideName);
    if (data.weddingDate) p.set('date', data.weddingDate);
    if (data.weddingTime) p.set('time', data.weddingTime);
    return `/invite/turquoise/index.html?${p.toString()}`;
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
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#f5f4f4' }}
          title="Превью «Бирюза»"
          allow="autoplay"
        />
      );
    }
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#e7eef0' }}>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
          title="Бирюза — свадебное приглашение"
          allow="autoplay"
        />
      </div>
    );
  }

  /* ── Карточка-превью: обложка из тех же слоёв, что на странице (координаты
     макета 1366px), имена, дата и адрес живым текстом. Единица — от ширины
     и высоты карточки с запасом «на вылет»: обложка (до волны, 2172) всегда
     заполняет карточку целиком, без полей — в высоком телефоне до самого низа
     (края агата и блёсток уходят за рамку), в открытке низ волны обрезается.
     Текст (x 392–1220) остаётся в кадре при любой пропорции до 1:2. */
  const A = '/invite/turquoise/assets/';
  const u = (n: number) => `calc(${n} * var(--e))`;
  const abs = (x: number, y: number, extra: CSSProperties = {}): CSSProperties => ({ position: 'absolute', left: u(x), top: u(y), margin: 0, ...extra });
  const name = "'Kurale', Georgia, serif";
  const text = "'Open Sans', 'Segoe UI', Arial, sans-serif";
  const custom = data.customData || {};
  const groom = data.groomName || 'Евгений';
  const bride = data.brideName || 'Диана';
  // Как fitNames в script.js: строка не шире 800, ~0,64 кегля на букву
  const nfs = Math.min(180, 800 / (Math.max(groom.length, bride.length, 1) * 0.64));
  const [y, m, d] = (data.weddingDate || '').split('-').map(Number);
  const time = /^\d{1,2}:\d{2}/.test(data.weddingTime || '') ? data.weddingTime.slice(0, 5).padStart(5, '0') : '12:30';
  const label = typeof custom.heroTitle === 'string' ? custom.heroTitle.trim() : 'приглашение на свадьбу';
  const quote = typeof custom.heroText === 'string' ? custom.heroText.trim() : 'Любовь — это когда лучший друг становится семьёй';
  const cell: CSSProperties = {
    position: 'absolute', top: u(24), width: u(203), height: u(56), display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderTop: `${u(3)} solid #be9253`, borderBottom: `${u(3)} solid #be9253`,
    fontFamily: text, fontSize: u(36), lineHeight: 1, letterSpacing: '.08em', paddingLeft: '.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
  };

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f5f4f4',
      containerType: 'size', ['--e' as string]: 'max(100cqw / 1366, 100cqh / 2172)',
    } as CSSProperties}>
      <style>{CARD_FONTS}</style>
      <div style={{ position: 'absolute', left: '50%', top: 0, width: u(1366), height: u(2300), transform: 'translateX(-50%)' }}>
        <img src={`${A}glitter-1.webp`} alt="" style={abs(161, 5, { width: u(831), height: 'auto' })} />
        <img src={`${A}glitter-2.webp`} alt="" style={abs(788, 12, { width: u(578), height: 'auto' })} />
        <img src={`${A}glitter-3.webp`} alt="" style={abs(1017, 1447, { width: u(349), height: 'auto' })} />
        <img src={`${A}glitter-4.webp`} alt="" style={abs(419, 64, { width: u(286), height: 'auto' })} />
        <img src={`${A}agate-cover.webp`} alt="" style={abs(0, 5, { width: u(676), height: 'auto' })} />
        {label ? (
          <p style={abs(392, 352, { width: u(800), textAlign: 'center', fontFamily: text, fontSize: u(48), lineHeight: u(66), color: '#111' })}>{label}</p>
        ) : null}
        <div style={abs(392, 428, { width: u(800), height: u(420), textAlign: 'center', fontFamily: name, fontSize: u(nfs), lineHeight: u(238), textTransform: 'uppercase', color: '#0d0d0d' })}>
          <img src={`${A}amp.webp`} alt="" style={abs(318, 121, { width: u(193), height: 'auto' })} />
          <span style={{ position: 'relative', display: 'block', whiteSpace: 'nowrap' }}>{groom}</span>
          <span style={{ position: 'relative', display: 'block', whiteSpace: 'nowrap' }}>{bride}</span>
        </div>
        {quote ? (
          <p style={abs(540, 934, { width: u(680), textAlign: 'center', fontFamily: text, fontSize: u(33), lineHeight: u(42), color: '#111' })}>{quote}</p>
        ) : null}
        {y && m && d ? (
          <div style={abs(585, 1048, { width: u(611), height: u(160), fontFamily: text, color: '#111' })}>
            <span style={{ ...cell, left: 0, fontWeight: 400 }}>{MONTHS[m - 1]}</span>
            <span style={{ position: 'absolute', left: u(220), top: u(-4), width: u(170), textAlign: 'center', fontSize: u(103), lineHeight: u(110), fontWeight: 800 }}>{d}</span>
            <span style={{ ...cell, left: u(408), fontWeight: 700 }}>{time}</span>
            <span style={{ position: 'absolute', left: u(220), top: u(116), width: u(170), textAlign: 'center', fontSize: u(36), lineHeight: 1, fontWeight: 700, letterSpacing: '.12em', paddingLeft: '.12em' }}>{y}</span>
          </div>
        ) : null}
        {data.venueAddress ? (
          <p style={abs(580, 1240, { width: u(610), textAlign: 'center', fontFamily: text, fontSize: u(36), lineHeight: u(46), color: '#111' })}>{data.venueAddress}</p>
        ) : null}
      </div>
    </div>
  );
}
