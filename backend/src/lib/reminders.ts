// Напоминание гостям перед свадьбой — тариф «Максимум».
//
// Пара включает его в кабинете. Тогда в анкете у тех, кто ответил «Буду» или «Пока не
// знаю», появляется галочка «Напомнить мне»: гость подключает Telegram
// (t.me/<bot>?start=r_<token>) или оставляет телефон. За 7 дней (пара может выбрать 3 или
// 7 и 1) приходит напоминание: в Telegram — с кнопками «Буду / Не смогу», по SMS — со
// ссылкой /c/<token> на страничку подтверждения. Ответ меняет анкету гостя (отказ снимает
// со стола, как отказ в самой анкете) и приходит паре уведомлением.
//
// Telegram бесплатный и идёт первым; SMS — если Telegram нет или бот заблокирован, и не
// больше smsLimit() на свадьбу. Шлём с 10 до 15 по Москве: в это время день и в
// Калининграде, и во Владивостоке.

import prisma from './prisma';
import { botUsername, telegramApi } from './telegram';
import { sendSms, smsAvailable, smsParts } from './sms';
import { hasGuestReminders, isPaid } from './plans';
import { Attendance, attendanceOf } from './rsvpDetails';
import { notifyOwnerText } from './notify';
import { plannerDenial } from './planner/access';
import { reconcile } from './planner/roster';
import { errName, plural } from './planner/util';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const MSK = 3 * HOUR;
const SITE = (process.env.FRONTEND_URL || 'https://weddingcraft.ru').replace(/\/$/, '');

// ─── Настройки ──────────────────────────────────────────────────────────
export const DAY_OPTIONS = ['7', '3', '7,1'] as const;
export type DaysOption = (typeof DAY_OPTIONS)[number];
export const isDaysOption = (v: unknown): v is DaysOption => typeof v === 'string' && (DAY_OPTIONS as readonly string[]).includes(v);
/** «7,1» → [7, 1] (по убыванию); неизвестное значение — за неделю. */
export const daysOf = (v: string): number[] => (isDaysOption(v) ? v : '7').split(',').map(Number).sort((a, b) => b - a);

/** Сколько SMS можно отправить по одной свадьбе (REMINDER_SMS_LIMIT, по умолчанию 150). */
export function smsLimit(): number {
  const raw = (process.env.REMINDER_SMS_LIMIT || '').trim();
  const n = Number(raw);
  return raw && Number.isInteger(n) && n >= 0 ? n : 150;
}

const SMS_SPENT = ['sent', 'dry'];
const smsSpent = (invitationId: string) =>
  prisma.reminderSend.count({ where: { invitationId, channel: 'sms', status: { in: SMS_SPENT } } });

// ─── Токен и телефон ────────────────────────────────────────────────────
export const TOKEN_RE = /^[A-Za-z0-9]{10,24}$/;

/** Российский мобильный в виде 79XXXXXXXXX; «8 912…», «+7 (912)…», «912…» — тоже. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 40 || /[^\d\s()+.-]/.test(raw)) return null;
  let d = raw.replace(/\D/g, '');
  if (d.length === 10 && d[0] === '9') d = `7${d}`;
  if (d.length === 11 && d[0] === '8') d = `7${d.slice(1)}`;
  return /^79\d{9}$/.test(d) ? d : null;
}

export const formatPhone = (p: string): string =>
  /^7\d{10}$/.test(p) ? `+7 ${p.slice(1, 4)} ${p.slice(4, 7)}-${p.slice(7, 9)}-${p.slice(9)}` : p;

// ─── Даты ───────────────────────────────────────────────────────────────
const moscow = (now: number) => {
  const d = new Date(now + MSK);
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
};

const validDate = (date: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`));

/** Сколько календарных дней до свадьбы по Москве: 0 — сегодня, 1 — завтра. */
export function daysLeft(weddingDate: string, now: number): number | null {
  if (!validDate(weddingDate)) return null;
  const today = Date.parse(`${moscow(now).date}T00:00:00Z`);
  return Math.round((Date.parse(`${weddingDate}T00:00:00Z`) - today) / DAY);
}

