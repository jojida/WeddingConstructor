// Отзывы пар о WeddingCraft. Пара пишет отзыв в кабинете своего сайта (в том числе по ссылке
// из письма после свадьбы), владелец сервиса получает его в Telegram-чат поддержки и одобряет
// кнопкой. На главной — только одобренные И с согласием пары. Оценки 1–3 на сайт не попадают:
// это повод написать паре и разобраться.
import type { Invitation, Review } from '@prisma/client';
import prisma from './prisma';
import { telegramApi } from './telegram';
import { supportChatId } from './supportChat';
import { errName } from './planner/util';

export const REVIEW_LIMITS = { text: 1000, names: 80 } as const;
export const PUBLISH_MIN_RATING = 4;
const SITE = (process.env.FRONTEND_URL || 'https://weddingcraft.ru').replace(/\/$/, '');

export class ReviewError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Отзыв оставляют о работающем сайте: опубликованном бесплатно или оплаченном. */
export const canReview = (status: string): boolean => status === 'paid' || status === 'published';

export const coupleNames = (i: { groomName: string; brideName: string }): string =>
  [i.groomName, i.brideName].map((s) => (s || '').trim()).filter(Boolean).join(' и ');

// Управляющие символы прочь; в тексте отзыва переносы строк остаются (не больше одной пустой строки)
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;
function cleanText(value: unknown, max: number, multiline: boolean): string | null {
  if (value == null) return '';
  if (typeof value !== 'string') return null;
  let s = value.normalize('NFC').replace(/\r\n?/g, '\n').replace(CONTROL, '');
  s = multiline
    ? s.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim()
    : s.replace(/\s+/g, ' ').trim();
  return s.length > max ? null : s;
}

/** Что видит пара в кабинете. */
export const ownView = (r: Review | null) => r && {
  rating: r.rating, text: r.text, names: r.names, publish: r.publish, status: r.status, updatedAt: r.updatedAt,
};

/** Отзыв можно показать на сайте: пара разрешила, оценка высокая и есть что прочитать. */
export const publishable = (r: Pick<Review, 'rating' | 'publish' | 'text'>): boolean =>
  r.publish && r.rating >= PUBLISH_MIN_RATING && r.text.length > 0;

export async function saveReview(invite: Invitation, body: Record<string, unknown>): Promise<Review> {
  if (!canReview(invite.status)) throw new ReviewError(403, 'Отзыв можно оставить, когда сайт опубликован');
  const rating = body.rating;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) throw new ReviewError(400, 'Поставьте оценку от 1 до 5');
  const text = cleanText(body.text, REVIEW_LIMITS.text, true);
  if (text === null) throw new ReviewError(400, `Отзыв: не больше ${REVIEW_LIMITS.text} символов`);
  const names = cleanText(body.names, REVIEW_LIMITS.names, false);
  if (names === null) throw new ReviewError(400, `Подпись: не больше ${REVIEW_LIMITS.names} символов`);
  if (body.publish !== undefined && typeof body.publish !== 'boolean') throw new ReviewError(400, 'Проверьте форму');
  const publish = body.publish === true;
  const signature = names || coupleNames(invite) || 'Пара WeddingCraft';

  const prev = await prisma.review.findUnique({ where: { invitationId: invite.id } });
  // Новый текст или оценка — снова на проверку: старое одобрение к нему не относится
  const changed = !prev || prev.rating !== rating || prev.text !== text || prev.names !== signature;
  if (prev && !changed && prev.publish === publish) return prev;
  const data = { rating, text, names: signature, publish, templateId: invite.templateId, ...(changed ? { status: 'pending' } : {}) };
  let review: Review;
  try {
    review = prev
      ? await prisma.review.update({ where: { id: prev.id }, data })
      : await prisma.review.create({ data: { ...data, invitationId: invite.id, userId: invite.userId, status: 'pending' } });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') throw new ReviewError(409, 'Отзыв уже сохраняется — обновите страницу');
    throw e;
  }
  // Владельцу — когда есть что прочитать или что одобрить
  if (changed || (publish && !prev?.publish && review.status === 'pending')) {
    void notifyReview(review, invite, prev ? 'changed' : 'new');
  }
  return review;
}

