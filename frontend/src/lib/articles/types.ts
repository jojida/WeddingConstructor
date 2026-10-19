/* Статьи раздела /blog. Текст — данными, а не разметкой: из них же строятся
   оглавление, разметка schema.org и карта сайта.
   В строках абзацев и списков работают [текст](/адрес) и **жирный**. */

export type ArticleBlock =
  | { h2: string }
  | { p: string }
  | { ul: string[] }
  | { ol: string[] }
  /** Готовый текст с кнопкой «Скопировать». [в скобках] — что заменить на своё. */
  | { example: string; label?: string }
  | { tip: string }
  /** Призыв сделать приглашение. Без title/text — общий вариант. */
  | { cta: { title?: string; text?: string } };

export interface Article {
  slug: string;
  /** H1 на странице */
  title: string;
  /** <title> страницы (к нему дописывается «— WeddingCraft») */
  metaTitle: string;
  description: string;
  /** Первый абзац под заголовком — коротко, о чём статья */
  lead: string;
  /** Короткое название для карточек и ссылок */
  short: string;
  published: string; // YYYY-MM-DD
  updated: string;   // YYYY-MM-DD
  related: string[]; // slug других статей
  blocks: ArticleBlock[];
}
