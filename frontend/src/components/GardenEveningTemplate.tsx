'use client';
import { useEffect, useMemo, useRef } from 'react';
import { InviteData } from './TemplatePreview';

interface Props {
  data: InviteData;
  apiBase: string;
  fullPage?: boolean;
  slug?: string;
  editing?: boolean;
}

/* ─────────────────────────────────────────────────────────
   «Вечер в саду» (макет Figma «Приглашение 1») — гость и редактор →
   iframe реального дизайна. У гостя первым экраном видео раскрытия
   конверта, в редакторе (editing=1) конверта нет. Данные: URL-параметры +
   postMessage('wc:data') без перезагрузки iframe.
   Превью-карточка → обложка шаблона с живыми именами.
───────────────────────────────────────────────────────── */
export default function GardenEveningTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
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
    return `/invite/garden-evening/index.html?${p.toString()}`;
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
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#f7f0e0' }}
          title="Превью «Вечер в саду»"
          allow="autoplay"
        />
      );
    }
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#e9dfc8' }}>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
          title="Вечер в саду — свадебное приглашение"
          allow="autoplay"
        />
      </div>
    );
  }

  /* ── Карточка-превью: обложка (сад, гирлянды, пара) с живыми именами.
     Размеры — в долях ширины макета (1366px). Обложка выше карточки,
     поэтому картинка прижата к верху, а надпись и имена стоят над парой. */
  const u = (n: number) => `calc(${n} * 100cqw / 1366)`;
  const groom = data.groomName || 'Даниил';
  const bride = data.brideName || 'Ольга';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f7f0e0', containerType: 'inline-size' }}>
      <img src="/invite/garden-evening/assets/preview.jpg" alt=""
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 'auto', display: 'block' }} />
      <p style={{
        position: 'absolute', left: 0, right: 0, top: u(532), margin: 0, textAlign: 'center',
        fontFamily: "'Montserrat', 'Open Sans', sans-serif", fontWeight: 400, fontSize: u(66),
        color: 'rgba(255,255,255,.92)', textShadow: '0 0 8px rgba(120,80,40,.3)',
      }}>приглашение на свадьбу</p>
      <p style={{
        position: 'absolute', left: 0, right: 0, top: u(690), margin: 0, textAlign: 'center', whiteSpace: 'nowrap',
        fontFamily: "'Great Vibes', cursive", fontSize: u(159), lineHeight: 1.25, color: '#fff',
        textShadow: '0 0 10px rgba(110,70,30,.25)',
      }}>{groom} &amp; {bride}</p>
    </div>
  );
}