/** Какое напоминание пора слать: срок N действует от N дней до следующего срока, но не позже
    чем за день. Так пара, включившая напоминание за 5 дней, всё равно его разошлёт. */
export function dueKind(days: number[], left: number): number | null {
  const sorted = [...days].sort((a, b) => b - a);
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[i + 1] ?? 0;
    if (left <= sorted[i] && left > next && left >= 1) return sorted[i];
  }
  return null;
}

/** Начало дня «за N дней до свадьбы» по Москве. Кто ответил позже, тому это напоминание не
    нужно — он только что отвечал. */
const kindMoment = (weddingDate: string, n: number): number => Date.parse(`${weddingDate}T00:00:00Z`) - MSK - n * DAY;

/** Дата отправки: «2026-06-05». */
export const sendDate = (weddingDate: string, n: number): string =>
  new Date(Date.parse(`${weddingDate}T00:00:00Z`) - n * DAY).toISOString().slice(0, 10);

/** Какое напоминание получит гость, который отвечает сейчас: ближайший срок, который ещё
    впереди. Те, что уже наступили, достаются только ответившим раньше. */
export function nextKind(weddingDate: string, days: number[], now: number): number | null {
  const left = daysLeft(weddingDate, now);
  return left === null ? null : days.find((n) => left > n) ?? null;
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];

