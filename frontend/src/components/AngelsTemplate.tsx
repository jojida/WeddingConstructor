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

/* ─────────────────────────────────────────────────────────
   «Ангелы» (макет Figma «Приглашение 1», фрейм «Ан 1», 03.10.2026;
   исправленный макет 16.11.2026 — тёплая акварель вместо неба) — гость и
   редактор → iframe реального дизайна. У гостя на обложке облака
   поднимаются, руки тянутся друг к другу, прилетает Купидон и пишутся
   имена; в редакторе (editing=1) сразу финал. Данные: URL-параметры +
   postMessage('wc:data') без перезагрузки iframe.
   Превью-карточка → обложка шаблона с живыми именами и датой.
───────────────────────────────────────────────────────── */
export default function AngelsTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
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
    return `/invite/angels/index.html?${p.toString()}`;
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
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#d6b799' }}
          title="Превью «Ангелы»"
          allow="autoplay"
        />
      );
    }
    return (
      <div className="wc-guest-page" style={{ width: '100%', minHeight: '100vh', background: '#b59576' }}>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          className="wc-guest-frame" style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
          title="Ангелы — свадебное приглашение"
          allow="autoplay"
        />
      </div>
    );
  }

  /* ── Карточка-превью: обложка из тех же слоёв, что .hero на странице ──
     Акварельный фон, облака, руки, Купидон, ангел с арфой, надпись, имена с
     «&» и дата — по координатам макета (1366 единиц в ширину, styles.css).
     Обложка — 2125 единиц: в открытке A6 снизу срезаются облака под руками,
     в телефоне ниже обложки видна бумага и голубь в лучах, как у гостя. */
  const u = (n: number) => `calc(${n} * 100cqw / 1366)`;
  const groom = data.groomName || 'Алексей';
  const bride = data.brideName || 'Ангелина';
  // как fitNames в script.js: у строки жениха полоса 40…1240 (правее — нога
  // Купидона), у невесты 350…1326 (левее — арфа); строка отходит от ангела,
  // не помещается — обе ужимаются. Ширина — ~0,73 кегля на заглавную
  const wG = 0.73 * 163.4 * Math.max(groom.length, 1), wB = 0.73 * 163.4 * Math.max(bride.length, 1);
  const k = Math.min(1, 1200 / wG, 976 / wB);
  const fs = 163.4 * k;
  const center = (w: number, c: number, lo: number, hi: number) => Math.min(Math.max(c, lo + w / 2), hi - w / 2);
  const gx = center(wG * k, 654, 40, 1240), bx = center(wB * k, 713, 350, 1326);
  const [y, m, d] = (data.weddingDate || '').split('-').map(Number);
  const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const label = typeof data.customData?.heroTitle === 'string' ? data.customData.heroTitle.trim() : 'Приглашение';
  const A = '/invite/angels/assets/';
  const glow = `0 0 ${u(18)} rgba(110, 76, 48, .35)`;
  const img = (src: string, left: number, top: number, width: number, extra?: CSSProperties) => (
    <img src={A + src} alt="" style={{ position: 'absolute', left: u(left), top: u(top), width: u(width), height: 'auto', display: 'block', ...extra }} />
  );
  const fade = (from: number): CSSProperties => ({
    WebkitMaskImage: `linear-gradient(180deg, #000 ${from}%, transparent 100%)`,
    maskImage: `linear-gradient(180deg, #000 ${from}%, transparent 100%)`,
  });
  const line = (top: number, center: number, extra: CSSProperties): CSSProperties => ({
    position: 'absolute', left: u(center), top: u(top), margin: 0, whiteSpace: 'nowrap', transform: 'translateX(-50%)', lineHeight: 1, ...extra,
  });

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
      background: `#d6b799 url(${A}paper.jpg) 0 ${u(2125)} / 100% auto repeat-y`,
      containerType: 'size',
    } as CSSProperties}>
      {img('hero-bg.jpg', 0, 0, 1366, fade(93))}
      {img('hero-clouds.webp', 0, 1256, 1366, fade(82))}
      {img('hand-l.webp', 0, 1338, 683)}
      {img('hand-r.webp', 683, 1440, 683)}
      {img('cupid-bow.webp', 916.5, 70.5, 423)}
      {img('hero-harp.webp', 20.5, 881.5, 314)}
      {img('dove-rays.webp', 419, 2196, 548)}
      {label ? (
        <p style={line(348.5, 689.5, {
          paddingLeft: '.36em', fontFamily: "'Poiret One', sans-serif", fontSize: u(52), letterSpacing: '.36em',
          textTransform: 'uppercase', color: '#f2f1eb', WebkitTextStroke: `${u(0.8)} currentColor`, textShadow: glow,
        })}>{label}</p>
      ) : null}
      {[[groom, gx, 491.8], [bride, bx, 895.8]].map(([name, cx, top]) => (
        <p key={String(top)} style={line(Number(top), Number(cx), {
          paddingLeft: '.015em', fontFamily: "'Old Standard TT', 'Times New Roman', serif", fontWeight: 400, fontSize: u(fs),
          letterSpacing: '.015em', textTransform: 'uppercase', color: '#fff', textShadow: glow,
        })}>{name}</p>
      ))}
      <span aria-hidden style={{
        position: 'absolute', left: u(582.7), top: u(608.7), width: u(205.8), height: u(221.4), background: '#807f78', opacity: 0.37,
        WebkitMask: `url(${A}amp.svg) center / 100% 100% no-repeat`, mask: `url(${A}amp.svg) center / 100% 100% no-repeat`,
      }} />
      {y && m && d ? (
        <p style={line(1147.8, 664, {
          paddingLeft: '.189em', fontFamily: "'Poiret One', sans-serif", fontSize: u(53.9), letterSpacing: '.189em',
          textTransform: 'uppercase', color: '#3c3333', WebkitTextStroke: `${u(1.6)} currentColor`,
        })}>{`${d} ${MONTHS_GEN[m - 1]} ${y}`}</p>
      ) : null}
    </div>
  );
}
