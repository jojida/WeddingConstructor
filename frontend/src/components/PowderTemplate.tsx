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
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

/* ─────────────────────────────────────────────────────────
   «Пудра» (Canva-макет «Pink Beige Watercolor Illustration Wedding
   Invitation», 15.11.2026) — гость и редактор → iframe реального дизайна.
   У гостя арка и пара проявляются, цветы распускаются, имена пишутся;
   в редакторе (editing=1) сразу финал. Данные: URL-параметры +
   postMessage('wc:data') без перезагрузки iframe.
   Превью-карточка → обложка шаблона с живыми именами и датой (без iframe —
   её же печатает «Открытка с QR»).
───────────────────────────────────────────────────────── */
export default function PowderTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
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
    return `/invite/powder/index.html?${p.toString()}`;
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
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#fff' }}
          title="Превью «Пудра»"
          allow="autoplay"
        />
      );
    }
    return (
      <div className="wc-guest-page" style={{ width: '100%', minHeight: '100vh', background: '#f4e9e7' }}>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          className="wc-guest-frame" style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
          title="Пудра — свадебное приглашение"
          allow="autoplay"
        />
      </div>
    );
  }

  /* ── Карточка-превью: обложка (арка, цветы, пара) — картинка без текста,
     поверх неё надпись, имена и дата по координатам макета (1366px). */
  const u = (n: number) => `calc(${n} * 100cqw / 1366)`;
  const pink = '#cc7c72';
  const taupe = '#735e59';
  const serif = "'Cormorant Garamond', 'Times New Roman', serif";
  const custom = data.customData || {};
  const groom = data.groomName || 'Никита';
  const bride = data.brideName || 'Ольга';
  // «Невеста &» и «Жених» не должны залезать на цветы и арку: ~0,5 кегля на букву,
  // «&» с отступом — ещё 0,9 кегля
  const fs = Math.min(232, 800 / (bride.length * 0.5 + 0.9), 830 / (groom.length * 0.5));

  const [y, m, d] = (data.weddingDate || '').split('-').map(Number);
  const wday = y && m && d ? WEEKDAYS[new Date(y, m - 1, d).getDay()] : '';
  const time = /^\d{1,2}:\d{2}/.test(data.weddingTime || '') ? data.weddingTime.slice(0, 5).padStart(5, '0') : '12:30';
  const at = (left: number, top: number, extra: CSSProperties): CSSProperties => ({
    position: 'absolute', left: u(left), top: u(top), margin: 0, whiteSpace: 'nowrap', ...extra,
  });
  // Блок даты увеличен в DK раз вокруг черты (x 302), как .cover__date в styles.css
  const DK = 1.2;
  const k = (n: number) => n * DK;
  const small = (ls: number, size = 32): CSSProperties => ({
    fontFamily: serif, fontWeight: 600, fontSize: u(k(size)), lineHeight: u(k(38.4)), letterSpacing: `${ls}em`, textTransform: 'uppercase',
  });
  const label = typeof custom.heroTitle === 'string' && custom.heroTitle.trim() ? custom.heroTitle : 'Приглашение на свадьбу';
  const save = typeof custom.saveDate === 'string' ? custom.saveDate.trim() : 'Save the date';
  const heroText = typeof custom.heroText === 'string' ? custom.heroText.trim()
    : 'С радостью в сердце приглашаем вас разделить с нами день любви и нежности';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#fff', containerType: 'inline-size' }}>
      <img src="/invite/powder/assets/preview.webp" alt=""
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 'auto', display: 'block' }} />
      <p style={at(141, 69.6, {
        width: u(640), whiteSpace: 'normal', fontFamily: serif, fontWeight: 600, fontSize: u(59.2), lineHeight: u(67),
        letterSpacing: '.217em', textTransform: 'uppercase', color: taupe,
      })}>{label}</p>
      <div style={at(40, 298.3, { fontFamily: "'Great Vibes', cursive", fontSize: u(fs), lineHeight: u(175), color: pink })}>
        <span style={{ display: 'block', marginLeft: u(26) }}>
          {bride}
          <span aria-hidden style={{
            display: 'inline-block', width: '.7915em', height: '.9003em', marginLeft: '.11em', verticalAlign: '-.3246em',
            background: pink,
            WebkitMask: 'url(/invite/powder/assets/amp.svg) center / 100% 100% no-repeat',
            mask: 'url(/invite/powder/assets/amp.svg) center / 100% 100% no-repeat',
          }} />
        </span>
        <span style={{ display: 'block' }}>{groom}</span>
      </div>
      {y && m && d ? (
        <div style={at(302 - k(142), 850, { width: u(k(460)), height: u(k(230)), color: taupe })}>
          {save ? <p style={at(k(11), k(8.8), { fontFamily: serif, fontWeight: 600, fontSize: u(k(27.2)), lineHeight: u(k(33)), letterSpacing: '.172em', textTransform: 'uppercase', color: pink })}>{save}</p> : null}
          <span style={at(0, k(57.8), { width: u(k(124)), textAlign: 'right', fontFamily: serif, fontWeight: 400, fontSize: u(k(98)), lineHeight: u(k(98)) })}>{d}</span>
          <span style={at(k(142), k(89), { width: u(k(2.4)), height: u(k(124)), background: pink })} />
          <span style={at(k(157), k(129.6), wday.length > 8 ? small(.06, 30) : small(.177))}>{wday}</span>
          <span style={at(0, k(174.6), { ...small(.12), width: u(k(131)), textAlign: 'right' })}>{MONTHS[m - 1]}</span>
          <span style={at(k(170), k(172.6), small(.15))}>{time}</span>
        </div>
      ) : null}
      {data.venueAddress ? (
        <p style={at(145, 1153.8, {
          width: u(444), whiteSpace: 'normal', fontFamily: serif, fontWeight: 600, fontSize: u(36), lineHeight: u(40.8),
          letterSpacing: '.14em', color: pink,
        })}>{data.venueAddress}</p>
      ) : null}
      {heroText ? (
        <p style={at(72, 1562.5, { width: u(430), whiteSpace: 'normal', fontFamily: serif, fontWeight: 600, fontSize: u(37.2), lineHeight: u(45.6), color: pink })}>{heroText}</p>
      ) : null}
    </div>
  );
}
