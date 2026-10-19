import type { Article, ArticleBlock } from './types';
import { invitationText } from './invitation-text';
import { makeEInvitation } from './make-e-invitation';
import { guestSurvey } from './guest-survey';
import { sendInvitation } from './send-invitation';
import { nikah } from './nikah';
import { venchanie } from './venchanie';

export type { Article, ArticleBlock };

/** Порядок — как в списке /blog: сначала самые частые запросы. Новая статья —
    файл рядом + строка здесь; адрес, карта сайта и разметка подтянутся сами. */
export const ARTICLES: Article[] = [invitationText, makeEInvitation, guestSurvey, sendInvitation, nikah, venchanie];

export const findArticle = (slug: string): Article | undefined => ARTICLES.find(a => a.slug === slug);

/** Якорь раздела для оглавления: порядковый номер заголовка h2. */
export const sectionId = (index: number): string => `s${index + 1}`;
