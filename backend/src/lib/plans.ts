// Тарифы и общие хелперы продукта.
//
// Функциональных уровня три:
//   • лайт         — lite    (сайт + RSVP, ответы только в кабинете)
//   • базовый      — basic   (+ уведомления об ответах и фоновая музыка)
//   • продвинутый  — premium (+ кабинет гостей, персональные ссылки, свой домен)
// Ранее существовал 'standard' — в старых dev-записях мог сохраниться,
// по возможностям он равен базовому.

export type Plan = 'lite' | 'basic' | 'premium';

/** Уведомления об ответах гостей (Telegram, почта) — с «Базового». */
export function hasNotifications(plan: string | null | undefined): boolean {
  return plan === 'basic' || plan === 'premium' || plan === 'standard';
}

/** Фоновая мелодия в приглашении — с «Базового». */
export function hasMusic(plan: string | null | undefined): boolean {
  return plan === 'basic' || plan === 'premium' || plan === 'standard';
}

/** Продвинутый тариф (Премиум): доступны кабинет гостей и персональные ссылки. */
export function isAdvanced(plan: string | null | undefined): boolean {
  return plan === 'premium';
}

/** Тарифы с привязкой собственного домена. */
export function hasCustomDomain(plan: string | null | undefined): boolean {
  return plan === 'premium';
}

/** Оплачен ли тариф (доступны уведомления, свой домен и т.п.). */
export function isPaid(status: string | null | undefined): boolean {
  return status === 'paid' || status === 'published';
}

const SALUTATIONS = ['дорогой', 'дорогая', 'дорогие', 'семья'] as const;
export type Salutation = (typeof SALUTATIONS)[number];

export function isSalutation(s: string): s is Salutation {
  return (SALUTATIONS as readonly string[]).includes(s);
}

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Персональное обращение к гостю:
 *   семья  → «Семья Кореловых»
 *   иначе  → «Дорогой Денис» / «Дорогая Мария» / «Дорогие Денис и Мария»
 */
export function computeGreeting(salutation: string, names: string): string {
  const n = (names || '').trim();
  if (salutation === 'семья') return n ? `Семья ${n}` : 'Семья';
  return `${capitalizeFirst(salutation || 'дорогие')} ${n}`.trim();
}
