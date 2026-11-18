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

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/* Шрифт миниатюры — тот же локальный файл, что у шаблона: Alegreya Italic
   (переменный, один файл на все веса). Только кириллица и латиница. */
const F = '/invite/assets/fonts/';
const CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';
const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const CARD_FONTS = [
  `@font-face{font-family:'Alegreya';font-style:italic;font-weight:400 900;font-display:swap;src:url('${F}alegreya-italic-cyrillic.woff2') format('woff2');unicode-range:${CYR}}`,
  `@font-face{font-family:'Alegreya';font-style:italic;font-weight:400 900;font-display:swap;src:url('${F}alegreya-italic-latin.woff2') format('woff2');unicode-range:${LAT}}`,
].join('');

/* ─────────────────────────────────────────────────────────
   «Клубника» (Canva-макет «Жених + Невеста», 18.11.2026) — гость и
   редактор → iframe реального дизайна. У гостя полароид падает на стол,
   стикеры прилепляются по одному, переписка пары приходит сообщениями;
   в редакторе (editing=1) сразу финал. Данные: URL-параметры +
   postMessage('wc:data') без перезагрузки iframe.
   Превью-карточка → обложка из слоёв страницы с живыми фото, именами и
   датой (без iframe — её же печатает «Открытка с QR»).
───────────────────────────────────────────────────────── */
export default function StrawberryTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
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
    return `/invite/strawberry/index.html?${p.toString()}`;
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
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#f16298' }}
          title="Превью «Клубника»"
          allow="autoplay"
        />
      );
    }
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#fbd2e0' }}>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
          title="Клубника — свадебное приглашение"
          allow="autoplay"
        />
      </div>
    );
  }

  /* ── Карточка-превью: обложка из тех же слоёв, что на странице (координаты
     макета 1366px), фото пары в полароиде, имена и дата живым текстом.
     Единица — от ширины и высоты карточки: в телефоне — как у гостя, в низкой
     открытке обложка ужимается, по бокам розовый фон и полоса с клубникой. */
  const A = '/invite/strawberry/assets/';
  const u = (n: number) => `calc(${n} * var(--e))`;
  const img = (file: string, x: number, y: number, w: number, z = 4, extra: CSSProperties = {}) => (
    <img src={A + file} alt="" style={{ position: 'absolute', left: u(x), top: u(y), width: u(w), height: 'auto', display: 'block', zIndex: z, ...extra }} />
  );
  const serif = "'Alegreya', 'Cormorant Garamond', Georgia, serif";
  const groom = data.groomName || 'Вадим';
  const bride = data.brideName || 'Дарья';
  const names = `${groom} + ${bride}`;
  // Как fitNames в script.js: строка не шире поля полароида (~960), ~0,49 кегля на букву
  const nfs = Math.min(138, 960 / (names.length * 0.49));
  const [y, m, d] = (data.weddingDate || '').split('-').map(Number);
  const date = y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : '';
  // Дата не шире 1240 (~0,42 кегля на знак) — как fitDate в script.js
  const dfs = Math.min(182, 1240 / (Math.max(1, date.length) * 0.42));
  const cover = !data.coverPhoto ? `${A}cover.jpg`
    : data.coverPhoto.startsWith('/uploads') ? `${apiBase}${data.coverPhoto}` : data.coverPhoto;

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f16298',
      containerType: 'size', ['--e' as string]: 'min(100cqw / 1366, 100cqh / 2318)',
    } as CSSProperties}>
      <style>{CARD_FONTS}</style>
      {/* полоса с клубникой — через всю карточку, стык плитки совпадает со страницей */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: u(2183), height: u(135), zIndex: 1,
        background: `url(${A}strip-tile.webp) calc((100cqw - 1366 * var(--e)) / 2) 0 / auto 100% repeat-x`,
      }} />
      <div style={{ position: 'absolute', left: '50%', top: 0, width: u(1366), height: u(2960), transform: 'translateX(-50%)' }}>
        {img('cloud-top.webp', 0, 2500, 1366, 1)}
        {img('gingham-tl.webp', 0, 5, 297)}
        {img('lips.webp', 971, 201, 359, 1)}
        <div style={{ position: 'absolute', left: u(137), top: u(543), width: u(1094), height: u(1259), zIndex: 2 }}>
          <div style={{
            position: 'absolute', left: u(57), top: u(70), width: u(954), height: u(913), overflow: 'hidden',
            transform: 'rotate(-1.8deg)', background: '#cfe6f5',
          }}>
            <img src={cover} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <img src={`${A}polaroid.webp`} alt="" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 'auto', display: 'block' }} />
          <p style={{
            position: 'absolute', left: 0, right: 0, top: u(1042), margin: 0, display: 'flex', justifyContent: 'center',
            transform: `translateX(${u(20)}) rotate(-1.8deg)`, fontFamily: serif, fontStyle: 'italic', fontWeight: 400,
            fontSize: u(nfs), lineHeight: u(138), letterSpacing: '.045em', color: '#df3d74', whiteSpace: 'nowrap',
          }}><span style={{ paddingLeft: '.045em' }}>{names}</span></p>
        </div>
        {img('title.webp', 68, 218, 1150, 3)}
        {img('camera.webp', 1004, 673, 362)}
        {img('disco.webp', -159, 690, 471)}
        {img('money.webp', 997, 1055, 369)}
        {img('rose.webp', 0, 1398, 288)}
        {img('gingham-r.webp', 1244, 1508, 122)}
        {date ? (
          <p style={{
            position: 'absolute', left: 0, right: 0, top: u(1880), margin: 0, textAlign: 'center', zIndex: 4,
            fontFamily: serif, fontStyle: 'italic', fontWeight: 400, fontSize: u(dfs), lineHeight: u(182), color: '#f7f0ea', whiteSpace: 'nowrap',
          }}>{date}</p>
        ) : null}
      </div>
    </div>
  );
}
