'use client';
import { useEffect, useMemo, useRef } from 'react';
import type { InviteData } from './TemplatePreview';
import { hasIntro } from '@/lib/plans';

interface Props {
  data: InviteData;
  apiBase: string;
  fullPage?: boolean;
  slug?: string;
  editing?: boolean;
}

/* Полная страница и превью рендерятся через iframe со статичным
   оригинальным сайтом (/invite/vadimdarya/index.html).
   Первичные данные передаются через URL-параметры (для SSR-страницы гостя),
   а живое редактирование — через postMessage (без перезагрузки iframe). */

function buildParams(data: InviteData, apiBase: string, editing?: boolean): string {
  const p = new URLSearchParams();
  p.set('apiBase', apiBase || '');
  if (editing) p.set('editing', '1');
  if (!hasIntro(data.plan)) p.set('intro', '0');   // анимация открытия — платная
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

export default function VadimDaryaTemplate({ data, apiBase, fullPage, slug, editing }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  // src вычисляется один раз — чтобы изменения данных не перезагружали iframe
  const initialSrc = useMemo(() => {
    const qs = buildParams(data, apiBase, editing);
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
          plan: dataRef.current.plan,
          // Показывать ли подпись «Создано на WeddingCraft» и водяной знак (считает TemplatePreview) — модуль ../assets/brand.js
          wcBrand: dataRef.current.customData?.wcBrand,
          wcWatermark: dataRef.current.customData?.wcWatermark,
          enabledSections: dataRef.current.enabledSections || {},
          apiBase,
          // Адрес сайта — куда слать анкету; без него (превью, демо) она не уходит
          slug: slug || '',
          // Персональная ссылка ?g=: гость и его имя (кладёт страница сайта в customData)
          guestToken: dataRef.current.customData?.guestToken,
          guestName: dataRef.current.customData?.guestName,
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
          musicUrl: dataRef.current.musicUrl,
          schedule: dataRef.current.schedule,
          dressCodeColors: dataRef.current.dressCodeColors,
          // Кадрирование фото, галочка «Показывать карту» и координаты адреса
          // (у остальных мостов приходят в ...customData)
          photoFrames: dataRef.current.customData?.photoFrames,
          showMap: dataRef.current.customData?.showMap,
          mapPoint: dataRef.current.customData?.mapPoint,
          // Настройки анкеты — их читает общий модуль ../assets/rsvp-count.js
          rsvpMaybe: dataRef.current.customData?.rsvpMaybe,
          rsvpChildren: dataRef.current.customData?.rsvpChildren,
          rsvpQuestions: dataRef.current.customData?.rsvpQuestions,
          rsvpCustomQ: dataRef.current.customData?.rsvpCustomQ,
          // Выбор блюд и пищевые ограничения у каждого гостя (кладёт сервер, если пара включила)
          wcMenu: dataRef.current.customData?.wcMenu,
          // Напоминание перед свадьбой — галочка в анкете (тоже кладёт сервер)
          wcRemind: dataRef.current.customData?.wcRemind,
        },
      },
      window.location.origin
    );
  };

  // Когда iframe сообщает о готовности — отправляем актуальные данные
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.origin !== window.location.origin || e.source !== iframeRef.current?.contentWindow) return;
      if (e.data && e.data.type === 'wc:ready') postData();
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, slug]);

  // Живое обновление при изменении данных
  useEffect(() => {
    postData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, apiBase, slug]);

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

  // На карточках и печатной открытке — лёгкая миниатюра первого экрана без iframe:
  // в iframe имена появляются только анимацией (.reveal), и на печать они не попадали
  if (!editing) return <VadimDaryaCard data={data} apiBase={apiBase} />;

  // Превью в редакторе — живое и прокручиваемое
  return (
    <iframe
      ref={iframeRef}
      src={initialSrc}
      scrolling={editing ? 'auto' : 'no'}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
        background: '#0f0d09',
        ...(editing ? {} : { pointerEvents: 'none' as const }),
      }}
      title="Превью приглашения"
    />
  );
}

