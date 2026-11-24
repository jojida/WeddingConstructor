/* Загрузка главной: бесконечность → свадебные кольца (тонкая розовая линия).
   Сама анимация и её сигналы — общий движок lib/rings-loader.ts (он же —
   в окне сайта редактора, components/RingsLoader.tsx). Здесь — «режим
   страницы»: блок на весь экран, ждёт window.load, шрифты и видео первого экрана.

   Почему строка HTML, а не React. Загрузка должна появиться с первой же
   отрисовки и крутиться, пока качаются JS, картинки и шрифты, — то есть
   раньше, чем React оживит страницу. Поэтому стили, SVG и <script> лежат одной
   строкой в dangerouslySetInnerHTML: при открытии главной браузер выполняет этот
   <script> прямо во время разбора HTML. При переходе на главную внутри сайта
   (next/link) React вставляет ту же строку через innerHTML — так скрипты не
   запускаются, и блок остаётся скрытым (.wc-boot без .is-on — display:none).
   Скрипт сам дорисовывает пути в SVG и меняет классы — suppressHydrationWarning
   нужен, чтобы React не ругался на это при гидратации.

   После загрузки (window.load и document.fonts) знак превращается в кольца;
   потом, если видео в телефоне первого экрана ещё не заиграло (HeroPhone
   подключает его после load и шлёт wc:boot-ready, если играть оно не будет),
   ждём его до 2,5 с — и загрузка тает.

   Страница под загрузкой рисуется как обычно: поисковики, читалки экрана и
   LCP видят её сразу, загрузка только закрывает её сверху. */
import { RINGS_MARKUP, RINGS_SCRIPT } from '@/lib/rings-loader';

const HTML = `${RINGS_MARKUP}<script>${RINGS_SCRIPT}</script>`;

export default function BootLoader() {
  return (
    <div
      className="wc-boot"
      aria-hidden="true"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: HTML }}
    />
  );
}
