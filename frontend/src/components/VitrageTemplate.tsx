'use client';
import { CSSProperties, useEffect, useMemo, useRef } from 'react';
import { InviteData } from './TemplatePreview';

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
   Превью-карточка → витражная арка с живыми именами (HamiltoneSHA).
───────────────────────────────────────────────────────── */
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

  /* ── Карточка-превью: витражная арка («Свадьба», «&» и приглашение — в
     картинке), имена — живые, по базовым линиям макета (1366px).
     HamiltoneSHA: ~0,42 кегля на букву, в арку помещается ≈960 единиц. */
  const u = (n: number) => `calc(${n} * 100cqw / 1366)`;
  const groom = data.groomName || 'Григорий';
  const bride = data.brideName || 'Александра';
  const longest = Math.max(groom.length, bride.length, 1);
  const fs = Math.min(155, 960 / (longest * 0.42));
  const name = (baseline: number, x: number): CSSProperties => ({
    position: 'absolute', left: '50%', top: u(baseline - 0.612 * fs), margin: 0, whiteSpace: 'nowrap',
    transform: `translateX(calc(-50% + ${u(x)}))`,
    fontFamily: "'HamiltoneSHA', 'Great Vibes', cursive", fontSize: u(fs), lineHeight: 1, color: '#556f95',
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f0f7ff', containerType: 'inline-size' }}>
      <style>{"@font-face{font-family:'HamiltoneSHA';src:url('/invite/assets/fonts/HamiltoneSHA.woff2') format('woff2');font-display:swap}"}</style>
      <img src="/invite/vitrage/assets/preview.jpg" alt=""
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 'auto', display: 'block' }} />
      <p style={name(1080, -30)}>{groom}</p>
      <p style={name(1445.3, 18)}>{bride}</p>
    </div>
  );
}
