'use client';
import { useEffect, useRef } from 'react';
import { preload } from 'react-dom';
import styles from './HeroPhone.module.css';

/* Первый экран: телефон, в котором само проигрывается приглашение, и
   акварельные предметы вокруг — они медленно «плавают».

   Скорость: до window.load в телефоне только заставка (26 КБ, первый кадр
   ролика) — она и есть кандидат в LCP. Видео (~1,4 МБ) подключаем после
   загрузки страницы и ставим на паузу, когда телефон ушёл из виду. */

const A = '/landing/hero';
const POSTER = `${A}/invite-poster.webp`;

/* Позиции и размеры — в % от сцены (сцена держит пропорцию 560×720),
   поэтому раскладка одинаково работает на любой ширине. */
const DECO: { src: string; x: number; y: number; w: number; dur: number; delay: number; rot: number; mobile?: boolean }[] = [
  { src: 'deco-swans.webp',     x: 0,  y: 7,  w: 27, dur: 7.5, delay: 0.15, rot: -3, mobile: true },
  { src: 'deco-bouquet.webp',   x: 70, y: 0,  w: 25, dur: 8.5, delay: 0.3,  rot: 4,  mobile: true },
  { src: 'deco-letter.webp',    x: 1,  y: 41, w: 21, dur: 6.8, delay: 0.45, rot: -8 },
  { src: 'deco-rings.webp',     x: 79, y: 36, w: 21, dur: 7.2, delay: 0.6,  rot: 6,  mobile: true },
  { src: 'deco-seal.webp',      x: 22, y: 64, w: 13, dur: 6.4, delay: 0.75, rot: -10 },
  { src: 'deco-doves.webp',     x: 0,  y: 76, w: 25, dur: 8.2, delay: 0.9,  rot: 3,  mobile: true },
  { src: 'deco-key.webp',       x: 70, y: 63, w: 10, dur: 7.8, delay: 1.05, rot: 12 },
  { src: 'deco-mansion.webp',   x: 70, y: 82, w: 31, dur: 9,   delay: 1.2,  rot: 0,  mobile: true },
];

export default function HeroPhone() {
  const videoRef = useRef<HTMLVideoElement>(null);
  preload(POSTER, { as: 'image', fetchPriority: 'high' });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let visible = true;
    const attach = () => {
      if (video.dataset.ready) return;
      video.dataset.ready = '1';
      // Только H.264: WebM/VP9 в части сборок Chrome падает с ошибкой
      // декодирования, а на запасной источник браузер после неё не переходит.
      video.src = `${A}/invite-loop.mp4`;
      if (visible) video.play().catch(() => { /* энергосбережение iOS — останется заставка */ });
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (!video.dataset.ready) return;
      if (visible) video.play().catch(() => {});
      else video.pause();
    }, { threshold: 0.15 });
    io.observe(video);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onLoad = () => { timer = setTimeout(attach, 150); };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });
    return () => { io.disconnect(); window.removeEventListener('load', onLoad); clearTimeout(timer); };
  }, []);

  return (
    <div className={styles.stage}>
      <div className={styles.glow} aria-hidden="true" />
      {DECO.map((d, i) => (
        <span
          key={d.src}
          className={`${styles.deco} ${d.mobile ? '' : styles.decoDesktop}`}
          style={{
            left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%`,
            '--dur': `${d.dur}s`, '--delay': `${d.delay}s`, '--rot': `${d.rot}deg`, '--i': i,
          } as React.CSSProperties}
          aria-hidden="true"
        >
          <img src={`${A}/${d.src}`} alt="" decoding="async" draggable={false} />
        </span>
      ))}

      <div className={styles.phone}>
        <div className={styles.island} aria-hidden="true" />
        <div className={styles.screen}>
          <video
            ref={videoRef}
            className={styles.video}
            poster={POSTER}
            muted
            loop
            playsInline
            preload="none"
            aria-label="Пример приглашения: конверт открывается, появляется обложка с парой"
          />
        </div>
      </div>
    </div>
  );
}
