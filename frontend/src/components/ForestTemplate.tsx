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
   «Туманный лес» (макет Figma «Приглашение 1», вариант 30.09.2026) —
   гость и редактор → iframe реального дизайна. У гостя на обложке деревья
   расступаются и появляются имена; в редакторе (editing=1) сразу финал.
   Данные: URL-параметры + postMessage('wc:data') без перезагрузки iframe.
   Превью-карточка → обложка шаблона с живыми именами.
───────────────────────────────────────────────────────── */
export default function ForestTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
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
    return `/invite/forest/index.html?${p.toString()}`;
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
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#f7f2ed' }}
          title="Превью «Туманный лес»"
          allow="autoplay"
        />
      );
    }
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#d9dbd1' }}>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
          title="Туманный лес — свадебное приглашение"
          allow="autoplay"
        />
      </div>
    );
  }

  /* ── Карточка-превью: обложка (лес, деревья, цветы) с живыми именами.
     Размеры — в долях ширины макета (1366px), имена лесенкой, как в шаблоне. */
  const u = (n: number) => `calc(${n} * 100cqw / 1366)`;
  const groom = data.groomName || 'Антон';
  const bride = data.brideName || 'Мария';
  // длинные имена — мельче, чтобы строка не вылезала за карточку
  const longest = Math.max(groom.length, bride.length);
  const fs = longest > 7 ? Math.max(150, 248 * 7 / longest) : 248;
  const line = (top: number, x: number, size: number): CSSProperties => ({
    position: 'absolute', left: '50%', top: u(top), margin: 0, whiteSpace: 'nowrap',
    transform: `translateX(calc(-50% + ${u(x)}))`,
    fontFamily: "'Great Vibes', cursive", fontSize: u(size), lineHeight: 1, color: '#fff',
    textShadow: '0 1px 10px rgba(25,40,25,.55)',
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f7f2ed', containerType: 'inline-size' }}>
      <img src="/invite/forest/assets/preview.jpg?v=3" alt=""
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 'auto', display: 'block' }} />
      <p style={line(543 + (248 - fs) * 0.72, longest > 7 ? -40 : -97, fs)}>{groom}</p>
      <p style={line(823, -76, 129)}>и</p>
      <p style={line(941 + (248 - fs) * 0.72, longest > 7 ? 40 : 99, fs)}>{bride}</p>
    </div>
  );
}
