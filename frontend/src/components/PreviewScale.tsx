'use client';
import { useEffect, useRef } from 'react';

/* Обёртка превью шаблона в карточке-витрине.

   Шаблоны свёрстаны под ширину телефона и почти целиком в пикселях: заголовок
   94px, рамка имён 128px и так далее. Поэтому превью нельзя просто растянуть
   по карточке — его нужно рисовать в «родной» ширине и целиком ужимать.

   Раньше ширина задавалась как 125% карточки с постоянным scale(0.8). На
   десктопе карточка широкая и выходило около 480px — почти родная ширина. На
   мобильном карточка 162px, шаблон получал 202px, и всё содержимое вылезало
   за край: заголовок обрезался, имена наезжали на подпись карточки.

   Теперь ширина фиксированная, а масштаб считается от фактической ширины
   карточки — превью выглядит одинаково на любом экране. */
const BASE_WIDTH = 480;

/* baseWidth — «родная» ширина рендера. Для экрана телефона в витрине
   (TemplateShowcase) она уже 480px: экран вытянут по высоте, и миниатюра,
   рассчитанная на пропорции карточки, при 480px оставляла пустую полосу
   снизу. CSS читает её из --preview-base.

   coverHeight — режим «cover» для миниатюр-картинок с постоянными
   пропорциями (Нежность, Лес, Ангелы…): их высота растёт только с шириной,
   и в вытянутом экране снизу оставалось пусто. Тогда рендерим миниатюру
   baseWidth × coverHeight, масштабируем по высоте контейнера и центрируем,
   края по бокам срезаются (--preview-offset). */
export default function PreviewScale({ className, children, baseWidth = BASE_WIDTH, coverHeight }: {
  className?: string;
  children: React.ReactNode;
  baseWidth?: number;
  coverHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      if (coverHeight) {
        const scale = Math.max(el.clientHeight / coverHeight, el.clientWidth / baseWidth);
        if (!scale) return;
        el.style.setProperty('--preview-scale', String(scale));
        el.style.setProperty('--preview-height', `${coverHeight}px`);
        el.style.setProperty('--preview-offset', `${Math.round((el.clientWidth - baseWidth * scale) / 2)}px`);
        return;
      }
      const scale = el.clientWidth / baseWidth;
      if (!scale) return;
      el.style.setProperty('--preview-scale', String(scale));
      // Высоту превью подгоняем так, чтобы после сжатия оно закрыло карточку.
      el.style.setProperty('--preview-height', `${Math.round(el.clientHeight / scale)}px`);
    };

    fit();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    }
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseWidth, coverHeight]);

  return (
    <div ref={ref} className={className} style={{ '--preview-base': `${baseWidth}px` } as React.CSSProperties}>
      {children}
    </div>
  );
}
