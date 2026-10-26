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

/* Какие страницы попадают в Метрику. Публичные страницы — плюс страницы воронки
   (редактор, вход, оплата): на них срабатывают все цели, без них Директ и
   отчёты не видят ни одной конверсии. Сайты пар (/<slug>, ссылки гостей ?g=)
   и кабинет по-прежнему не учитываются. Заголовки страниц воронки общие
   («Редактор приглашения», «Оплата тарифа») — имён пар в них нет. */
const ANALYTICS_PATHS = [
  '/', '/templates', '/print', '/contacts', '/privacy', '/oferta', '/blog',
  '/editor', '/auth', '/payment', '/payment/success',
];

/* Из параметров адреса оставляем только рекламные метки: по yclid Метрика
   связывает визит с кликом в Директе, по utm_* строит отчёты по кампаниям.
   Личных данных в них нет. Всё остальное (id приглашения, токен оплаты,
   ?g= гостя) в Метрику не уходит. */
const MARKETING_PARAMS = /^(utm_[a-z]+|yclid|gclid|_openstat)$/;

/** Адрес страницы для Метрики или null, если страницу учитывать нельзя. */
export function analyticsPageUrl(value: string, base = 'https://weddingcraft.ru'): string | null {
  try {
    const url = new URL(value, base);
    if (!['weddingcraft.ru', 'www.weddingcraft.ru'].includes(url.hostname) || url.protocol !== 'https:') return null;
    if (url.searchParams.has('g')) return null;
    const path = url.pathname.replace(/\/$/, '') || '/';
    if (!ANALYTICS_PATHS.includes(path) && !/^\/(demo|blog)\/[a-z0-9-]+$/.test(path)) return null;
    const keep = new URLSearchParams();
    url.searchParams.forEach((v, k) => { if (MARKETING_PARAMS.test(k)) keep.append(k, v); });
    const query = keep.toString();
    return url.origin + path + (query ? `?${query}` : '');
  } catch { return null; }
}

/** Откуда пришли. Свой сайт — по тем же правилам, что и страницы; чужой —
    только адрес сайта (так его и так передают браузеры): по нему Метрика
    отличает поиск, соцсети и ссылки, а путь и параметры могут быть личными. */
export function analyticsReferrer(value: string): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (['weddingcraft.ru', 'www.weddingcraft.ru'].includes(url.hostname)) return analyticsPageUrl(value) || '';
    return url.protocol === 'https:' || url.protocol === 'http:' ? `${url.origin}/` : '';
  } catch { return ''; }
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
    url: page, referrer: analyticsReferrer(document.referrer),
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
    // Router transitions start before the previous DOM disappears. Its title can
    // still contain a couple's names, so do not let the counter read it implicitly.
    window.ym?.(METRIKA_ID, 'hit', page, { title: 'WeddingCraft', referer: previousPage || analyticsReferrer(document.referrer) });
    previousPage = page;
  } catch { /* см. выше */ }
}

/** Цели воронки. Держим списком, чтобы не разъезжались с настройками Метрики. */
export const GOAL = {
  catalogNames:   'catalog_names',    // вписал свои имена над превью шаблонов (from: templates | home)
  editorOpen:     'editor_open',      // открыл редактор — выбрал шаблон (параметр template — название шаблона)
  editorForm:     'editor_form',      // увидел анкету «Расскажите о вашей свадьбе» (первый экран нового приглашения)
  editorSetup:    'editor_setup',     // заполнил имена и дату (первый шаг редактора)
  editorDone:     'editor_done',      // нажал «Готово» в редакторе (дальше вход или оплата)
  codeSent:       'code_sent',        // запросил код входа (сервер принял почту)
  signup:         'signup',           // вошёл по коду (регистрация или вход)
  planFree:       'plan_free',        // на странице оплаты сам выбрал «Бесплатный»
  freePublish:    'free_publish',     // опубликовал сайт на бесплатном тарифе
  upgradeClick:   'upgrade_click',    // нажал «улучшить тариф» (параметр from — где)
  paymentStart:   'payment_start',    // нажал «Оплатить» (только платные тарифы)
  paymentSuccess: 'payment_success',  // оплата подтверждена (только платные тарифы)
} as const;
