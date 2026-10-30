import crypto from 'crypto';
import prisma from './prisma';

// Слова, которые нельзя использовать как slug, чтобы не конфликтовать
// с маршрутами фронтенда (weddingcraft.ru/<slug>).
export const RESERVED_SLUGS = new Set([
  'api', 'auth', 'by-domain', 'dashboard', 'demo', 'editor', 'invite', 'payment', 'print',
  'templates', 'admin', 'login', 'register', 'signup', 'about', 'pricing', 'help',
  'static', 'assets', '_next', 'favicon', 'robots', 'sitemap', 'www', 'public', 'uploads', 'studio', 'privacy', 'oferta', 'contacts',
  'blog', 'c', 'rassadka-gostey-na-svadbu',
]);

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function translit(s: string): string {
  return s.toLowerCase()
    .replace(/[аА]/g, 'a').replace(/[бБ]/g, 'b').replace(/[вВ]/g, 'v')
    .replace(/[гГ]/g, 'g').replace(/[дД]/g, 'd').replace(/[еЕёЁ]/g, 'e')
    .replace(/[жЖ]/g, 'zh').replace(/[зЗ]/g, 'z').replace(/[иИ]/g, 'i')
    .replace(/[йЙ]/g, 'j').replace(/[кК]/g, 'k').replace(/[лЛ]/g, 'l')
    .replace(/[мМ]/g, 'm').replace(/[нН]/g, 'n').replace(/[оО]/g, 'o')
    .replace(/[пП]/g, 'p').replace(/[рР]/g, 'r').replace(/[сС]/g, 's')
    .replace(/[тТ]/g, 't').replace(/[уУ]/g, 'u').replace(/[фФ]/g, 'f')
    .replace(/[хХ]/g, 'h').replace(/[цЦ]/g, 'ts').replace(/[чЧ]/g, 'ch')
    .replace(/[шШ]/g, 'sh').replace(/[щЩ]/g, 'sch').replace(/[ъЪьЬ]/g, '')
    .replace(/[ыЫ]/g, 'y').replace(/[эЭ]/g, 'eh').replace(/[юЮ]/g, 'yu')
    .replace(/[яЯ]/g, 'ya').replace(/[^a-z0-9]/g, '');
}

export function generateSlug(groomName: string, brideName: string): string {
  const g = translit(groomName) || 'groom';
  const b = translit(brideName) || 'bride';
  // 96 random bits avoid collisions and make unshared default links hard to guess.
  return `${g}-i-${b}-${crypto.randomBytes(12).toString('hex')}`;
}

/** Адрес черновика: при создании имён ещё нет, поэтому заглушка. Её никто не выбирал. */
export const isDefaultSlug = (slug: string): boolean => /^groom-i-bride-[0-9a-f]{24}$/.test(slug);

/* С 08.10.26 черновик получает адрес «groom-i-bride-<24 знака>», и с ним же сайт
   публиковался: страница успеха предлагала разослать гостям именно эту ссылку.
   При первой публикации заглушку меняем на адрес из имён пары. Шесть случайных
   знаков в конце оставлены, чтобы сайт пары не находился перебором имён.
   Звать только при первой публикации: ссылку уже опубликованного сайта гости
   получили, её менять нельзя. Сбой здесь не должен мешать публикации. */
export async function readableSlugAfterPublish(inviteId: string): Promise<void> {
  try {
    const invite = await prisma.invitation.findUnique({ where: { id: inviteId }, select: { slug: true, groomName: true, brideName: true } });
    if (!invite || !isDefaultSlug(invite.slug)) return;
    const g = translit(invite.groomName || '').slice(0, 14);
    const b = translit(invite.brideName || '').slice(0, 14);
    if (!g || !b) return;
    for (let i = 0; i < 5; i++) {
      const slug = `${g}-i-${b}-${crypto.randomBytes(3).toString('hex')}`;
      if (!SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) return;
      try {
        await prisma.invitation.updateMany({ where: { id: inviteId, slug: invite.slug }, data: { slug } });
        return;
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
      }
    }
  } catch (error) {
    console.error('Readable slug failed:', error instanceof Error ? error.name : 'Error');
  }
}
