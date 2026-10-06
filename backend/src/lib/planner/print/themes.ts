// Печатные темы. Перенести в PDF декор каждого шаблона целиком нельзя (растровые иллюстрации,
// шрифты без лицензии на встраивание), поэтому у печати своя небольшая палитра в духе шаблона:
// цвет, начертание заголовков и тонкий векторный орнамент.
import type { Family } from './fonts';

export interface Theme {
  id: string;
  title: string;
  heading: Family;   // имена, номера столов, заголовки
  body: Family;      // подписи, списки
  ink: string;       // основной текст
  accent: string;    // орнамент и акценты
  muted: string;     // второстепенный текст
  soft: string;      // линии для письма, светлые рамки
}

export const THEMES: Theme[] = [
  { id: 'classic', title: 'Классика', heading: 'serif', body: 'serif', ink: '#2b2622', accent: '#a4844f', muted: '#7d746a', soft: '#d9cfc2' },
  { id: 'romance', title: 'Романтика', heading: 'script', body: 'serif', ink: '#3a2a2e', accent: '#b07784', muted: '#8a7378', soft: '#ead6da' },
  { id: 'garden', title: 'Сад', heading: 'script', body: 'serif', ink: '#2f3a2c', accent: '#6b7d5a', muted: '#6f7768', soft: '#d8e0cf' },
  { id: 'modern', title: 'Минимализм', heading: 'sans', body: 'sans', ink: '#22303a', accent: '#4a6274', muted: '#6c7a84', soft: '#d6dde2' },
];

// Шаблон приглашения → ближайшая по духу печатная тема
const BY_TEMPLATE: Record<string, string> = {
  calla: 'classic', ivory: 'classic', vadimdarya: 'classic', etalon: 'classic',
  angels: 'romance', tenderness: 'romance', sketch: 'romance',
  floral: 'garden', 'garden-arch': 'garden', 'garden-evening': 'garden', forest: 'garden',
  mediterranean: 'modern',
};

export function themeFor(templateId: string, requested?: unknown): Theme {
  const id = typeof requested === 'string' && THEMES.some((t) => t.id === requested) ? requested : BY_TEMPLATE[templateId] ?? 'classic';
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
