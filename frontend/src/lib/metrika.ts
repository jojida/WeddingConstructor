/* Яндекс.Метрика — единственная точка, где знают о счётчике.
   Номер счётчика не секрет: он и так виден в исходниках страницы. */

export const METRIKA_ID = 112147076;

declare global {
  interface Window {
    ym?: ((id: number, action: string, ...args: unknown[]) => void) & { a?: unknown[]; l?: number };
  }
}

/* Аналитика не имеет права ломать продукт: счётчик может не загрузиться
   из-за блокировщика или офлайна, поэтому каждый вызов защищён. */

/* Тестовый аккаунт владельца в воронку не попадает: собственные проверки
   иначе накрутили бы «оплаты», которых не было. Флаг дублируется в
   localStorage — цель editor_open срабатывает раньше, чем вернётся /me. */
const MUTE_KEY = 'wc_no_metrics';
let muted: boolean | null = null;
let active = false;
let previousPage = '';

/** Only public product pages belong in analytics; invitation URLs contain guest tokens. */
export function analyticsPageUrl(value: string, base = 'https://weddingcraft.ru'): string | null {
  try {
    const url = new URL(value, base);
    if (!['weddingcraft.ru', 'www.weddingcraft.ru'].includes(url.hostname) || url.protocol !== 'https:') return null;
    if (url.searchParams.has('g')) return null;
    const path = url.pathname.replace(/\/$/, '') || '/';
    if (!['/', '/templates', '/print', '/contacts', '/privacy', '/oferta'].includes(path) && !/^\/demo\/[a-z0-9-]+$/.test(path)) return null;
    return url.origin + path;
  } catch { return null; }
}

function startCounter(page: string): void {
  if (active) return;
  if (!window.ym) {
    const queue = function (...args: unknown[]) { (queue.a = queue.a || []).push(args); } as NonNullable<Window['ym']>;
    queue.l = Date.now();
    window.ym = queue;
  }
  const src = `https://mc.yandex.ru/metrika/tag.js?id=${METRIKA_ID}`;
  if (!Array.from(document.scripts).some(script => script.src === src)) {
    const script = document.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = src;
    document.head.appendChild(script);
  }
  window.ym(METRIKA_ID, 'init', {
    ssr: true, defer: true, webvisor: false, clickmap: false,
    trackLinks: false, accurateTrackBounce: false,
    url: page, referrer: analyticsPageUrl(document.referrer) || '',
  });
  active = true;
}

function isMuted(): boolean {
  if (muted === null) {
    try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { muted = false; }
  }
  return muted;
}

/** Включает/выключает учёт целей для текущего аккаунта. */
export function muteGoals(on: boolean): void {
  muted = on;
  try {
    if (on) localStorage.setItem(MUTE_KEY, '1');
    else localStorage.removeItem(MUTE_KEY);
  } catch { /* приватный режим — переживём */ }
}

/** Цель воронки. Идентификаторы заведены в интерфейсе Метрики как JS-события. */
export function reachGoal(goal: string, params?: Record<string, unknown>): void {
  if (isMuted()) return;
  try {
    if (!active || !analyticsPageUrl(window.location.href)) return;
    window.ym?.(METRIKA_ID, 'reachGoal', goal, params);
  } catch { /* молча: потеря одной цели не стоит упавшей страницы */ }
}

/** Просмотр страницы при переходе внутри приложения.
    init засчитывает только первый URL — остальные шлём сами. */
export function trackPageView(url: string): void {
  try {
    const page = analyticsPageUrl(url, window.location.origin);
    if (!page || isMuted()) {
      if (active) window.ym?.(METRIKA_ID, 'destruct');
      active = false;
      previousPage = '';
      return;
    }
    startCounter(page);
    window.ym?.(METRIKA_ID, 'hit', page, { referer: previousPage || analyticsPageUrl(document.referrer) || '' });
    previousPage = page;
  } catch { /* см. выше */ }
}

/** Цели воронки. Держим списком, чтобы не разъезжались с настройками Метрики. */
export const GOAL = {
  editorOpen:     'editor_open',      // открыл редактор — выбрал шаблон
  signup:         'signup',           // вошёл по коду (регистрация или вход)
  freePublish:    'free_publish',     // опубликовал сайт на бесплатном тарифе
  paymentStart:   'payment_start',    // нажал «Оплатить» (только платные тарифы)
  paymentSuccess: 'payment_success',  // оплата подтверждена (только платные тарифы)
} as const;
