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
   «Каллы» — full-page / editing → iframe реального дизайна.
   URL-параметры (страница гостя) + postMessage('wc:data') (живое превью).
   Preview/card → лёгкая миниатюра с именами поверх паперного фона.
───────────────────────────────────────────────────────── */
export default function CallaTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

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
    return `/invite/calla/index.html?${p.toString()}`;
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
          venue: d.venue,
          inviteText: d.inviteText,
          story: d.story,
          dressCodeColors: d.dressCodeColors,
          dressCodePhoto: d.dressCodePhoto,
          venueAddress: d.venueAddress,
          mapLink: d.mapLink,
          musicUrl: d.musicUrl,
          schedule: d.schedule,
        },
      },
      '*'
    );
  };

  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.data && e.data.type === 'wc:ready') postData(); };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  useEffect(() => {
    postData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, apiBase]);

  if (live) {
    if (fullPage) {
      return (
        <div style={{ width: '100%', minHeight: '100vh', background: '#d7d3cb' }}>
          <iframe
            ref={iframeRef}
            src={initialSrc}
            style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
            title="Каллы — свадебное приглашение"
            allow="autoplay"
          />
        </div>
      );
    }
    return (
      <iframe
        ref={iframeRef}
        src={initialSrc}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#d7d3cb' }}
        title="Превью «Каллы»"
        allow="autoplay"
      />
    );
  }

  /* ── Preview card thumbnail ── */
  const bride = data.brideName || 'Дарья';
  const groom = data.groomName || 'Вадим';
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
      background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,.25), transparent 60%), #d7d3cb',
    }}>
      <img
        src="/invite/calla/assets/callas-pair.svg"
        alt="Каллы"
        style={{ position: 'absolute', top: '2%', right: '-6%', width: '64%', opacity: .96, pointerEvents: 'none' }}
      />
      <img
        src="/invite/calla/assets/pearls-string.svg"
        alt=""
        style={{ position: 'absolute', top: 0, left: '-6%', width: '48%', pointerEvents: 'none' }}
      />
      <div style={{
        position: 'absolute', left: '8%', top: '34%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        color: '#f8f6f1', textShadow: '0 1px 4px rgba(120,112,98,.4)',
      }}>
        <span style={{ fontFamily: "'Marck Script', cursive", fontSize: 'clamp(20px, 11vw, 46px)', lineHeight: .95 }}>{bride}</span>
        <span style={{ fontFamily: "'Pinyon Script', cursive", fontSize: 'clamp(14px, 7vw, 30px)', margin: '2px 0' }}>&amp;</span>
        <span style={{ fontFamily: "'Marck Script', cursive", fontSize: 'clamp(20px, 11vw, 46px)', lineHeight: .95 }}>{groom}</span>
      </div>
    </div>
  );
}
