'use client';
import { useEffect, useMemo, useRef } from 'react';
import { InviteData } from './TemplatePreview';
import { studioTemplate } from '@/lib/studioTemplates';

interface Props {
  data: InviteData;
  apiBase: string;
  fullPage?: boolean;
  slug?: string;
  editing?: boolean;
}

/* ─────────────────────────────────────────────────────────
   Общая обёртка для шаблонов, собранных в «Верстаке».

   Все такие шаблоны устроены одинаково — iframe с URL-параметрами для гостя
   и postMessage('wc:data') для живого превью, — поэтому отдельный компонент
   на каждый шаблон не нужен: различия сводятся к слагу и цвету фона, а их
   студия кладёт в сгенерированный реестр.

   Карточка в каталоге — обложка, снятая при экспорте.
───────────────────────────────────────────────────────── */
export default function StudioTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Свежие данные нужны обработчику wc:ready, который живёт вне рендера.
  // Обновляем ссылку в эффекте, а не по ходу отрисовки.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  });

  const entry = studioTemplate(data.templateId);
  const background = entry?.background || '#ffffff';
  const title = entry?.name || 'Приглашение';

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
    return `/invite/${data.templateId}/index.html?${p.toString()}`;
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
          venueAddress: d.venueAddress,
          inviteText: d.inviteText,
          story: d.story,
          dressCodeColors: d.dressCodeColors,
          dressCodePhoto: d.dressCodePhoto,
          coverPhoto: d.coverPhoto,
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
        <div style={{ width: '100%', minHeight: '100vh', background }}>
          <iframe
            ref={iframeRef}
            src={initialSrc}
            style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
            title={`${title} — свадебное приглашение`}
            allow="autoplay"
          />
        </div>
      );
    }
    return (
      <iframe
        ref={iframeRef}
        src={initialSrc}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block', background }}
        title={`Превью «${title}»`}
        allow="autoplay"
      />
    );
  }

  /* ── Карточка каталога: обложка со снимка при экспорте ── */
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', background }}>
      {entry?.preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.preview}
          alt={title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }}
        />
      )}
    </div>
  );
}