/** «12 июня» */
export function dayMonth(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
const weekday = (date: string): string => WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
const shortDate = (date: string): string => `${date.slice(8, 10)}.${date.slice(5, 7)}`;
const timeOf = (t: string): string => (/^\d{1,2}:\d{2}$/.test(t || '') ? t : '');

/** «за неделю», «за 3 дня», «за день» */
export function beforeWords(n: number): string {
  if (n === 7) return 'за неделю';
  if (n === 1) return 'за день';
  return `за ${n} ${plural(n, 'день', 'дня', 'дней')}`;
}

const peopleWord = (n: number) => `${n} ${plural(n, 'человек', 'человека', 'человек')}`;

// ─── Тексты ─────────────────────────────────────────────────────────────
interface InviteText {
  slug: string; groomName: string; brideName: string; weddingDate: string; weddingTime: string;
  venue: string; venueAddress: string;
}

const coupleOf = (i: { groomName: string; brideName: string }): string =>
  [i.groomName, i.brideName].map((s) => (s || '').trim()).filter(Boolean).join(' и ');

const confirmUrl = (token: string) => `${SITE}/c/${token}`;
const siteUrl = (slug: string, guestToken?: string | null) =>
  `${SITE}/${slug}${guestToken ? `?g=${encodeURIComponent(guestToken)}` : ''}`;

/** SMS — в одну часть (70 знаков), если получится: длинная стоит вдвое дороже. */
export function smsText(inv: InviteText, kind: number, status: Attendance, token: string): string {
  const url = confirmUrl(token).replace(/^https?:\/\//, '');
  const names = coupleOf(inv);
  const date = shortDate(inv.weddingDate);
  const time = timeOf(inv.weddingTime);
  const variants = kind === 1
    ? [names && time && `${names} ждут вас завтра в ${time}. Адрес: ${url}`, names && `${names} ждут вас завтра. Адрес: ${url}`,
      time && `Свадьба завтра в ${time}. Адрес: ${url}`, `Свадьба завтра. Адрес: ${url}`]
    : status === 'maybe'
      ? [names && `${names} ждут ответа: придёте ${date}? ${url}`, `Свадьба ${date}: вы придёте? ${url}`]
      : [names && time && `${names} ждут вас ${date} в ${time}. Придёте? ${url}`, names && `${names} ждут вас ${date}. Придёте? ${url}`,
        `Свадьба ${date}: вы придёте? ${url}`];
  const list = variants.filter((v): v is string => !!v);
  return list.find((t) => smsParts(t) === 1) || list[list.length - 1];
}

type Button = { text: string; url?: string; callback_data?: string };

export function telegramMessage(inv: InviteText, kind: number, status: Attendance, token: string, guestName: string, guestToken?: string | null): { text: string; buttons: Button[][] } {
  const names = coupleOf(inv) || 'Молодожёны';
  const time = timeOf(inv.weddingTime);
  const when = `${dayMonth(inv.weddingDate)}, ${weekday(inv.weddingDate)}${time ? `, в ${time}` : ''}`;
  const place = [inv.venue, inv.venueAddress].map((s) => (s || '').trim()).filter(Boolean).join(', ');
  const hello = guestName.trim() ? `Здравствуйте, ${guestName.trim()}!` : 'Здравствуйте!';
  const site: Button = { text: 'Открыть приглашение', url: siteUrl(inv.slug, guestToken) };
  const pin = place ? `\n📍 ${place}` : '';
  if (kind === 1) {
    return {
      text: `${hello}\n\nЗавтра свадьба: ${names} ждут вас${time ? ` в ${time}` : ''}.${pin}\n\nДо встречи!`,
      buttons: [[site], [{ text: 'Планы изменились', callback_data: `rm:n:${token}` }]],
    };
  }
  const ask = status === 'maybe'
    ? `${names} ждут вашего ответа: вы придёте на свадьбу ${when}?${pin}\n\nОтветьте, пожалуйста, — молодожёнам важно заранее знать, сколько будет гостей.`
    : `Напоминаем: ${names} ждут вас на свадьбе ${when}.${pin}\n\nВы придёте? Молодожёнам важно знать точное число гостей.`;
  return {
    text: `${hello}\n\n${ask}`,
    buttons: [[{ text: '✅ Буду', callback_data: `rm:y:${token}` }, { text: '❌ Не смогу', callback_data: `rm:n:${token}` }], [site]],
  };
}

// ─── Для страницы сайта ─────────────────────────────────────────────────
export interface PublicReminders { days: number; sms: boolean; tg: string }

/** Что анкета предлагает гостю (wcRemind в данных страницы). null — галочки нет. Не бросает. */
export async function publicReminders(invite: { id: string; plan: string; weddingDate: string }): Promise<PublicReminders | null> {
  try {
    if (!hasGuestReminders(invite.plan) || !validDate(invite.weddingDate)) return null;
    const s = await prisma.reminderSettings.findUnique({ where: { invitationId: invite.id } });
    if (!s?.enabled) return null;
    // Срок для нового ответа уже прошёл — обещать напоминание нечего
    const kind = nextKind(invite.weddingDate, daysOf(s.days), Date.now());
    if (!kind) return null;
    const tg = process.env.TELEGRAM_BOT_TOKEN ? botUsername() : '';
    const sms = smsAvailable() && (await smsSpent(invite.id)) < smsLimit();
    if (!tg && !sms) return null;
    return { days: kind, sms, tg };
  } catch {
    return null;
  }
}

// ─── Из анкеты ──────────────────────────────────────────────────────────
export interface RemindInput { token: string; phone: string | null }

/** Поле remind анкеты: объект — гость попросил напомнить; false — снял галочку;
    undefined — страница без напоминаний (или поле испорчено: ответ анкеты всё равно примем). */
export function parseRemind(raw: unknown): RemindInput | false | undefined {
  if (raw === false) return false;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.token !== 'string' || !TOKEN_RE.test(r.token)) return undefined;
  return { token: r.token, phone: normalizePhone(r.phone) };
}

async function remindersOpen(invite: { id: string; plan: string }): Promise<{ days: number[] } | null> {
  if (!hasGuestReminders(invite.plan)) return null;
  const s = await prisma.reminderSettings.findUnique({ where: { invitationId: invite.id } });
  return s?.enabled ? { days: daysOf(s.days) } : null;
}

/** Строка для уведомления паре: «в Telegram», «по SMS, +7 …». */
const channelNote = (r: { telegramChatId: string; phone: string }): string =>
  r.telegramChatId ? 'в Telegram' : r.phone ? `по SMS, ${formatPhone(r.phone)}` : '';

/**
 * Сохранить просьбу напомнить после того, как ответ анкеты записан. Прежнее напоминание
 * гостя с персональной ссылкой rsvp.ts уже перевесил на новый ответ — здесь его обновляем.
 * Возвращает строку для уведомления паре (или '').
 */
export async function saveReminder(
  invite: { id: string; plan: string; slug: string; groomName: string; brideName: string; weddingDate: string },
  response: { id: string },
  status: Attendance,
  input: RemindInput | false | undefined,
): Promise<string> {
  const prev = await prisma.guestReminder.findUnique({ where: { responseId: response.id } });
  const open = input !== undefined && status !== 'no' ? await remindersOpen(invite) : null;

  // Старая страница без галочки: прежняя просьба остаётся, но ответ на неё обнулён — анкета новее
  if (input === undefined) {
    if (prev && status === 'no') await prisma.guestReminder.delete({ where: { id: prev.id } }).catch(() => {});
    else if (prev) await prisma.guestReminder.update({ where: { id: prev.id }, data: { answer: '', answeredAt: null } }).catch(() => {});
    return prev && status !== 'no' ? channelNote(prev) : '';
  }
  // Снял галочку, отказался или пара выключила напоминания — телефон и чат больше не храним
  if (!input || !open) {
    if (prev) await prisma.guestReminder.delete({ where: { id: prev.id } }).catch(() => {});
    return '';
  }

  const phone = input.phone && smsAvailable() ? input.phone : '';
  const byToken = await prisma.guestReminder.findUnique({ where: { token: input.token } });
  if (byToken && byToken.invitationId && byToken.invitationId !== invite.id) return '';   // токен другого сайта
  const wasWaiting = !!byToken && !byToken.responseId && !!byToken.telegramChatId;       // Telegram подключили до анкеты
  const chat = byToken?.telegramChatId || prev?.telegramChatId || '';
  const data = { invitationId: invite.id, responseId: response.id, phone, telegramChatId: chat, answer: '', answeredAt: null };

  let row;
  if (byToken && byToken.id !== prev?.id) {
    if (prev) await prisma.guestReminder.delete({ where: { id: prev.id } });
    row = await prisma.guestReminder.update({ where: { id: byToken.id }, data });
  } else if (prev) {
    // Тот же гость с новой страницы: токен — новый, по нему Telegram найдёт напоминание
    row = await prisma.guestReminder.update({ where: { id: prev.id }, data: { ...data, token: input.token } });
  } else {
    row = await prisma.guestReminder.create({ data: { token: input.token, ...data } });
  }

  if (wasWaiting && row.telegramChatId) {
    void telegramApi('sendMessage', { chat_id: row.telegramChatId, text: `✅ Анкета получена! ${remindPromise(invite, open.days)}` });
  }
  return channelNote(row);
}

/** «Напомним о свадьбе за неделю — 5 июня. Денис и Мария ждут вас!» */
function remindPromise(inv: { groomName: string; brideName: string; weddingDate: string }, days: number[]): string {
  const names = coupleOf(inv);
  const kind = nextKind(inv.weddingDate, days, Date.now());
  const when = kind ? `${beforeWords(kind)} — ${dayMonth(sendDate(inv.weddingDate, kind))}` : 'заранее';
  return `Напомним о свадьбе ${when}.${names ? ` ${names} ждут вас!` : ''}`;
}

// ─── Telegram ───────────────────────────────────────────────────────────
/** /start r_<token>: гость подключил Telegram из анкеты — до или после отправки. */
export async function handleReminderStart(chatId: number, token: string): Promise<void> {
  const chat = String(chatId);
  let row = await prisma.guestReminder.findUnique({ where: { token }, include: { invitation: true } });
  if (!row) {
    try {
      row = await prisma.guestReminder.create({ data: { token, telegramChatId: chat }, include: { invitation: true } });
    } catch {
      row = await prisma.guestReminder.findUnique({ where: { token }, include: { invitation: true } });
    }
  } else if (row.telegramChatId !== chat) {
    row = await prisma.guestReminder.update({ where: { id: row.id }, data: { telegramChatId: chat }, include: { invitation: true } });
  }
  const inv = row?.invitation;
  if (row?.responseId && inv) {
    const open = await remindersOpen(inv);
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: `✅ Готово! ${remindPromise(inv, open?.days || [7])} Ответить можно будет прямо здесь.`,
    });
  } else {
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: '✅ Telegram подключён. Вернитесь на сайт приглашения и отправьте анкету — мы напомним о свадьбе заранее.',
    });
  }
}