/** На главную: одобренные, с согласием пары, свежие сверху. */
export function publicReviews() {
  return prisma.review.findMany({
    where: { status: 'published', publish: true, rating: { gte: PUBLISH_MIN_RATING }, NOT: { text: '' } },
    orderBy: { updatedAt: 'desc' },
    take: 12,
    select: { names: true, text: true, rating: true, templateId: true },
  });
}

/* ── Telegram: сообщение владельцу и кнопки ─────────────────────────────────── */
const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(5 - n);
const version = (r: Review): string => r.updatedAt.getTime().toString(36);

export function reviewMessage(r: Review, slug: string, kind: 'new' | 'changed', email: string): { text: string; reply_markup?: unknown } {
  const lines = [
    `${kind === 'new' ? '⭐ Новый отзыв' : '✏️ Отзыв изменён'} · ${stars(r.rating)} ${r.rating}/5`,
    `${r.names}${r.templateId ? ` · шаблон ${r.templateId}` : ''}`,
    `${SITE}/${slug}`,
    '',
    r.text ? `«${r.text}»` : '(без текста)',
    '',
  ];
  if (r.rating < PUBLISH_MIN_RATING) lines.push(`⚠️ Низкая оценка — на сайт не попадёт. Стоит написать паре: ${email}`);
  else if (!r.publish) lines.push('Пара не разрешила показывать отзыв на сайте.');
  else if (!r.text) lines.push('Без текста — на сайте показывать нечего.');
  else lines.push('Пара разрешила показать отзыв на сайте.');
  const v = version(r);
  return {
    text: lines.join('\n').slice(0, 4096),
    ...(publishable(r) ? { reply_markup: { inline_keyboard: [[
      { text: '✅ Опубликовать', callback_data: `rv:p:${r.id}:${v}` },
      { text: '🙈 Скрыть', callback_data: `rv:h:${r.id}:${v}` },
    ]] } } : {}),
  };
}

async function notifyReview(r: Review, invite: Invitation, kind: 'new' | 'changed'): Promise<void> {
  try {
    const support = await supportChatId();
    if (!support) { console.error('Отзывы: чат поддержки не найден — отзыв не переслан'); return; }
    const user = await prisma.user.findUnique({ where: { id: invite.userId }, select: { email: true } });
    await telegramApi('sendMessage', { chat_id: support, ...reviewMessage(r, invite.slug, kind, user?.email || '') });
  } catch (e) {
    console.error('Отзывы: не удалось отправить в Telegram:', errName(e));
  }
}

/** Нажатие «Опубликовать» / «Скрыть». Принимается только из чата поддержки и только для той
    версии отзыва, которую владелец видел: изменённый после сообщения отзыв ждёт нового. */
export async function handleReviewCallback(cb: any): Promise<void> {
  const callbackId = typeof cb?.id === 'string' ? cb.id : '';
  const answer = (text: string) => (callbackId ? telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text }) : null);
  const m = /^rv:([ph]):([0-9a-f-]{36}):([0-9a-z]{1,12})$/.exec(typeof cb?.data === 'string' ? cb.data : '');
  const support = await supportChatId();
  const chatId = cb?.message?.chat?.id;
  if (!m || !support || String(chatId) !== support || String(cb?.from?.id) !== support) { await answer(''); return; }

  const [, action, reviewId, ver] = m;
  // Итог дописываем в само сообщение — кнопки при этом исчезают
  const close = (note: string) => telegramApi('editMessageText', {
    chat_id: chatId, message_id: cb.message.message_id,
    text: `${typeof cb.message.text === 'string' ? cb.message.text : ''}\n\n${note}`.slice(0, 4096),
  });
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) { await answer('Отзыва больше нет'); await close('🗑 Отзыва больше нет — сайт удалён'); return; }
  if (version(review) !== ver) { await answer('Отзыв изменили — смотрите новое сообщение'); await close('↻ Отзыв изменили после этого сообщения'); return; }

  if (action === 'p') {
    if (!publishable(review)) { await answer('Этот отзыв публиковать нельзя'); return; }
    const res = await prisma.review.updateMany({ where: { id: review.id, updatedAt: review.updatedAt }, data: { status: 'published' } });
    if (!res.count) { await answer('Отзыв изменили — смотрите новое сообщение'); return; }
    await answer('Опубликован');
    await close('✅ Опубликован на сайте');
  } else {
    await prisma.review.updateMany({ where: { id: review.id }, data: { status: 'hidden' } });
    await answer('Скрыт');
    await close('🙈 Скрыт');
  }
}
