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
   поэтому раскладка одинаково работает на любой ширине. Раскладка своя, не
   как у Digital Yes (у них лебеди в верхнем углу, конверт слева, кольца
   справа): особняк и купидон сверху, лебеди — внизу справа. */
const DECO: { src: string; x: number; y: number; w: number; dur: number; delay: number; rot: number; mobile?: boolean }[] = [
  { src: 'deco-mansion.webp',   x: 0,  y: 5,  w: 31, dur: 9,   delay: 0.15, rot: 0,  mobile: true },
  { src: 'deco-cupid.webp',     x: 76, y: 1,  w: 22, dur: 7.6, delay: 0.3,  rot: 5,  mobile: true },
  { src: 'deco-bouquet.webp',   x: 0,  y: 35, w: 25, dur: 8.4, delay: 0.45, rot: -5, mobile: true },
  { src: 'deco-champagne.webp', x: 80, y: 32, w: 17, dur: 6.9, delay: 0.6,  rot: 7 },
  { src: 'deco-letter.webp',    x: 76, y: 55, w: 22, dur: 7.2, delay: 0.75, rot: 6,  mobile: true },
  { src: 'deco-seal.webp',      x: 19, y: 62, w: 12, dur: 6.4, delay: 0.9,  rot: -10 },
  { src: 'deco-rings.webp',     x: 2,  y: 79, w: 22, dur: 7.8, delay: 1.05, rot: -6, mobile: true },
  { src: 'deco-swans.webp',     x: 69, y: 81, w: 30, dur: 8.2, delay: 1.2,  rot: 3,  mobile: true },
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