/** Кнопки под напоминанием: rm:y — буду, rm:n — «не смогу» (спросим ещё раз), rm:N — точно не смогу. */
export async function handleReminderCallback(cb: any): Promise<void> {
  const callbackId = typeof cb?.id === 'string' ? cb.id : '';
  const answer = (text: string) => (callbackId ? telegramApi('answerCallbackQuery', { callback_query_id: callbackId, text }) : null);
  const m = /^rm:([ynN]):([A-Za-z0-9]{10,24})$/.exec(typeof cb?.data === 'string' ? cb.data : '');
  const chatId = cb?.message?.chat?.id;
  const row = m ? await prisma.guestReminder.findUnique({ where: { token: m[2] } }) : null;
  if (!m || !row || !row.telegramChatId || String(chatId) !== row.telegramChatId || String(cb?.from?.id) !== row.telegramChatId) {
    await answer('');
    return;
  }
  const [, action, token] = m;
  const messageId = cb.message.message_id;
  // Ссылка «Открыть приглашение» остаётся, кнопки ответа уходят
  const links = (Array.isArray(cb.message?.reply_markup?.inline_keyboard) ? cb.message.reply_markup.inline_keyboard : [])
    .map((r: Button[]) => (Array.isArray(r) ? r.filter((b) => b && typeof b.url === 'string') : []))
    .filter((r: Button[]) => r.length);
  const close = (note: string) => telegramApi('editMessageText', {
    chat_id: chatId, message_id: messageId,
    text: `${typeof cb.message.text === 'string' ? cb.message.text : ''}\n\n${note}`.slice(0, 4096),
    reply_markup: { inline_keyboard: links },
  });

  if (action === 'n') {
    await telegramApi('editMessageReplyMarkup', {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: 'Да, не смогу', callback_data: `rm:N:${token}` }, { text: 'Нет, я приду', callback_data: `rm:y:${token}` }], ...links] },
    });
    await answer('Точно не сможете прийти?');
    return;
  }
  const res = await answerReminder(token, action === 'y' ? 'yes' : 'no');
  if (!res.ok) {
    await answer(res.error === 'past' ? 'Свадьба уже прошла' : 'Ответ больше не принимается');
    return;
  }
  if (action === 'y') {
    await answer('Спасибо!');
    await close('✅ Вы ответили: буду. Ждём вас!');
  } else {
    await answer('Передали молодожёнам');
    await close('❌ Вы ответили: не смогу. Мы передали молодожёнам.');
  }
}

