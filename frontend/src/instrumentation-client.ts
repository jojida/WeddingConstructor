/* Инициализация Яндекс.Метрики.
   Файл выполняется после загрузки HTML, но ДО гидратации React — счётчик
   успевает застать первый экран и не тормозит интерактивность.

   Почему не <Script> в layout: в App Router переходы между страницами
   происходят без перезагрузки, и счётчик засчитал бы только первый URL.
   Здесь же доступен хук onRouterTransitionStart — он вызывается на каждой
   клиентской навигации, и воронка «галерея → редактор → оплата» видна целиком. */

import { METRIKA_ID, trackPageView } from '@/lib/metrika';

const TAG_SRC = `https://mc.yandex.ru/metrika/tag.js?id=${METRIKA_ID}`;

try {
  const w = window;

  // Очередь вызовов: команды, отданные до загрузки tag.js, не теряются.
  if (!w.ym) {
    const queue = function (this: unknown, ...args: unknown[]) {
      (queue.a = queue.a || []).push(args);
    } as NonNullable<Window['ym']> & { a?: unknown[]; l?: number };
    queue.l = Date.now();
    w.ym = queue;
  }

  // Скрипт мог быть вставлен раньше (например, при hot reload) — не дублируем.
  const already = Array.from(document.scripts).some(s => s.src === TAG_SRC);
  if (!already) {
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = TAG_SRC;
    document.head.appendChild(tag);
  }

  w.ym?.(METRIKA_ID, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: 'dataLayer',
    accurateTrackBounce: true,
    trackLinks: true,
    referrer: document.referrer,
    url: location.href,
  });
} catch { /* аналитика не должна мешать приложению запуститься */ }

/** Переход внутри приложения — засчитываем просмотр вручную. */
export function onRouterTransitionStart(url: string): void {
  trackPageView(url);
}
