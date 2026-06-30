// Тарифы и общие хелперы продукта.
//
// Функциональных уровня два:
//   • простой      — basic            (сайт + RSVP + уведомления)
//   • продвинутый  — standard|premium (+ кабинет гостей, персональные ссылки, свой домен)

export type Plan = 'basic' | 'standard' | 'premium';

/** Продвинутый тариф: доступны кабинет гостей и персональные ссылки. */
export function isAdvanced(plan: string | null | undefined): boolean {
  return plan === 'standard' || plan === 'premium';
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
