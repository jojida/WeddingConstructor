'use client';
import { useEffect, useMemo, useRef } from 'react';
import type { InviteData } from './TemplatePreview';

interface Props {
  data: InviteData;
  apiBase: string;
  fullPage?: boolean;
  slug?: string;
}

/* Полная страница и превью рендерятся через iframe со статичным
   оригинальным сайтом (/invite/vadimdarya/index.html).
   Первичные данные передаются через URL-параметры (для SSR-страницы гостя),
   а живое редактирование — через postMessage (без перезагрузки iframe). */

function buildParams(data: InviteData, apiBase: string): string {
  const p = new URLSearchParams();
  p.set('apiBase', apiBase || '');
  if (data.groomName) p.set('groom', data.groomName);
  if (data.brideName) p.set('bride', data.brideName);
  if (data.weddingDate) p.set('date', data.weddingDate);
  if (data.weddingTime) p.set('time', data.weddingTime);
  if (data.venue) p.set('venue', data.venue);
  if (data.venueAddress) p.set('address', data.venueAddress);
  if (data.mapLink) p.set('map', data.mapLink);
  if (data.coverPhoto) p.set('cover', data.coverPhoto);
  if (data.inviteText) p.set('inviteText', data.inviteText);
  if (data.story) p.set('story', data.story);
  if (data.dressCode) p.set('dressCode', data.dressCode);
  if (data.dressCodePhoto) p.set('dressPhoto', data.dressCodePhoto);
  if (Array.isArray(data.schedule) && data.schedule.length) {
    p.set('schedule', JSON.stringify(data.schedule));
  }
  if (Array.isArray(data.dressCodeColors) && data.dressCodeColors.length) {
    p.set('colors', JSON.stringify(data.dressCodeColors));
  }
  return p.toString();
}

export default function VadimDaryaTemplate({ data, apiBase, fullPage, slug }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  // src вычисляется один раз — чтобы изменения данных не перезагружали iframe
  const initialSrc = useMemo(() => {
    const qs = buildParams(data, apiBase);
    return `/invite/vadimdarya/index.html?${qs}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const postData = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: 'wc:data',
        payload: {
          apiBase,
          groomName: dataRef.current.groomName,
          brideName: dataRef.current.brideName,
          weddingDate: dataRef.current.weddingDate,
          weddingTime: dataRef.current.weddingTime,
          venue: dataRef.current.venue,
          venueAddress: dataRef.current.venueAddress,
          mapLink: dataRef.current.mapLink,
          coverPhoto: dataRef.current.coverPhoto,
          inviteText: dataRef.current.inviteText,
          story: dataRef.current.story,
          dressCode: dataRef.current.dressCode,
          dressCodePhoto: dataRef.current.dressCodePhoto,
          schedule: dataRef.current.schedule,
          dressCodeColors: dataRef.current.dressCodeColors,
        },
      },
      '*'
    );
  };

  // Когда iframe сообщает о готовности — отправляем актуальные данные
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === 'wc:ready') postData();
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  // Живое обновление при изменении данных
  useEffect(() => {
    postData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, apiBase]);

  if (fullPage) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#0f0d09' }}>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
          title="Приглашение"
        />
      </div>
    );
  }

  // Превью (мини) — заполняет контейнер, мобильная верстка
  return (
    <iframe
      ref={iframeRef}
      src={initialSrc}
      scrolling="no"
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
        background: '#0f0d09',
        pointerEvents: 'none',
      }}
      title="Превью приглашения"
    />
  );
}
