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
    window.ym?.(METRIKA_ID, 'reachGoal', goal, params);
  } catch { /* молча: потеря одной цели не стоит упавшей страницы */ }
}

/** Просмотр страницы при переходе внутри приложения.
    init засчитывает только первый URL — остальные шлём сами. */
export function trackPageView(url: string): void {
  try {
    window.ym?.(METRIKA_ID, 'hit', url);
  } catch { /* см. выше */ }
}

/** Цели воронки. Держим списком, чтобы не разъезжались с настройками Метрики. */
export const GOAL = {
  editorOpen:     'editor_open',      // открыл редактор — выбрал шаблон
  signup:         'signup',           // вошёл по коду (регистрация или вход)
  paymentStart:   'payment_start',    // нажал «Оплатить»
  paymentSuccess: 'payment_success',  // оплата подтверждена
} as const;
