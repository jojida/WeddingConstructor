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

/* ─────────────────────────────────────────────────────────
   «Витраж» (Canva-макет «Фиолетовое и Розовое Цветок Геометрический
   Цветочное Свадебное Приглашение», перекрашен в голубой, 06.10.2026) —
   гость и редактор → iframe реального дизайна. У гостя витраж проступает
   из дымки, идёт снег и пишутся имена; в редакторе (editing=1) сразу финал.
   Данные: URL-параметры + postMessage('wc:data') без перезагрузки iframe.
   Превью-карточка → обложка живым текстом поверх cover.jpg (как на странице).
───────────────────────────────────────────────────────── */
/* Шрифты миниатюры — те же локальные файлы, что у шаблона: Caravan (имена,
   /invite/assets/fonts/Caravan.woff2) и Lora — прямой и курсив
   (423708c44a2a7900fd37.css, переменный шрифт: один файл на все веса).
   Только кириллица и латиница — больше на обложке ничего нет. */
const G = '/invite/assets/fonts/google/';
const CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';
const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const face = (family: string, style: string, weight: string, file: string, range: string) =>
  `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url('${G}${file}') format('woff2');unicode-range:${range}}`;
const CARD_FONTS = [
  "@font-face{font-family:'Caravan';font-style:normal;font-weight:400;font-display:swap;src:url('/invite/assets/fonts/Caravan.woff2') format('woff2')}",
  face('Lora', 'normal', '400 700', 'c57d9ca3bd42e6bc093b.woff2', CYR),
  face('Lora', 'normal', '400 700', 'ddb8c66035104e233fc0.woff2', LAT),
  face('Lora', 'italic', '400', 'aaeb039ba0ecdbc75108.woff2', CYR),
  face('Lora', 'italic', '400', '723cc14fe86bc9fadb2f.woff2', LAT),
].join('');
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export default function VitrageTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
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
    return `/invite/vitrage/index.html?${p.toString()}`;
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
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#f0f7ff' }}
          title="Превью «Витраж»"
          allow="autoplay"
        />
      );
    }
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#dfe9f5' }}>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
          title="Витраж — свадебное приглашение"
          allow="autoplay"
        />
      </div>
    );
  }

  /* ── Карточка-превью: обложка как на странице (.cover в styles.css) ──
     Фон — тот же cover.jpg (без текста), поверх живым текстом «Свадьба», имена,
     «&», приглашение и дата — по координатам макета (1366 единиц в ширину).
     Единица e подгоняет обложку под карточку: в телефоне — во всю ширину, как
     у гостя (видно до даты включительно); в низкой открытке A6 обложка чуть
     уменьшается, чтобы влезла дата (до 2170 единиц), по бокам — фон страницы. */
  const custom = data.customData || {};
  const label = typeof custom.heroTitle === 'string' && custom.heroTitle.trim() ? custom.heroTitle : 'Свадьба';
  const heroText = typeof custom.heroText === 'string' ? custom.heroText.trim() : 'Самый тёплый день этой зимы — вместе с вами';
  const groom = data.groomName || 'Григорий';
  const bride = data.brideName || 'Александра';
  // Как fitNames в script.js: Caravan ~0,24–0,32 кегля на букву, строка не шире 900 единиц
  const longest = Math.max(groom.length, bride.length, 1);
  const fs = Math.min(300, 900 / (longest * 0.3));
  const [y, m, d] = (data.weddingDate || '').split('-').map(Number);
  const time = /^\d{1,2}:\d{2}/.test(data.weddingTime || '') ? data.weddingTime.slice(0, 5).padStart(5, '0') : '15:00';
  const u = (n: number) => `calc(${n} * var(--e))`;
  const blue = '#556f95';
  const lora = "'Lora', Georgia, 'Times New Roman', serif";
  const name = (baseline: number, x: number): CSSProperties => ({
    position: 'absolute', left: '50%', top: u(baseline - 0.75 * fs), margin: 0, whiteSpace: 'nowrap',
    transform: `translateX(calc(-50% + ${u(x)}))`,
    fontFamily: "'Caravan', cursive", fontWeight: 400, fontSize: u(fs), lineHeight: 1, color: blue,
  });
  const rule: CSSProperties = { flex: 'none', width: u(70), height: u(2.5), margin: `0 ${u(28)}`, background: 'currentColor', opacity: 0.55 };

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f0f7ff',
      containerType: 'size', ['--e' as string]: 'min(100cqw / 1366, 100cqh / 2170)',
    } as CSSProperties}>
      <style>{CARD_FONTS}</style>
      <div style={{ position: 'absolute', left: '50%', top: 0, width: u(1366), height: u(2601), transform: 'translateX(-50%)' }}>
        <img src="/invite/vitrage/assets/cover.jpg" alt=""
          style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 'auto', display: 'block' }} />
        <p style={{
          position: 'absolute', left: 0, top: u(748.5), width: '100%', margin: 0, textAlign: 'center',
          fontFamily: lora, fontWeight: 500, fontSize: u(47.4), lineHeight: 1, textTransform: 'uppercase', color: blue,
        }}>{label}</p>
        <p style={name(1080, -30)}>{groom}</p>
        <p style={{
          position: 'absolute', left: '50%', top: u(1262.4 - 0.866 * 124), margin: 0, transform: `translateX(calc(-50% + ${u(-6)}))`,
          fontFamily: lora, fontStyle: 'italic', fontWeight: 400, fontSize: u(124), lineHeight: 1, color: blue,
        }}>&amp;</p>
        <p style={name(1445.3, 18)}>{bride}</p>
        {heroText ? (
          <p style={{
            position: 'absolute', left: '50%', top: u(1690.8), width: u(560), margin: 0, transform: 'translateX(-50%)',
            textAlign: 'center', fontFamily: lora, fontWeight: 500, fontSize: u(46.5), lineHeight: u(63.8),
            textTransform: 'uppercase', color: blue, overflowWrap: 'anywhere',
          }}>{heroText}</p>
        ) : null}
        {y && m && d ? (
          <div style={{ position: 'absolute', left: 0, top: u(1985), width: '100%', textAlign: 'center', fontFamily: lora, color: blue }}>
            <p style={{
              margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500,
              fontSize: u(54), lineHeight: 1.2, letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}><span style={rule} />{d} {MONTHS[m - 1]} {y}<span style={rule} /></p>
            <p style={{ margin: `${u(8)} 0 0`, fontSize: u(42), fontStyle: 'italic', fontWeight: 400, lineHeight: 1.3 }}>в {time}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
