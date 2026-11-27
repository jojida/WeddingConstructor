'use client';
import { useEffect, useRef, type CSSProperties } from 'react';
import { RINGS_MARKUP, RINGS_SCRIPT } from '@/lib/rings-loader';

/* Загрузка «бесконечность → кольца» — тот же движок lib/rings-loader.ts в
   «режиме сигнала»: пока ready=false, по бесконечности бегает комета;
   ready=true — знак превращается в кольца (быстрый финал, ~1,7 с); растаять
   загрузка ждёт settled (по умолчанию = ready, не дольше 5 с), потом зовёт
   onDone — тогда её можно убрать.

   Два вида:
   · в окне (по умолчанию) — поверх сайта в окне редактора
     (app/editor/SitePreview.tsx), когда сайт там грузится заново (другое
     устройство). Родителю нужен position: relative — блок ложится на него
     целиком. size — размер знака в CSS-пикселях родителя: в уменьшенном окне
     (transform) его увеличивают, чтобы на экране знак остался ~200 px;
   · cover — на всё окно браузера, поверх редактора целиком
     (app/editor/EditorBoot.tsx, 27.11.26). Скрипт лежит прямо в разметке: при
     открытии /editor по адресу браузер выполняет его во время разбора HTML, и
     комета бежит с первой отрисовки — ещё до того, как оживёт React (как было
     у загрузки главной). При переходе внутри сайта скрипт из innerHTML не
     запускается — тогда его вставляем сами, как в окне.

   Блок рисуется сразу видимым (is-on) — то, что под ним, не мелькает, пока
   скрипт не запустился. Скрипт вставляется элементом <script>: так он
   выполняется (в innerHTML — нет) и находит свой блок через currentScript.
   Второй запуск на том же блоке скрипт сам гасит (флаг box.__wcRings). */
const COVER_HTML = `${RINGS_MARKUP}<script>${RINGS_SCRIPT}</script>`;
/* Ниже всплывающих сообщений (react-hot-toast — 9999): «Черновик восстановлен»
   и ошибки загрузки видны и поверх загрузки; редактор (до 50) — под ней */
const COVER_STYLE: CSSProperties = { zIndex: 9000 };

type RingsBox = HTMLDivElement & { __wcRings?: number };

export default function RingsLoader({ ready, settled = ready, size = 200, cover = false, onDone }: {
  /** Можно складывать кольца */
  ready: boolean;
  /** Можно таять: всё, что под загрузкой на виду, догрузилось */
  settled?: boolean;
  size?: number;
  /** На всё окно, а не внутри родителя */
  cover?: boolean;
  onDone?: () => void;
}) {
  const ref = useRef<RingsBox>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; });

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const end = () => onDoneRef.current?.();
    box.addEventListener('wc:boot-done', end);
    if (!box.__wcRings) {
      const script = document.createElement('script');
      script.text = RINGS_SCRIPT;
      box.appendChild(script);
    } else if (!box.classList.contains('is-on')) {
      // Скрипт из разметки страницы успел доиграть раньше, чем ожил React
      end();
    }
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

  if (cover) {
    // Скрипт сам дорисовывает знак и меняет классы ещё до гидратации — React
    // не должен ругаться на расхождение с разметкой сервера
    return (
      <div ref={ref} className="wc-boot is-on" data-wait="signal" aria-hidden="true" style={COVER_STYLE}
        suppressHydrationWarning dangerouslySetInnerHTML={{ __html: COVER_HTML }} />
    );
  }
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
