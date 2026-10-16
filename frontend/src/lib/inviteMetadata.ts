// Превью ссылки на сайт-приглашение (Telegram, WhatsApp, ВКонтакте) — общее для /<slug>,
// /invite/<slug> и своего домена. Главная задаёт свои og/twitter-теги с фото-примером из
// шаблона «Каллы» и canonical на себя: всё это страница приглашения обязана перекрыть, иначе
// мессенджер покажет чужую пару и заголовок главной (Telegram берёт twitter:*, когда нет og:image).
import type { Metadata } from 'next';

interface InviteForMeta {
  slug?: string; groomName?: string; brideName?: string; inviteText?: string; weddingDate?: string;
  coverPhoto?: string; templateId?: string;
}

// Версия содержимого картинки: сменили имена, дату, фото или шаблон — у картинки новый адрес,
// и мессенджер не возьмёт старую из своего кэша
function version(invite: InviteForMeta): string {
  let h = 5381;
  for (const ch of [invite.groomName, invite.brideName, invite.weddingDate, invite.coverPhoto, invite.templateId].join('|')) {
    h = ((h << 5) + h + (ch.codePointAt(0) as number)) | 0;
  }
  return (h >>> 0).toString(36);
}

/** Картинка превью рисуется на бэкенде (backend/src/lib/ogImage.ts): своё фото пары с обложки,
    а если его нет — карточка с именами и датой в цветах шаблона. Стоковые фото шаблонов не берём. */
export function inviteImage(invite: InviteForMeta, api: string): string | undefined {
  return invite.slug ? `${api}/api/og/${encodeURIComponent(invite.slug)}?v=${version(invite)}` : undefined;
}

export function inviteMetadata(invite: InviteForMeta, api: string, url: string): Metadata {
  const title = invite.groomName && invite.brideName
    ? `Свадьба ${invite.groomName} & ${invite.brideName}`
    : 'Свадебное приглашение';
  const date = invite.weddingDate ? new Date(invite.weddingDate) : null;
  const description = invite.inviteText
    || `Вас приглашают на свадьбу!${date && !Number.isNaN(date.getTime()) ? ` ${date.toLocaleDateString('ru-RU')}` : ''}`;
  const image = inviteImage(invite, api);
  return {
    title,
    description,
    // Личные страницы пар не должны индексироваться поисковиками.
    robots: { index: false, follow: false },
    alternates: { canonical: url },
    openGraph: {
      type: 'website', siteName: 'WeddingCraft', locale: 'ru_RU', url, title, description,
      images: image ? [{ url: image, width: 1200, height: 630, alt: title }] : [],
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images: image ? [image] : [] },
  };
}

/** Сайт создан, но не опубликован: без превью главной и без индексации. */
export const unpublishedMetadata = (url: string): Metadata => ({
  title: 'Сайт ещё не опубликован',
  robots: { index: false, follow: false },
  alternates: { canonical: url },
  openGraph: { type: 'website', siteName: 'WeddingCraft', url, title: 'Сайт ещё не опубликован', images: [] },
  twitter: { card: 'summary', title: 'Сайт ещё не опубликован', images: [] },
});
