export type Plan = 'free' | 'premium' | 'maximum';

export const PLANS = [
  {
    id: 'free', name: 'Бесплатный', price: 0, period: 'бесплатно, без срока действия',
    features: ['Сайт-приглашение по любому шаблону', 'Имена, дата, тексты и фотографии', 'Музыкальный фон', 'Ссылка для гостей и привязка своего домена', 'Правки в любой момент', 'Надпись «Создано на WeddingCraft» внизу сайта'],
    color: '#9a948a', popular: false, badge: '',
  },
  {
    id: 'premium', name: 'Премиум', price: 2490, period: 'разовая оплата за один сайт',
    features: ['Всё из бесплатного тарифа', 'Анимация открытия приглашения', 'Анкета для гостей', 'Место проведения и карта с маршрутом', 'Программа дня и дресс-код', 'Таблицы и графики ответов гостей', 'Личный кабинет в Telegram и уведомления на Email', 'Кабинет гостей и персональные ссылки'],
    color: '#c9a96e', popular: true, badge: 'Популярный',
  },
  {
    id: 'maximum', name: 'Максимум', price: 3990, period: 'разовая оплата за один сайт',
    features: ['Всё из тарифа «Премиум»', 'Рассадка гостей по столам', 'Меню и выбор блюд гостями', 'Печатные материалы для рассадки и меню'],
    color: '#685d4a', popular: false, badge: 'Всё включено',
  },
];

/** Платный сайт показывается без подписи «Создано на WeddingCraft» и водяного знака
    (общие модули шаблонов assets/signature.js и assets/brand.js). С брендом — бесплатный
    тариф и демо; черновик, пока тариф не оплачен, тоже считается «с брендом». */
export const isBrandFree = (plan?: string | null, status?: string | null): boolean =>
  (status === 'paid' || status === 'published') &&
  ['premium', 'maximum', 'pro', 'lite', 'basic', 'standard'].includes(plan || '');

export const PLAN_TITLES: Record<string, string> = {
  free: 'Бесплатный', premium: 'Премиум', maximum: 'Максимум',
  lite: 'Лайт', basic: 'Базовый', standard: 'Базовый', pro: 'Про',
};

const full = (plan?: string | null) => plan === 'premium' || plan === 'maximum' || plan === 'pro';
export const hasRsvp = (plan?: string | null): boolean => full(plan) || plan === 'lite' || plan === 'basic' || plan === 'standard';
export const hasResponseStats = hasRsvp;
export const hasNotifications = (plan?: string | null): boolean => full(plan) || plan === 'basic' || plan === 'standard';
export const hasMusic = (plan?: string | null): boolean => plan === 'free' || hasNotifications(plan);
export const isAdvancedPlan = (plan?: string | null): boolean => full(plan);
export const hasCustomDomain = (plan?: string | null): boolean => plan === 'free' || full(plan);
export const hasPlanner = (plan?: string | null): boolean => plan === 'maximum' || plan === 'pro';
/** Анимация открытия. Обёртки шаблонов передают запрет в iframe параметром intro=0 —
    так гость бесплатного сайта не увидит ни кадра заставки, пока идут данные. */
export const hasIntro = (plan?: string | null): boolean => plan !== 'free';

/** envelope — анимация открытия (конверт, двери, видео-заставка): только платным тарифам. */
export const FREE_LOCKED_SECTIONS = ['envelope', 'venue', 'hall', 'map', 'schedule', 'dresscode', 'style', 'rsvp', 'menu'];
export const isPlanSectionLocked = (plan: string | null | undefined, id?: string): boolean =>
  !!id && ((plan === 'free' && FREE_LOCKED_SECTIONS.includes(id)) || (plan === 'premium' && id === 'menu'));

/** Ограничения накладываются при показе, настройки блоков сохраняются для улучшения тарифа. */
export function planSections(plan?: string | null, enabledSections: Record<string, boolean> = {}) {
  return plan === 'free'
    ? { ...enabledSections, ...Object.fromEntries(FREE_LOCKED_SECTIONS.map(id => [id, false])) }
    : plan === 'premium' ? { ...enabledSections, menu: false } : enabledSections;
}

export function planPriceDue(plan: string, currentPlan?: string, published = false): number {
  const price = PLANS.find(p => p.id === plan)?.price ?? 0;
  const credit = published ? PLANS.find(p => p.id === currentPlan)?.price ?? 0 : 0;
  return Math.max(0, price - credit);
}