// ─── Ответ гостя ────────────────────────────────────────────────────────
export type ReminderResult =
  | { ok: true; attendance: Attendance; guestsCount: number }
  | { ok: false; error: 'not_found' | 'past' };

/** «Буду» / «Не смогу» на напоминание (Telegram или страничка /c/). Меняет ответ анкеты. */
export async function answerReminder(token: string, answer: 'yes' | 'no', count?: number | null): Promise<ReminderResult> {
  const row = await prisma.guestReminder.findUnique({ where: { token }, include: { response: true, invitation: true } });
  const inv = row?.invitation, resp = row?.response;
  if (!row || !inv || !resp || !isPaid(inv.status)) return { ok: false, error: 'not_found' };
  const left = daysLeft(inv.weddingDate, Date.now());
  if (left !== null && left < 0) return { ok: false, error: 'past' };

  const before = attendanceOf(resp);
  const people = answer === 'yes' && Number.isInteger(count) ? Math.min(20, Math.max(1, count as number)) : resp.guestsCount;
  const changed = before !== answer || people !== resp.guestsCount;
  await prisma.$transaction([
    prisma.guestReminder.update({ where: { id: row.id }, data: { answer, answeredAt: new Date() } }),
    ...(changed ? [prisma.guestResponse.update({
      where: { id: resp.id },
      data: { attendance: answer, attending: answer === 'yes', guestsCount: people, childrenCount: Math.min(resp.childrenCount, people - 1) },
    })] : []),
  ]);

  if (changed) {
    // Состав за столами — как при новой анкете; сбой не отменяет ответ гостя
    try {
      if (!(await plannerDenial(inv))) {
        const { unseated } = await reconcile(inv.id, resp.guestId ? `g:${resp.guestId}` : `r:${resp.id}`);
        for (const u of unseated) void notifyOwnerText(inv, 'Рассадка: освободилось место', [u.text]);
      }
    } catch (e) {
      console.error('Напоминание: не удалось обновить состав гостей:', errName(e));
    }
    const line = answer === 'no'
      ? `❌ ${resp.guestName}: планы изменились — не придёт${resp.guestsCount > 1 ? ` (было ${peopleWord(resp.guestsCount)})` : ''}`
      : before === 'yes'
        ? `✅ ${resp.guestName}: придут ${peopleWord(people)} (было ${peopleWord(resp.guestsCount)})`
        : `✅ ${resp.guestName} теперь точно придёт${people > 1 ? ` — ${peopleWord(people)}` : ''}`;
    void notifyOwnerText(inv, `Ответ на напоминание: ${resp.guestName}`, [`Ответ на напоминание (${coupleOf(inv) || 'ваша свадьба'})`, '', line]);
  }
  return { ok: true, attendance: answer, guestsCount: people };
}

