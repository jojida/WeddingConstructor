export type Plan = 'free' | 'premium' | 'maximum';

export const PLANS = [
  {
    id: 'free', name: 'Бесплатный', price: 0, period: 'бесплатно, без срока действия',
    features: ['Любой шаблон приглашения', 'Имена, дата, тексты и фото', 'Музыкальный фон', 'Ссылка для гостей и подключение домена', 'Правки в любой момент', 'Подпись WeddingCraft внизу сайта'],
    color: '#9a948a', popular: false, badge: '',
  },
  {
    id: 'premium', name: 'Премиум', price: 2490, period: 'разовая оплата за один сайт',
    features: ['Всё из бесплатного тарифа', 'Анимация открытия', 'Анкета для гостей', 'Место и карта проезда', 'Программа дня и дресс-код', 'Статистика ответов', 'Кабинет в Telegram и уведомления на почту', 'Список гостей и персональные ссылки'],
    color: '#c9a96e', popular: true, badge: 'Популярный',
  },
  {
    id: 'maximum', name: 'Максимум', price: 3990, period: 'разовая оплата за один сайт',
    features: ['Всё из тарифа «Премиум»', 'Рассадка гостей по столам', 'Меню и выбор блюд гостями', 'Печатные материалы для рассадки и меню'],
    color: '#685d4a', popular: false, badge: 'Всё включено',
  },
];

/** Сайт опубликован — его видят гости. Бесплатная публикация тоже ставит статус paid. */
export const isPublished = (status?: string | null): boolean => status === 'paid' || status === 'published';

/** Платный сайт показывается без подписи «Создано на WeddingCraft» (общий модуль шаблонов
    assets/signature.js). С подписью — бесплатный тариф и демо; черновик, пока тариф не
    оплачен, тоже считается «с подписью». */
export const isBrandFree = (plan?: string | null, status?: string | null): boolean =>
  isPublished(status) &&
  ['premium', 'maximum', 'pro', 'lite', 'basic', 'standard'].includes(plan || '');

/** Водяной знак WeddingCraft (assets/brand.js) — только у неопубликованного: демо шаблонов
    и предпросмотр черновика. Опубликованным сайтам, бесплатным тоже, знака нет (с 08.10.26). */
export const hasWatermark = (status?: string | null): boolean => !isPublished(status);

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