/* ── Карточка-превью «Тёмной элегантности»: первый экран сайта ──────────────
   Повторяет .hero из public/invite/vadimdarya/style.css: фото на весь экран,
   затемнение снизу, «Приглашение на свадьбу», имена по диагонали, дата.
   Размеры — в долях ширины (cqw) от телефона 480px: 18vw имён = 18cqw. */
const VD_MONTHS = ['ЯНВАРЯ', 'ФЕВРАЛЯ', 'МАРТА', 'АПРЕЛЯ', 'МАЯ', 'ИЮНЯ', 'ИЮЛЯ', 'АВГУСТА', 'СЕНТЯБРЯ', 'ОКТЯБРЯ', 'НОЯБРЯ', 'ДЕКАБРЯ'];

function VadimDaryaCard({ data, apiBase }: { data: InviteData; apiBase: string }) {
  const own = !!data.coverPhoto && !data.coverPhoto.startsWith('/invite/vadimdarya/');
  const cover = !data.coverPhoto ? '/invite/vadimdarya/images/couple.jpg'
    : data.coverPhoto.startsWith('/uploads') ? `${apiBase}${data.coverPhoto}` : data.coverPhoto;
  const groom = data.groomName || 'Александр';
  const bride = data.brideName || 'Анна';
  let day = '20', month = 'СЕНТЯБРЯ', year = '2026';
  const [yy, mm, dd] = (data.weddingDate || '').split('-').map(Number);
  if (yy && mm && dd) { day = String(dd); month = VD_MONTHS[mm - 1]; year = String(yy); }
  // Длинное имя в 18cqw вылезло бы за край — уменьшаем кегль
  const longest = Math.max(groom.length, bride.length, 1);
  const nameSize = Math.min(18, 80 / (longest * 0.5));
  const script = "'Cormorant Garamond', Georgia, serif";
  const body = "'Montserrat', system-ui, sans-serif";
  const name: React.CSSProperties = {
    margin: 0, fontFamily: script, fontSize: `${nameSize}cqw`, fontWeight: 300, fontStyle: 'italic', lineHeight: 1.15,
    color: '#fff', letterSpacing: '-0.01em', whiteSpace: 'nowrap', textShadow: '0 4px 30px rgba(0,0,0,.5), 0 0 40px rgba(201,168,76,.18)',
  };
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#1a1712', containerType: 'inline-size' }}>
      <img src={cover} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: own ? '50% 30%' : '100% top' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,8,5,.3) 0%, rgba(10,8,5,.1) 40%, rgba(10,8,5,.5) 80%, rgba(10,8,5,.95) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 6cqw' }}>
        <p style={{ margin: '0 0 6.5cqw', fontFamily: body, fontSize: 'clamp(8px, 2.2cqw, 11px)', fontWeight: 300, letterSpacing: '0.5em', color: 'rgba(255,255,255,.8)', textTransform: 'uppercase' }}>
          Приглашение на свадьбу
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '67cqw', marginBottom: '8cqw' }}>
          <p style={{ ...name, textAlign: 'left' }}>{groom}</p>
          <span style={{ fontFamily: script, fontSize: '20cqw', color: 'rgba(255,255,255,.4)', fontStyle: 'italic', fontWeight: 300, lineHeight: 0.6, textAlign: 'right', paddingRight: '35%', margin: '-2cqw 0' }}>&amp;</span>
          <p style={{ ...name, textAlign: 'right' }}>{bride}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2.5cqw', fontFamily: body, fontWeight: 200, fontSize: '3cqw', letterSpacing: '0.5em', color: 'rgba(255,255,255,.8)' }}>
          <span>{day}</span><span style={{ color: 'rgba(255,255,255,.5)' }}>·</span>
          <span>{month}</span><span style={{ color: 'rgba(255,255,255,.5)' }}>·</span>
          <span>{year}</span>
        </div>
      </div>
    </div>
  );
}
