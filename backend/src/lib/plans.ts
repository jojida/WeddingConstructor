// Тарифы: Бесплатный / Премиум / Максимум. Старые lite/basic/standard/pro не продаются.
export type Plan = 'free' | 'premium' | 'maximum';
export const PLANS = {
  free: { price: 0, label: 'Бесплатный', rank: 0 },
  premium: { price: 249000, label: 'Премиум', rank: 1 },
  maximum: { price: 399000, label: 'Максимум', rank: 2 },
};
const full = (plan?: string | null) => plan === 'premium' || plan === 'maximum' || plan === 'pro';
export const hasRsvp = (plan?: string | null): boolean => full(plan) || plan === 'lite' || plan === 'basic' || plan === 'standard';
export const hasResponseStats = hasRsvp;
export const hasNotifications = (plan?: string | null): boolean => full(plan) || plan === 'basic' || plan === 'standard';
export const hasMusic = (plan?: string | null): boolean => plan === 'free' || hasNotifications(plan);
export const isAdvanced = (plan?: string | null): boolean => full(plan);
export const hasCustomDomain = (plan?: string | null): boolean => plan === 'free' || full(plan);
export const hasPlanner = (plan?: string | null): boolean => plan === 'maximum' || plan === 'pro';

export const FREE_LOCKED_SECTIONS = ['envelope', 'venue', 'hall', 'map', 'schedule', 'dresscode', 'style', 'rsvp', 'menu'];
export function planSections(plan?: string | null, enabledSections: Record<string, boolean> = {}) {
  return plan === 'free'
    ? { ...enabledSections, ...Object.fromEntries(FREE_LOCKED_SECTIONS.map(id => [id, false])) }
    : plan === 'premium' ? { ...enabledSections, menu: false } : enabledSections;
}

export function planPriceDue(plan: keyof typeof PLANS, currentPlan?: string, published = false): number {
  const current = currentPlan && Object.prototype.hasOwnProperty.call(PLANS, currentPlan)
    ? PLANS[currentPlan as keyof typeof PLANS] : undefined;
  return Math.max(0, PLANS[plan].price - (published ? current?.price ?? 0 : 0));
}

/** Печатные PDF по рассадке и меню. Пока входят туда же, где сама рассадка,
    но отдельной функцией — на случай, если печать уйдёт в старший тариф. */
export function hasPlannerPrint(plan: string | null | undefined): boolean {
  return hasPlanner(plan);
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
