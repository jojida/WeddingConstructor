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
   «Ангелы» (макет Figma «Приглашение 1», фрейм «Ан 1», 03.10.2026) —
   гость и редактор → iframe реального дизайна. У гостя на обложке облака
   поднимаются, прилетает Купидон и на ленте пишутся имена; в редакторе
   (editing=1) сразу финал. Данные: URL-параметры + postMessage('wc:data')
   без перезагрузки iframe.
   Превью-карточка → обложка шаблона с живыми именами на ленте.
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
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#ddf3ff' }}
          title="Превью «Ангелы»"
          allow="autoplay"
        />
      );
    }
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#c9e3f3' }}>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
          title="Ангелы — свадебное приглашение"
          allow="autoplay"
        />
      </div>
    );
  }

  /* ── Карточка-превью: обложка (фото пары, облака, Купидон, лента) с живыми
     именами на ленте. Картинка — обложка с 450-й единицы макета (1366px),
     поэтому центр надписи — (749; 1993 − 450). Длинные имена — мельче:
     на прямом участке ленты помещается ~15 знаков кеглем 131. */
  const u = (n: number) => `calc(${n} * 100cqw / 1366)`;
  const groom = data.groomName || 'Алексей';
  const bride = data.brideName || 'Ангелина';
  const text = `${groom} и ${bride}`;
  const fs = Math.min(131, (131 * 15.5) / Math.max(text.length, 1));

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#ddf3ff', containerType: 'inline-size' }}>
      <img src="/invite/angels/assets/preview.jpg" alt=""
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 'auto', display: 'block' }} />
      <p style={{
        position: 'absolute', left: u(749), top: u(1543), margin: 0, whiteSpace: 'nowrap',
        transform: 'translate(-50%, -50%) rotate(-6.04deg)',
        fontFamily: "'Great Vibes', cursive", fontSize: u(fs), lineHeight: 1.2, color: '#526c9f',
      }}>{text}</p>
    </div>
  );
}
