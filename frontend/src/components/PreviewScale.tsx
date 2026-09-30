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

export default function PreviewScale({ className, children }: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      const scale = el.clientWidth / BASE_WIDTH;
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
  }, []);

  return <div ref={ref} className={className}>{children}</div>;
}
