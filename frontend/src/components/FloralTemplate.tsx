'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { InviteData } from './TemplatePreview';
import WeddingEnvelope from './WeddingEnvelope';

interface Props {
  data: InviteData;
  apiBase: string;
  fullPage?: boolean;
  slug?: string;
  editing?: boolean;
}

/* ─────────────────────────────────────────────────────────────
   Full-page (гость) → конверт → iframe реального дизайна
   Editing (редактор) → iframe напрямую (без конверта)
   Данные: URL-параметры + postMessage('wc:data') без перезагрузки.
   Preview-миниатюра → карточка-миниатюра в стиле флорал.
───────────────────────────────────────────────────────────── */
export default function FloralTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const [revealed, setRevealed] = useState(false);

  const live = !!(fullPage || editing);

  const initialSrc = useMemo(() => {
    const p = new URLSearchParams();
    p.set('apiBase', apiBase || '');
    if (slug) p.set('slug', slug);
    if (data.groomName) p.set('groom', data.groomName);
    if (data.brideName) p.set('bride', data.brideName);
    if (data.weddingDate) p.set('date', data.weddingDate);
    if (data.weddingTime) p.set('time', data.weddingTime);
    return `/invite/floral/index.html?${p.toString()}`;
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
    // Редактор — iframe напрямую (живое превью, скролл внутри)
    if (editing) {
      return (
        <iframe
          ref={iframeRef}
          src={initialSrc}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#d5d0c8' }}
          title="Превью «Флоральный»"
        />
      );
    }
    // Гость — сначала конверт, затем приглашение
    if (!revealed) {
      const brideInitial = (data.brideName || 'Olivia').trim().charAt(0).toUpperCase();
      const groomInitial = (data.groomName || 'Sebastian').trim().charAt(0).toUpperCase();
      return (
        <WeddingEnvelope
          onOpen={() => setRevealed(true)}
          brideInitial={brideInitial}
          groomInitial={groomInitial}
        />
      );
    }
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#d5d0c8' }}>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
          title="Флоральное приглашение"
        />
      </div>
    );
  }

  /* ── Карточка-превью ──────────────────────────────────── */
  const bg   = '#d5d0c8';
  const sec  = '#a29b88';
  const text = '#3d3d3d';
  const gold = '#947f57';

  const cover = data.coverPhoto || '/invite/floral/assets/photos/couple1.jpg';

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: bg,
      fontFamily: "'Cormorant Garamond', Georgia, serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>

      {/* Угловые ветки */}
      <img src="/invite/floral/assets/decor/branch_corner.png" alt=""
        style={{ position:'absolute', top:0, left:0, width:'35%', pointerEvents:'none', zIndex:5, transform:'scaleX(-1)' }} />
      <img src="/invite/floral/assets/decor/branch_corner.png" alt=""
        style={{ position:'absolute', top:0, right:0, width:'35%', pointerEvents:'none', zIndex:5 }} />

      {/* Фото в арке */}
      <div style={{
        position: 'relative',
        width: '55%',
        marginTop: '18%',
        zIndex: 3,
        aspectRatio: '572.25 / 900',
      }}>
        {/* Фото с SVG clip-path — гладкая арка */}
        <svg viewBox="0 0 572.25 900" preserveAspectRatio="none"
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:1 }}>
          <defs>
            <clipPath id="floral-arch-preview">
              <path d="M 15.675781 883.371094 L 15.675781 280.964844 C 17.082031 169.953125 89.511719 69.601562 195.90625 31.277344 C 196.367188 31.148438 197.132812 30.929688 198.042969 30.558594 C 226.234375 21.089844 255.730469 16.265625 285.582031 16.265625 L 285.890625 16.265625 C 315.757812 16.265625 345.242188 21.089844 373.433594 30.558594 C 374.34375 30.929688 375.109375 31.148438 375.570312 31.277344 C 481.960938 69.589844 554.378906 169.941406 555.800781 280.964844 L 555.800781 883.371094 Z"/>
            </clipPath>
          </defs>
          <image href={cover} x="0" y="0" width="572.25" height="900"
            preserveAspectRatio="xMidYMin slice"
            clipPath="url(#floral-arch-preview)"/>
        </svg>
        {/* Золотая рамка поверх */}
        <svg viewBox="0 0 572.25 900" preserveAspectRatio="none"
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:3, pointerEvents:'none' }}>
          <path d="M 15.675781 883.371094 L 15.675781 280.964844 C 17.082031 169.953125 89.511719 69.601562 195.90625 31.277344 C 196.367188 31.148438 197.132812 30.929688 198.042969 30.558594 C 226.234375 21.089844 255.730469 16.265625 285.582031 16.265625 L 285.890625 16.265625 C 315.757812 16.265625 345.242188 21.089844 373.433594 30.558594 C 374.34375 30.929688 375.109375 31.148438 375.570312 31.277344 C 481.960938 69.589844 554.378906 169.941406 555.800781 280.964844 L 555.800781 883.371094 Z"
            fill="none" stroke={gold} strokeWidth="5"/>
        </svg>
        {/* Букет TL */}
        <img src="/invite/floral/assets/decor/bouquet_color.png" alt=""
          style={{ position:'absolute', width:'55%', left:'-14%', top:'-4%', zIndex:5, pointerEvents:'none' }} />
        {/* Букет BR */}
        <img src="/invite/floral/assets/decor/bouquet_color.png" alt=""
          style={{ position:'absolute', width:'58%', right:'-18%', bottom:'-8%', zIndex:5, transform:'scale(-1,-1)', pointerEvents:'none' }} />
      </div>

      {/* Имена */}
      <div style={{ position:'relative', zIndex:4, textAlign:'center', marginTop:'8%', padding:'0 8%' }}>
        <p style={{ fontFamily:"var(--font-raleway,'Raleway',sans-serif)", fontSize:'6px', fontWeight:300, letterSpacing:'0.38em', color: text, marginBottom:'2px' }}>
          THE WEDDING OF
        </p>
        <h2 style={{ fontFamily:"var(--font-great-vibes,'Great Vibes',cursive)", fontSize:'22px', fontWeight:400, color: text, lineHeight:1.1, margin:0 }}>
          {data.brideName || 'Olivia'} &amp; {data.groomName || 'Sebastian'}
        </h2>
        <p style={{ fontFamily:"var(--font-raleway,'Raleway',sans-serif)", fontSize:'6px', fontWeight:300, letterSpacing:'0.5em', color: text, marginTop:'3px' }}>
          ПРИГЛАШЕНИЕ
        </p>
      </div>

    </div>
  );
}