/** Для странички /c/<token>. null — нет такого напоминания. */
export async function reminderPage(token: string) {
  const row = await prisma.guestReminder.findUnique({
    where: { token },
    include: { response: true, invitation: true },
  });
  const inv = row?.invitation, resp = row?.response;
  if (!row || !inv || !resp || !isPaid(inv.status)) return null;
  const guest = resp.guestId ? await prisma.guest.findUnique({ where: { id: resp.guestId }, select: { token: true } }) : null;
  const left = daysLeft(inv.weddingDate, Date.now());
  return {
    guestName: resp.guestName,
    groomName: inv.groomName, brideName: inv.brideName,
    weddingDate: validDate(inv.weddingDate) ? inv.weddingDate : '', weddingTime: timeOf(inv.weddingTime),
    venue: inv.venue, venueAddress: inv.venueAddress,
    siteUrl: siteUrl(inv.slug, guest?.token),
    attendance: attendanceOf(resp), guestsCount: resp.guestsCount, answer: row.answer,
    past: left !== null && left < 0,
  };
}

// ─── Для кабинета ───────────────────────────────────────────────────────
export async function reminderOverview(invite: InviteText & { id: string; plan: string }) {
  const s = await prisma.reminderSettings.findUnique({ where: { invitationId: invite.id } });
  const days = s?.days && isDaysOption(s.days) ? s.days : '7';
  const rows = await prisma.guestReminder.findMany({
    where: { invitationId: invite.id, responseId: { not: null } },
    select: { phone: true, telegramChatId: true, answer: true, response: { select: { attendance: true, attending: true } } },
  });
  const live = rows.filter((r) => r.response && attendanceOf(r.response) !== 'no');
  const sends = await prisma.reminderSend.groupBy({ by: ['kind', 'channel', 'status'], where: { invitationId: invite.id }, _count: { _all: true } });
  const date = validDate(invite.weddingDate) ? invite.weddingDate : '';
  const left = date ? daysLeft(date, Date.now()) : null;
  return {
    enabled: !!s?.enabled,
    days,
    weddingDate: date,
    daysLeft: left,
    channels: { telegram: !!(process.env.TELEGRAM_BOT_TOKEN && botUsername()), sms: smsAvailable() },
    sms: { limit: smsLimit(), spent: sends.filter((x) => x.channel === 'sms' && SMS_SPENT.includes(x.status)).reduce((n, x) => n + x._count._all, 0) },
    stats: {
      total: live.length,
      telegram: live.filter((r) => r.telegramChatId).length,
      sms: live.filter((r) => !r.telegramChatId && r.phone).length,
      waiting: live.filter((r) => !r.telegramChatId && !r.phone).length,
      confirmed: rows.filter((r) => r.answer === 'yes').length,
      declined: rows.filter((r) => r.answer === 'no').length,
    },
    schedule: daysOf(days).map((n) => ({
      kind: n,
      date: date ? sendDate(date, n) : '',
      sent: sends.filter((x) => x.kind === `d${n}` && ['sent', 'dry'].includes(x.status)).reduce((k, x) => k + x._count._all, 0),
    })),
    preview: date ? {
      telegram: telegramMessage(invite, daysOf(days)[0], 'yes', 'XXXXXXXXXX', 'Анна').text,
      sms: smsText(invite, daysOf(days)[0], 'yes', 'Ab3dE7xK2q'),
    } : null,
  };
}

