/* Партнёрская ссылка: weddingcraft.ru/…?promo=КОД. Код запоминается в браузере
   и сам подставляется на странице оплаты — паре не нужно помнить промокод, а продажа
   засчитывается партнёру: код уходит в описание и metadata платежа ЮKassa
   (backend/src/routes/payment.ts). Хранится только в localStorage, на сервер код
   попадает лишь вместе с оплатой. Действует последняя открытая ссылка.
   Сами коды и скидки — в env бэкенда PROMO_CODES (см. PARTNERS.md). */

const KEY = 'wc_promo';
// Свадьбу готовят месяцами: от совета партнёра до оплаты может пройти несколько недель
export const PROMO_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const CODE = /^[A-Z0-9А-ЯЁ_-]{2,32}$/u;

/** Код из адреса страницы, если он похож на промокод (без проверки на сервере). */
export function promoFromSearch(search: string): string | null {
  try {
    const raw = new URLSearchParams(search).get('promo');
    const code = (raw || '').trim().toUpperCase();
    return CODE.test(code) ? code : null;
  } catch {
    return null;
  }
}

export function rememberPromoFromUrl(search: string, now = Date.now()): void {
  const code = promoFromSearch(search);
  if (!code) return;
  try { localStorage.setItem(KEY, JSON.stringify({ code, at: now })); } catch { /* приватный режим */ }
}

export function savedPromo(now = Date.now()): string | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!value || typeof value.code !== 'string' || !CODE.test(value.code)) return null;
    if (typeof value.at !== 'number' || now - value.at > PROMO_TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return value.code;
  } catch {
    return null;
  }
}

export function forgetPromo(): void {
  try { localStorage.removeItem(KEY); } catch { /* приватный режим */ }
}
