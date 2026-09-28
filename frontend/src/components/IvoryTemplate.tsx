'use client';
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { InviteData } from './TemplatePreview';

interface Props {
  data: InviteData;
  apiBase: string;
  fullPage?: boolean;
  slug?: string;
  editing?: boolean;
}

/* ─────────────────────────────────────────────────────────
   «Айвори» (макет Figma «Приглашение») — гость и редактор → iframe
   реального дизайна. У гостя первым экраном видео раскрытия конверта,
   в редакторе (editing=1) конверта нет. Данные: URL-параметры +
   postMessage('wc:data') без перезагрузки iframe.
   Превью-карточка → лёгкая копия обложки.
───────────────────────────────────────────────────────── */
export default function IvoryTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

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
    return `/invite/ivory/index.html?${p.toString()}`;
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
          coverPhoto: d.coverPhoto,
          inviteText: d.inviteText,
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
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#000' }}
          title="Превью «Айвори»"
          allow="autoplay"
        />
      );
    }
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#151515' }}>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
          title="Айвори — свадебное приглашение"
          allow="autoplay"
        />
      </div>
    );
  }

  /* ── Карточка-превью: обложка шаблона ──────────────────────────
     Размеры — в долях ширины макета (411px), а высоты — в процентах
     карточки: обложка выше карточки, поэтому композицию (надпись, имена,
     дата) сжимаем по вертикали, чтобы в карточке была видна целиком. */
  const u = (n: number) => `calc(${n} * 100cqw / 411)`;
  const y = (n: number) => `${(n / 874 * 100).toFixed(2)}%`;
  const groom = data.groomName || 'Вадим';
  const bride = data.brideName || 'Дарья';
  const cover = !data.coverPhoto ? '/invite/ivory/assets/couple.jpg'
    : data.coverPhoto.startsWith('/uploads') ? `${apiBase}${data.coverPhoto}` : data.coverPhoto;
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  let day = '18', month = 'июля', year = '2026';
  if (data.weddingDate) {
    const [yy, mm, dd] = data.weddingDate.split('-').map(Number);
    if (yy && mm && dd) { day = String(dd); month = MONTHS[mm - 1]; year = String(yy); }
  }
  const name: CSSProperties = {
    position: 'absolute', fontFamily: "'Caslon Becker', 'Cormorant Garamond', Georgia, serif",
    fontStyle: 'italic', fontSize: u(64), lineHeight: 'normal', color: '#fff', whiteSpace: 'nowrap', zIndex: 3,
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000', containerType: 'inline-size' }}>
      <img src={cover} alt=""
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: y(765), objectFit: 'cover', objectPosition: '52.6% 20%' }} />
      <span style={{
        position: 'absolute', left: u(128), top: `calc(${y(383)} - ${u(40)})`, zIndex: 1, fontFamily: "'Script Thin Pen', 'Pinyon Script', cursive",
        fontSize: u(200), lineHeight: 'normal', color: 'rgba(255,255,255,.77)',
      }}>&amp;</span>
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'linear-gradient(176deg, rgba(102,102,102,0) 31.6%, rgba(0,0,0,.68) 82.5%)' }} />
      <p style={{
        position: 'absolute', left: 0, right: 0, top: y(63), margin: 0, zIndex: 3, textAlign: 'center',
        fontFamily: "'Cormorant Garamond', Georgia, serif", fontVariant: 'small-caps', fontSize: u(22), color: '#fff',
      }}>Приглашение на свадьбу</p>
      <span style={{ ...name, left: u(41), top: `calc(${y(473)} - ${u(30)})` }}>{groom}</span>
      <span style={{ ...name, left: u(199), top: `calc(${y(582)} - ${u(24)})` }}>{bride}</span>
      <p style={{
        position: 'absolute', left: 0, right: 0, top: `calc(${y(772)} - ${u(10)})`, margin: 0, zIndex: 3,
        display: 'flex', justifyContent: 'center', gap: u(40),
        fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: u(32), color: '#fff', textTransform: 'uppercase',
      }}>
        <span>{day}</span><span>{month}</span><span>{year}</span>
      </p>
    </div>
  );
}