export async function saveReminderSettings(invitationId: string, enabled: boolean, days: DaysOption): Promise<void> {
  await prisma.reminderSettings.upsert({
    where: { invitationId },
    create: { invitationId, enabled, days },
    update: { enabled, days },
  });
}

// ─── Рассылка по расписанию ─────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SendInvite extends InviteText {
  id: string; userId: string; plan: string; status: string;
  notifyChannel: string; notifyEmail: string; notifyTelegramChatId: string;
}

async function deliverOne(
  inv: SendInvite, r: { id: string; token: string; phone: string; telegramChatId: string },
  resp: { guestName: string; guestId: string | null }, status: Attendance, kind: number,
): Promise<{ channel: string; status: string }> {
  if (r.telegramChatId) {
    const guest = resp.guestId ? await prisma.guest.findUnique({ where: { id: resp.guestId }, select: { token: true } }) : null;
    const msg = telegramMessage(inv, kind, status, r.token, resp.guestName, guest?.token);
    const res = await telegramApi('sendMessage', {
      chat_id: r.telegramChatId, text: msg.text,
      reply_markup: { inline_keyboard: msg.buttons },
      link_preview_options: { is_disabled: true },
    });
    if (res?.ok) return { channel: 'telegram', status: 'sent' };
    // 403 — гость остановил бота: в Telegram больше не пишем, остаётся SMS
    if (res?.error_code === 403) await prisma.guestReminder.update({ where: { id: r.id }, data: { telegramChatId: '' } }).catch(() => {});
  }
  if (r.phone) {
    if (!smsAvailable()) return { channel: 'sms', status: 'failed' };
    if ((await smsSpent(inv.id)) >= smsLimit()) return { channel: 'sms', status: 'limit' };
    const res = await sendSms(r.phone, smsText(inv, kind, status, r.token));
    return { channel: 'sms', status: res.ok ? (res.dry ? 'dry' : 'sent') : 'failed' };
  }
  return { channel: r.telegramChatId ? 'telegram' : 'none', status: 'failed' };
}

