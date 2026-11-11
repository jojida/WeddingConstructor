'use client';
import { useEffect, useMemo, useRef } from 'react';
import { InviteData } from './TemplatePreview';
import { hasIntro } from '@/lib/plans';

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
          enabledSections: d.enabledSections || {},
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
      window.location.origin
    );
  };

  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.origin !== window.location.origin || e.source !== iframeRef.current?.contentWindow) return; if (e.data && e.data.type === 'wc:ready') postData(); };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, slug]);

  useEffect(() => {
    postData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, apiBase, slug]);

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

  /* ── Карточка-превью: обложка шаблона (public/invite/calla, раздел 1) ──
     Размеры — в долях ширины карточки (cqw), как в styles.css шаблона:
     имена 19cqw, «&» 13cqw, дата 6.4cqw, каллы 66 % ширины. Раньше имена были
     в vw с потолком 46px — вдвое мельче шаблона, и даты не было.
     Стебель калл всегда доходит до низа карточки: в вытянутом экране
     телефона (TemplateShowcase) цветок вырастает по высоте, а не обрывается. */
  const bride = data.brideName || 'Дарья';
  const groom = data.groomName || 'Вадим';
  // Длинные имена — мельче (~0,6 кегля на букву Marck Script, строка не
  // шире 66 % карточки), обычные — 19cqw, как в шаблоне
  const nameSize = Math.min(19, 66 / (Math.max(bride.length, groom.length, 1) * 0.6));
  const [yy, mm, dd] = (data.weddingDate || '').split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = yy && mm && dd ? `${pad(dd)} | ${pad(mm)} | ${yy}` : '';
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', overflow: 'hidden', containerType: 'inline-size',
      background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,.25), transparent 60%), #d7d3cb',
    }}>
      <img
        src="/invite/calla/assets/pearls-string.svg"
        alt=""
        style={{ position: 'absolute', top: '-15.6cqw', left: '-4%', width: '42%', pointerEvents: 'none' }}
      />
      {/* 603×1600: высота 66 % ширины = 175cqw; если карточка выше — по её высоте */}
      <img
        src="/invite/calla/assets/callas-pair.webp"
        alt="Каллы"
        style={{ position: 'absolute', top: '1%', right: '-6%', height: 'max(99%, 175.1cqw)', width: 'auto', pointerEvents: 'none' }}
      />
      <img
        src="/invite/calla/assets/pearls-string.svg"
        alt=""
        style={{ position: 'absolute', bottom: '4%', right: '6%', width: '42%', transform: 'scaleX(-1) rotate(8deg)', pointerEvents: 'none' }}
      />
      <div style={{
        position: 'absolute', left: '9%', top: '26%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        color: '#f8f6f1', textShadow: '0 1px 4px rgba(120,112,98,.4)', whiteSpace: 'nowrap',
      }}>
        <span style={{ fontFamily: "'Marck Script', cursive", fontSize: `${nameSize}cqw`, lineHeight: .95 }}>{bride}</span>
        <span style={{ fontFamily: "'Pinyon Script', cursive", fontSize: '13cqw', margin: '1cqw 0' }}>&amp;</span>
        <span style={{ fontFamily: "'Marck Script', cursive", fontSize: `${nameSize}cqw`, lineHeight: .95 }}>{groom}</span>
        {date && (
          <span style={{ marginTop: '5cqw', fontFamily: "'Cormorant Garamond', serif", fontSize: '6.4cqw', letterSpacing: '1.2cqw' }}>{date}</span>
        )}
      </div>
    </div>
  );
}
