'use client';
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { InviteData } from './TemplatePreview';
import { hasIntro } from '@/lib/plans';
import { SKETCH_DEMO_PHOTOS } from '@/lib/sketch-demo-photos';

interface Props {
  data: InviteData;
  apiBase: string;
  fullPage?: boolean;
  slug?: string;
  editing?: boolean;
}

/* Цвета плашек обложки (те же, что .polaroids[data-theme] в public/invite/sketch/styles.css):
   [пятно жениха, пятно невесты, плашка жениха, плашка невесты, текст на плашке жениха] */
const PLAQUE_COLORS: Record<string, readonly [string, string, string, string, string]> = {
  bright: ['#2f6bf0', '#ff5a4f', '#ff5d8f', '#8f4de0', '#fff'],
  sunset: ['#ff8a3d', '#7b4fe0', '#ffd23f', '#ff5d8f', '#1c1c1c'],
  mint:   ['#19c3a6', '#ffd23f', '#3f4fe0', '#ff5a4f', '#fff'],
  soft:   ['#a3b8e6', '#f6b3c8', '#e85d86', '#5b7ee0', '#fff'],
};

/* ─────────────────────────────────────────────────────────────
   Шаблон «Скетч» — рисованное приглашение
   Full-page / редактирование → iframe реального дизайна.
     Базовые данные передаются через URL (для SSR-страницы гостя),
     полные данные — через postMessage('wc:data') без перезагрузки iframe.
   Превью-миниатюра (грид/главная) → лёгкая карточка в стиле скетч.
───────────────────────────────────────────────────────────── */
export default function SketchTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  const live = !!(fullPage || editing);

  // src вычисляется один раз, чтобы изменения данных не перезагружали iframe
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
    return `/invite/sketch/index.html?${p.toString()}`;
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
          ...(d.customData || {}),       // тексты/фото, специфичные для шаблона
          enabledSections: d.enabledSections || {},
          apiBase,
          slug: slug || '',
          groomName: d.groomName,
          brideName: d.brideName,
          weddingDate: d.weddingDate,
          weddingTime: d.weddingTime,
          inviteText: d.inviteText,
          dressCodeColors: d.dressCodeColors,
          dressCodePhoto: d.dressCodePhoto,
          venue: d.venue,
          venueAddress: d.venueAddress,
          mapLink: d.mapLink,
          musicUrl: d.musicUrl,
          schedule: d.schedule,
        },
      },
      window.location.origin
    );
  };

  // iframe сообщает о готовности → шлём актуальные данные
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.origin !== window.location.origin || e.source !== iframeRef.current?.contentWindow) return; if (e.data && e.data.type === 'wc:ready') postData(); };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, slug]);

  // Живое обновление при изменении данных
  useEffect(() => {
    postData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, apiBase, slug]);

  if (live) {
    if (fullPage) {
      return (
        <div style={{ width: '100%', minHeight: '100vh', background: '#efe7ea' }}>
          <iframe
            ref={iframeRef}
            src={initialSrc}
            style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
            title="Приглашение «Скетч»"
          />
        </div>
      );
    }
    // Живое превью в макете телефона (редактор) — прокручивается внутри iframe
    return (
      <iframe
        ref={iframeRef}
        src={initialSrc}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#efe7ea' }}
        title="Превью «Скетч»"
      />
    );
  }

  /* ── Карточка-превью (точная копия обложки шаблона) ───────── */
  const ink   = '#1c1c1c';
  const pink  = '#e85d86';
  const titleFont = "'Caveat', cursive";
  const A = '/invite/sketch/assets';
  const groom = data?.groomName || 'Артем';
  const bride = data?.brideName || 'Екатерина';
  const theme = data?.customData?.plaqueTheme;
  const plaque = PLAQUE_COLORS[typeof theme === 'string' && theme in PLAQUE_COLORS ? theme : 'bright'];
  // Векторная форма как маска: цвет задаётся заливкой (так же, как в самом приглашении)
  const mask = (file: string): CSSProperties => ({
    WebkitMaskImage: `url(${A}/${file})`, maskImage: `url(${A}/${file})`,
    WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center', maskPosition: 'center',
  });

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: '#ffffff',
      padding: '28px 26px 14px',
      boxSizing: 'border-box',
      fontFamily: "'Alice', Georgia, serif",
    }}>
      {/* ── обложка (cover-head) ── */}
      <div style={{ position: 'relative', minHeight: 320 }}>
        {/* конфетти-брызги */}
        <img src={`${A}/confetti-yellow.svg`} alt=""
          style={{ position: 'absolute', top: -4, right: -14, width: 150, pointerEvents: 'none' }} />
        <img src={`${A}/confetti-blue.svg`} alt=""
          style={{ position: 'absolute', top: 26, left: '40%', width: 120, pointerEvents: 'none' }} />
        <img src={`${A}/confetti-yellow.svg`} alt=""
          style={{ position: 'absolute', top: 168, left: -16, width: 112, pointerEvents: 'none' }} />

        {/* бейдж «Наконец-то!» */}
        <div style={{ position: 'relative', display: 'inline-block', margin: '0 0 2px 2px' }}>
          <img src={`${A}/brush-pink.svg`} alt="" style={{ width: 196, height: 'auto', display: 'block' }} />
          <span style={{
            position: 'absolute', top: '46%', left: '52%',
            transform: 'translate(-50%, -50%) rotate(-5deg)',
            fontFamily: "'Caveat', cursive", fontWeight: 700, color: '#fff',
            fontSize: 23, whiteSpace: 'nowrap',
          }}>Наконец-то!</span>
        </div>

        {/* заголовок «МЫ женимся!» */}
        <h1 style={{
          fontFamily: titleFont, fontWeight: 400, color: ink,
          fontSize: 94, lineHeight: .82, textAlign: 'left',
          margin: 0, paddingLeft: 4, position: 'relative', zIndex: 2,
        }}>
          МЫ<span style={{ display: 'block', paddingLeft: 28 }}>женимся!</span>
        </h1>

        {/* пара розовых сердец справа */}
        <div style={{ position: 'absolute', right: 16, top: 58, width: 132, zIndex: 1 }}>
          <img src={`${A}/heart-pink.svg`} alt="" style={{ position: 'absolute', width: 86, right: 30, top: 0 }} />
          <img src={`${A}/heart-pink.svg`} alt="" style={{ position: 'absolute', width: 54, right: 0, top: 46 }} />
        </div>

        {/* имена справа с подчёркиванием */}
        <div style={{ textAlign: 'right', paddingRight: 22, marginTop: 6, position: 'relative', zIndex: 2 }}>
          <span style={{ display: 'inline-block', fontFamily: titleFont, fontSize: 34, color: ink, position: 'relative' }}>
            {groom} и {bride}
            <span style={{ display: 'block', height: 3, marginTop: 1, background: pink, borderRadius: 3, transform: 'rotate(-1deg)' }} />
          </span>
        </div>
      </div>

      {/* Вырезанные фото детей на цветных пятнах, подписи — мазки кисти */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        gap: 6, margin: '26px auto 4px', maxWidth: 400,
      }}>
        {([
          [SKETCH_DEMO_PHOTOS.groomPhoto.resultUrl, 'rotate(-5deg)', 0, 'l', plaque[0], plaque[2], plaque[4], 'Жених', -2],
          [SKETCH_DEMO_PHOTOS.bridePhoto.resultUrl, 'rotate(4deg)', 14, 'r', plaque[1], plaque[3], '#fff', 'Невеста', 1.6],
        ] as const).map(([photo, transform, marginTop, side, blob, plaquePaint, capColor, caption, capTilt]) => (
          <div key={photo} style={{ position: 'relative', width: '42%', aspectRatio: '148 / 201.5', transform, marginTop, containerType: 'inline-size' }}>
            <div aria-hidden style={{ position: 'absolute', left: '-4%', right: '-4%', top: '6%', bottom: '2%' }}>
              <span style={{ position: 'absolute', inset: 0, background: blob, ...mask(`plaque-blob-${side}.svg`) }} />
              <span style={{ position: 'absolute', inset: 0, background: ink, ...mask(`plaque-blob-${side}-line.svg`) }} />
            </div>
            <img src={photo} alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: '50% 100%', filter: 'drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff) drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff)' }} />
            <span style={{
              position: 'absolute', left: '50%', top: '92%', transform: `translate(-50%, -50%) rotate(${capTilt}deg)`,
              width: 'max-content', maxWidth: '106%', padding: '.26em .95em .34em',
              fontFamily: titleFont, fontWeight: 700, fontSize: '15cqw', lineHeight: 1, textAlign: 'center', color: capColor,
            }}>
              <span aria-hidden style={{ position: 'absolute', inset: 0, background: plaquePaint, ...mask(`plaque-brush-${side}.svg`) }} />
              <span style={{ position: 'relative' }}>{caption}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
