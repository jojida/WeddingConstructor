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

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

/* ─────────────────────────────────────────────────────────
   «Нежность» (Canva-макет «Beige Watercolor Illustrated Wedding
   Invitation», 05.10.2026) — гость и редактор → iframe реального дизайна.
   У гостя на обложке поднимается арка, распускаются цветы и пишутся имена;
   в редакторе (editing=1) сразу финал. Данные: URL-параметры +
   postMessage('wc:data') без перезагрузки iframe.
   Превью-карточка → обложка шаблона с живыми именами, датой и таймером.
───────────────────────────────────────────────────────── */
export default function TendernessTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
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
    return `/invite/tenderness/index.html?${p.toString()}`;
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

  // Таймер карточки считается после монтирования: на сервере «сейчас» другое
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { if (!live) setNow(Date.now()); }, [live]);

  if (live) {
    if (editing) {
      return (
        <iframe
          ref={iframeRef}
          src={initialSrc}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#f4f0ed' }}
          title="Превью «Нежность»"
          allow="autoplay"
        />
      );
    }
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#e7ddd3' }}>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
          title="Нежность — свадебное приглашение"
          allow="autoplay"
        />
      </div>
    );
  }

  /* ── Карточка-превью: обложка (мрамор, арка, цветы, пара) — картинка без
     текста, поверх неё имена, дата и таймер по координатам макета (1366px). */
  const u = (n: number) => `calc(${n} * 100cqw / 1366)`;
  const ink = '#6b4f2f';
  const groom = data.groomName || 'Евгений';
  const bride = data.brideName || 'Надежда';
  // имя шире арки (≈1040 единиц) — мельче; ~0,5 кегля на букву
  const longest = Math.max(groom.length, bride.length, 1);
  const fs = Math.min(229, 1040 / (longest * 0.5));
  const name = (baseline: number, x: number, size: number): CSSProperties => ({
    position: 'absolute', left: '50%', top: u(baseline - 0.725 * size), margin: 0, whiteSpace: 'nowrap',
    transform: `translateX(calc(-50% + ${u(x)}))`,
    fontFamily: "'Great Vibes', cursive", fontSize: u(size), lineHeight: 1, color: ink,
  });

  const [y, m, d] = (data.weddingDate || '').split('-').map(Number);
  const time = /^\d{1,2}:\d{2}/.test(data.weddingTime || '') ? data.weddingTime.slice(0, 5).padStart(5, '0') : '15:00';
  const box = (left: number, width: number, size: number, pb: number, line: boolean): CSSProperties => ({
    position: 'absolute', left: u(left), top: 0, width: u(width), height: u(100),
    display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', paddingBottom: u(pb),
    borderTop: line ? `${u(5)} solid ${ink}` : undefined, borderBottom: line ? `${u(5)} solid ${ink}` : undefined,
    fontSize: u(size), lineHeight: 1, textTransform: 'uppercase', whiteSpace: 'nowrap',
  });

  // Дни/часы/минуты/секунды до свадьбы (как в шаблоне, с русскими окончаниями)
  const plural = (n: number, forms: [string, string, string]) => {
    const a = n % 100, b = n % 10;
    return forms[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b > 1 && b < 5 ? 1 : 2];
  };
  let cd: { n: number; l: string }[] | null = null;
  if (now !== null && y && m && d) {
    const [hh, mm] = time.split(':').map(Number);
    const left = Math.max(0, new Date(y, m - 1, d, hh, mm).getTime() - now);
    const dd = Math.floor(left / 86400000), h = Math.floor(left / 3600000) % 24;
    const mi = Math.floor(left / 60000) % 60, s = Math.floor(left / 1000) % 60;
    cd = [
      { n: dd, l: plural(dd, ['день', 'дня', 'дней']) },
      { n: h, l: plural(h, ['час', 'часа', 'часов']) },
      { n: mi, l: plural(mi, ['минута', 'минуты', 'минут']) },
      { n: s, l: plural(s, ['секунда', 'секунды', 'секунд']) },
    ];
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f4f0ed', containerType: 'inline-size' }}>
      <img src="/invite/tenderness/assets/preview.webp" alt=""
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 'auto', display: 'block' }} />
      <p style={name(656.9, -4, fs)}>{groom}</p>
      <p style={name(816.5, 17, 199)}>&amp;</p>
      <p style={name(991.3, 11, fs)}>{bride}</p>
      {y && m && d ? (
        <div style={{ position: 'absolute', left: u(464), top: u(1148), width: u(736), height: u(100), fontFamily: "'Alice', serif", color: ink }}>
          <span style={box(0, 234, 47.5, 0, true)}>{MONTHS[m - 1]}</span>
          <span style={box(234, 268, 140, 28, false)}>{d}</span>
          <span style={box(502, 234, 53, 6, true)}>{time}</span>
        </div>
      ) : null}
      {cd ? (
        <div style={{ position: 'absolute', left: u(476), top: u(1303), width: u(752), display: 'flex', fontFamily: "'Alice', serif", color: ink }}>
          {cd.map((c, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: u(73.5), lineHeight: 1.1 }}>{c.n}</span>
              <span style={{ marginTop: u(18.5), fontSize: u(33.3), lineHeight: 1.2, textTransform: 'uppercase' }}>{c.l}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
