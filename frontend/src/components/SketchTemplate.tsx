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
   Шаблон «Скетч» — рисованное приглашение
   Full-page / редактирование → iframe реального дизайна.
     Базовые данные передаются через URL (для SSR-страницы гостя),
     полные данные — через postMessage('wc:data') без перезагрузки iframe.
   Превью-миниатюра (грид/главная) → лёгкая карточка в стиле скетч.
───────────────────────────────────────────────────────────── */
export default function SketchTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const live = !!(fullPage || editing);

  // src вычисляется один раз, чтобы изменения данных не перезагружали iframe
  const initialSrc = useMemo(() => {
    const p = new URLSearchParams();
    p.set('apiBase', apiBase || '');
    if (slug) p.set('slug', slug);
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
          apiBase,
          slug: slug || '',
          groomName: d.groomName,
          brideName: d.brideName,
          weddingDate: d.weddingDate,
          weddingTime: d.weddingTime,
          inviteText: d.inviteText,
          dressCodeColors: d.dressCodeColors,
          dressCodePhoto: d.dressCodePhoto,
          schedule: d.schedule,
        },
      },
      '*'
    );
  };

  // iframe сообщает о готовности → шлём актуальные данные
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.data && e.data.type === 'wc:ready') postData(); };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  // Живое обновление при изменении данных
  useEffect(() => {
    postData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, apiBase]);

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
  const titleFont = "'HitchHike', 'Caveat', cursive";
  const A = '/invite/sketch/assets';
  const groom = data?.groomName || 'Артем';
  const bride = data?.brideName || 'Екатерина';

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: '#ffffff',
      padding: '28px 26px 14px',
      boxSizing: 'border-box',
      fontFamily: "'Anaktoria', Georgia, serif",
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

      {/* полароиды */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        gap: 6, margin: '26px auto 4px', maxWidth: 400,
      }}>
        <img src={`${A}/polaroid-groom.png`} alt=""
          style={{ width: '49%', transform: 'rotate(-5deg)' }} />
        <img src={`${A}/polaroid-bride.png`} alt=""
          style={{ width: '49%', transform: 'rotate(4deg)', marginTop: 14 }} />
      </div>
    </div>
  );
}