async function sendFor(inv: SendInvite, kind: number): Promise<void> {
  const point = kindMoment(inv.weddingDate, kind);
  const rows = await prisma.guestReminder.findMany({
    where: { invitationId: inv.id, responseId: { not: null }, answer: { not: 'no' }, sends: { none: { kind: `d${kind}` } } },
    include: { response: { select: { guestName: true, attendance: true, attending: true, createdAt: true, guestId: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const tally = { telegram: 0, sms: 0, failed: 0 };
  for (const r of rows) {
    const resp = r.response;
    if (!resp || (!r.telegramChatId && !r.phone)) continue;
    const status = attendanceOf(resp);
    if (status === 'no' || (status === 'maybe' && kind === 1)) continue;
    if (resp.createdAt.getTime() >= point) continue;
    // Сначала отметка (уникальный ключ): два прохода одно напоминание не отправят
    let mark;
    try {
      mark = await prisma.reminderSend.create({ data: { reminderId: r.id, invitationId: inv.id, kind: `d${kind}`, channel: 'none', status: 'pending' } });
    } catch { continue; }
    const result = await deliverOne(inv, r, resp, status, kind);
    await prisma.reminderSend.update({ where: { id: mark.id }, data: result });
    if (result.status === 'sent' || result.status === 'dry') tally[result.channel === 'sms' ? 'sms' : 'telegram'] += 1;
    else tally.failed += 1;
    await sleep(60);   // Telegram и SMS Aero не любят очередь в десятки сообщений за секунду
  }
  const sent = tally.telegram + tally.sms;
  if (sent) {
    const parts = [tally.telegram && `в Telegram — ${tally.telegram}`, tally.sms && `по SMS — ${tally.sms}`].filter(Boolean).join(', ');
    void notifyOwnerText(inv, 'Гостям отправлено напоминание', [
      `🔔 Напоминание о свадьбе отправлено ${sent} ${plural(sent, 'гостю', 'гостям', 'гостям')} (${parts}).`,
      ...(tally.failed ? [`Не доставлено: ${tally.failed}.`] : []),
      'Если кто-то ответит «Не смогу» или изменит число гостей — сообщим сюда.',
    ]);
    console.log(`🔔 Напоминания ${beforeWords(kind)}: отправлено ${sent}, не доставлено ${tally.failed}`);
  }
}

export async function runReminders(now = Date.now()): Promise<void> {
  // Telegram подключили, а анкету так и не отправили — через трое суток забываем
  await prisma.guestReminder.deleteMany({ where: { responseId: null, createdAt: { lt: new Date(now - 3 * DAY) } } });
  const { hour } = moscow(now);
  if (hour < 10 || hour >= 15) return;
  const list = await prisma.reminderSettings.findMany({
    where: { enabled: true },
    include: { invitation: { select: {
      id: true, userId: true, slug: true, plan: true, status: true, groomName: true, brideName: true, weddingDate: true, weddingTime: true,
      venue: true, venueAddress: true, notifyChannel: true, notifyEmail: true, notifyTelegramChatId: true,
    } } },
  });
  for (const s of list) {
    const inv = s.invitation;
    if (!isPaid(inv.status) || !hasGuestReminders(inv.plan)) continue;
    const left = daysLeft(inv.weddingDate, now);
    const kind = left === null ? null : dueKind(daysOf(s.days), left);
    if (kind) await sendFor(inv, kind);
  }
}

/** Проход раз в 15 минут. На проде всегда (REMINDERS=off выключает), на разработке — по REMINDERS=on. */
export function startReminders(): void {
  const flag = (process.env.REMINDERS || '').toLowerCase();
  if (flag === 'off') return;
  if (flag !== 'on' && process.env.NODE_ENV !== 'production') return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runReminders(); }
    catch (e) { console.error('Напоминания гостям: ошибка прохода:', errName(e)); }
    finally { running = false; }
  };
  setTimeout(tick, 2 * 60_000);
  setInterval(tick, 15 * 60_000).unref();
  console.log('🔔 Напоминания гостям включены (проход раз в 15 минут)');
}
