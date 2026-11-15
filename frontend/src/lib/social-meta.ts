import type { Metadata } from 'next';

/** Картинка превью ссылки: логотип WeddingCraft (решение f08895d — не фото пары из демо). */
export const OG_IMAGE = { url: '/brand/og-cover.jpg', width: 1200, height: 630, alt: 'WeddingCraft — сайты-приглашения на свадьбу' };

/** Теги превью ссылки (Open Graph и Twitter) для страницы с адресом path.
    Страница без своих тегов наследует теги главной из app/layout.tsx: до 14.11.26 ссылка
    на /print или /contacts в мессенджере показывалась с заголовком и адресом главной.
    Оба набора задаются целиком — частичное перекрытие оставило бы теги главной. */
export function socialMeta(path: string, title: string, description: string): Pick<Metadata, 'openGraph' | 'twitter'> {
  return {
    openGraph: { type: 'website', siteName: 'WeddingCraft', locale: 'ru_RU', url: path, title, description, images: [OG_IMAGE] },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE.url] },
  };
}
