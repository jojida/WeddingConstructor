'use client';
import { useEffect, useRef, type CSSProperties } from 'react';
import { RINGS_MARKUP, RINGS_SCRIPT } from '@/lib/rings-loader';

/* Загрузка «бесконечность → кольца» внутри окна (а не на весь экран, как на
   главной) — сейчас поверх сайта в окне редактора (app/editor/SitePreview.tsx).
   Анимация — тот же движок lib/rings-loader.ts в «режиме сигнала»: пока
   ready=false, по бесконечности бегает участок; ready=true — знак превращается
   в кольца (быстрый финал, ~1,7 с); растаять загрузка ждёт settled (по
   умолчанию = ready, не дольше 5 с), потом зовёт onDone — тогда её можно убрать.

   Родителю нужен position: relative — блок ложится на него целиком.
   size — размер знака в CSS-пикселях родителя: в уменьшенном окне (transform)
   его увеличивают, чтобы на экране знак остался ~200 px.

   Блок рисуется сразу видимым (is-on) — шаблон под ним не мелькает, пока
   скрипт не запустился. Скрипт вставляется элементом <script>: так он
   выполняется (в innerHTML — нет) и находит свой блок через currentScript. */
export default function RingsLoader({ ready, settled = ready, size = 200, onDone }: {
  /** Можно складывать кольца */
  ready: boolean;
  /** Можно таять: всё, что под загрузкой на виду, догрузилось */
  settled?: boolean;
  size?: number;
  onDone?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; });

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const end = () => onDoneRef.current?.();
    box.addEventListener('wc:boot-done', end);
    const script = document.createElement('script');
    script.text = RINGS_SCRIPT;
    box.appendChild(script);
    // Скрипт не смог запуститься совсем — окно не должно остаться закрытым
    const fallback = setTimeout(end, 21000);
    return () => {
      box.removeEventListener('wc:boot-done', end);
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    const box = ref.current;
    if (!box || !ready) return;
    box.setAttribute('data-ready', '1');
    box.dispatchEvent(new Event('wc:boot-ready'));
  }, [ready]);

  useEffect(() => {
    const box = ref.current;
    if (!box || !settled) return;
    box.setAttribute('data-settled', '1');
    box.dispatchEvent(new Event('wc:boot-settled'));
  }, [settled]);

  return (
    <div
      ref={ref}
      className="wc-boot is-inline is-on"
      data-wait="signal"
      aria-hidden="true"
      style={{ '--wb-size': `${Math.round(size)}px` } as CSSProperties}
      dangerouslySetInnerHTML={{ __html: RINGS_MARKUP }}
    />
  );
}
