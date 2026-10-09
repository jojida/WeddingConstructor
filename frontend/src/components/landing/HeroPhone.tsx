'use client';
import { useEffect, useRef } from 'react';
import { preload } from 'react-dom';
import styles from './HeroPhone.module.css';

/* Первый экран: ноутбук с редактором WeddingCraft (снимок настоящего
   редактора с шаблоном «Вечер в саду») и телефон перед ним, в котором само
   проигрывается то же приглашение, — «собираете на компьютере, гости
   открывают на телефоне». Раньше вокруг телефона плавали акварельные
   предметы — слишком похоже на Digital Yes, убраны 09.10.26.

   Скорость: до window.load в телефоне только заставка (26 КБ, первый кадр
   ролика) — она и есть кандидат в LCP. Видео (~1,4 МБ) подключаем после
   загрузки страницы и ставим на паузу, когда телефон ушёл из виду. */

const A = '/landing/hero';
const POSTER = `${A}/invite-poster.webp`;
const LAPTOP = `${A}/laptop-editor.webp`;   // 1200×750, снимок редактора (scratchpad shot-editor.cjs)

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

      <div className={styles.laptop}>
        <div className={styles.lid}>
          <span className={styles.camera} aria-hidden="true" />
          <div className={styles.display}>
            <img
              src={LAPTOP}
              width={1200}
              height={750}
              alt="Редактор WeddingCraft: приглашение «Вечер в саду» и настройки блоков"
              decoding="async"
              draggable={false}
            />
          </div>
        </div>
        <div className={styles.base} aria-hidden="true"><span /></div>
      </div>

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
