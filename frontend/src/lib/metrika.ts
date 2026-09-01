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

/** Цель воронки. Идентификаторы заведены в интерфейсе Метрики как JS-события. */
export function reachGoal(goal: string, params?: Record<string, unknown>): void {
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
