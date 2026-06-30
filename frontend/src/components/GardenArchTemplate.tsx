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

/* ─────────────────────────────────────────────────────────────
   «Цветущая арка» — Blue/White/Green Garden Arch
   Гость и редактор → iframe реального дизайна (без конверта —
   у шаблона своя интерактивная анимация смахивания цветов).
   Данные: URL-параметры + postMessage('wc:data') без перезагрузки.
   Preview-миниатюра → лёгкая карточка в стиле шаблона.
───────────────────────────────────────────────────────────── */
export default function GardenArchTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
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
    return `/invite/garden-arch/index.html?${p.toString()}`;
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
          story: d.story,
          dressCodeColors: d.dressCodeColors,
          dressCodePhoto: d.dressCodePhoto,
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
    if (editing) {
      return (
        <iframe
          ref={iframeRef}
          src={initialSrc}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#ffffff' }}
          title="Превью «Цветущая арка»"
        />
      );
    }
    // Гость — сразу приглашение (без конверта)
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#ffffff' }}>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
          title="Приглашение «Цветущая арка»"
        />
      </div>
    );
  }

  /* ── Карточка-превью ──────────────────────────────────────────────
     Один в один с первым экраном (обложка живого шаблона):
     cover_full.png + мягкая маска поверх запечённых имён + живые имена.
     Размеры заданы в cqw (доля ширины карточки) — как vw в самом шаблоне,
     поэтому пропорции совпадают на любой ширине карточки. */
  const ink  = '#4b4f44';
  const gold = '#b89a6a';
  const soft = '#74786a';

  const groom = data.groomName || 'Елис';
  const bride = data.brideName || 'Маргарита';
  let dateStr = '15 · 08 · 2026';
  if (data.weddingDate) {
    const [y, m, d] = data.weddingDate.split('-');
    if (y && m && d) dateStr = `${d} · ${m} · ${y}`;
  }

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
      background: '#ffffff', containerType: 'inline-size',
      fontFamily: "'Cormorant Garamond', Georgia, serif",
    }}>
      <div style={{ position: 'relative', width: '100%' }}>
        <img src="/invite/garden-arch/assets/decor/arch.svg" alt=""
          style={{ position: 'relative', zIndex: 1, width: '100%', display: 'block', aspectRatio: '1038 / 1351' }} />

        {/* Шатёр (беседка) и пара — слоями в проёме арки */}
        <img src="/invite/garden-arch/assets/decor/gazebo.png" alt=""
          style={{ position: 'absolute', zIndex: 2, left: '50%', bottom: '20%', transform: 'translateX(-50%)', width: '60%', height: 'auto', pointerEvents: 'none' }} />
        <img src="/invite/garden-arch/assets/decor/couple_walk.png" alt=""
          style={{ position: 'absolute', zIndex: 3, left: '50%', bottom: '14%', transform: 'translateX(-50%)', width: '30%', height: 'auto', pointerEvents: 'none' }} />

        <div style={{ position: 'absolute', zIndex: 4, left: 0, right: 0, top: '21%', textAlign: 'center', padding: '0 20%' }}>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 600,
            color: ink, lineHeight: 0.96, display: 'flex', flexDirection: 'column', alignItems: 'center',
            margin: 0, textShadow: '0 0 14px #fff, 0 0 26px #fff, 0 0 40px #fff',
          }}>
            <span style={{ fontSize: 'clamp(20px, 12.5cqw, 66px)' }}>{groom}</span>
            <span style={{ fontSize: 'clamp(11px, 6.5cqw, 34px)', color: gold, margin: '-3px 0' }}>&amp;</span>
            <span style={{ fontSize: 'clamp(20px, 12.5cqw, 66px)' }}>{bride}</span>
          </h1>
          <p style={{
            fontFamily: "'Montserrat', sans-serif", fontSize: 'clamp(7px, 2.6cqw, 12px)',
            fontWeight: 400, letterSpacing: '0.28em', color: soft, marginTop: '12px',
            textShadow: '0 0 12px #fff, 0 0 22px #fff',
          }}>
            {dateStr}
          </p>
        </div>
      </div>
    </div>
  );
}
