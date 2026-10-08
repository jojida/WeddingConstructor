// Серия писем после регистрации: помогает довести приглашение до гостей и
// рассказывает, что даёт платный тариф. Всё о собственном сайте человека —
// напоминания и подсказки, без скидок и посторонней рекламы. В каждом письме
// ссылка отписки (и заголовок List-Unsubscribe для кнопки в почтовике).
//
// Письма:
//   draft_24h  — черновик не опубликован сутки (и других опубликованных нет);
//   free_1d    — через день после бесплатной публикации: анкета и ответы в Telegram;
//   free_4d    — через 4 дня: карта, программа, дресс-код;
//   date_90    — до свадьбы ~3 месяца: пора рассылать (любой опубликованный сайт);
//   date_60    — до свадьбы ~2 месяца, бесплатный тариф: успеть собрать ответы.
//
// Бесплатная публикация не хранит дату, поэтому отсчёт free_* ведётся от
// служебной отметки «mark:free_seen» — её ставит первый проход, увидевший сайт.
// Окна «не старше N дней» не дают разослать письма давним пользователям
// разом при первом запуске. Не чаще одного письма в 20 часов на человека.

import crypto from 'crypto';
import prisma from './prisma';
import { isEmailConfigured, sendEmail } from './email';
import { escapeHtml, jwtSecret } from './security';
import { isFreeAccount } from './freeAccounts';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const SITE = (process.env.FRONTEND_URL || 'https://weddingcraft.ru').replace(/\/$/, '');
const API = (process.env.BACKEND_URL || 'https://api.weddingcraft.ru').replace(/\/$/, '');
const MAX_PER_RUN = 60;

type Kind = 'draft_24h' | 'free_1d' | 'free_4d' | 'date_90' | 'date_60';

// ─── Отписка ────────────────────────────────────────────────────────────
export function unsubscribeToken(userId: string): string {
  return crypto.createHmac('sha256', jwtSecret()).update(`unsubscribe:${userId}`).digest('hex').slice(0, 32);
}
export function checkUnsubscribeToken(userId: string, token: string): boolean {
  const expected = Buffer.from(unsubscribeToken(userId));
  const got = Buffer.from(String(token));
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}
const unsubscribeUrl = (userId: string) =>
  `${API}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;

// ─── Шаблон письма ──────────────────────────────────────────────────────
interface Letter { subject: string; title: string; paragraphs: string[]; cta: string; url: string }

function render(letter: Letter, userId: string): { text: string; html: string } {
  const unsub = unsubscribeUrl(userId);
  const text = [
    letter.title, '',
    ...letter.paragraphs.flatMap(p => [p, '']),
    `${letter.cta}: ${letter.url}`, '',
    '—',
    'Вы получили письмо, потому что создали приглашение на weddingcraft.ru.',
    `Отписаться: ${unsub}`,
  ].join('\n');
  const html = `<!doctype html><html lang="ru"><body style="margin:0;background:#f6f1ea;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#3a3631">
<div style="max-width:520px;margin:0 auto;background:#fffdf9;border:1px solid #ece3d4;border-radius:18px;padding:34px 30px">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#2b2925;margin-bottom:22px">WeddingCraft</div>
<h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;line-height:1.3;color:#2b2925;margin:0 0 16px">${escapeHtml(letter.title)}</h1>
${letter.paragraphs.map(p => `<p style="font-size:15px;line-height:1.65;margin:0 0 14px">${escapeHtml(p)}</p>`).join('\n')}
<p style="margin:24px 0 6px"><a href="${escapeHtml(letter.url)}" style="display:inline-block;background:#364350;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 26px;border-radius:999px">${escapeHtml(letter.cta)}</a></p>
</div>
<p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#9a9285;text-align:center">
Вы получили письмо, потому что создали приглашение на weddingcraft.ru.<br>
<a href="${escapeHtml(unsub)}" style="color:#9a9285">Отписаться от таких писем</a> — уведомления об ответах гостей продолжат приходить.
</p></body></html>`;
  return { text, html };
}

interface InviteRow { id: string; userId: string; slug: string; plan: string; groomName: string; brideName: string }

const couple = (i: InviteRow) => [i.groomName, i.brideName].filter(Boolean).join(' и ');
const editorUrl = (i: InviteRow) => `${SITE}/editor?id=${encodeURIComponent(i.id)}&utm_source=email&utm_medium=lifecycle`;
const upgradeUrl = (i: InviteRow, kind: Kind) =>
  `${SITE}/payment?id=${encodeURIComponent(i.id)}&plan=premium&utm_source=email&utm_medium=lifecycle&utm_campaign=${kind}`;

function letterFor(kind: Kind, i: InviteRow): Letter {
  const site = `${SITE}/${i.slug}`;
  const names = couple(i);
  switch (kind) {
    case 'draft_24h':
      return {
        subject: 'Ваше приглашение почти готово',
        title: names ? `${names}, приглашение почти готово` : 'Ваше приглашение почти готово',
        paragraphs: [
          'Вы начали приглашение на WeddingCraft, но ещё не опубликовали его.',
          'Осталось проверить имена, дату и фото — и можно отправлять ссылку гостям. Опубликовать сайт можно бесплатно.',
        ],
        cta: 'Продолжить приглашение', url: editorUrl(i),
      };
    case 'free_1d':
      return {
        subject: 'Как узнать, кто придёт на свадьбу',
        title: 'Как узнать, кто придёт — без обзвона',
        paragraphs: [
          `Ваш сайт уже работает: ${site}`,
          'Добавьте в него анкету — гости за минуту отметят, придут ли, сколько их и что будут пить. Каждый ответ сразу придёт вам в Telegram или на почту, а в кабинете будет общий список.',
          'Всё появится на этом же сайте, ссылка для гостей не изменится. Тариф «Премиум» — 2 490 ₽ разово, без подписки.',
        ],
        cta: 'Подключить анкету', url: upgradeUrl(i, kind),
      };
    case 'free_4d':
      return {
        subject: 'Что гости спрашивают перед свадьбой',
        title: '«Где это? Во сколько? Что надеть?»',
        paragraphs: [
          'Обычно перед свадьбой эти вопросы приходят в личку десятками.',
          'В приглашении можно сразу показать карту проезда, программу дня и дресс-код с палитрой — гости найдут ответы сами, а вы сэкономите вечер переписок.',
        ],
        cta: 'Добавить карту и программу', url: upgradeUrl(i, kind),
      };
    case 'date_90':
      return i.plan === 'free' ? {
        subject: 'До свадьбы три месяца — пора приглашать гостей',
        title: 'До свадьбы три месяца',
        paragraphs: [
          'Обычно приглашения рассылают за 2–3 месяца — самое время.',
          'Совет: отправьте ссылку в общий семейный чат и лично самым важным гостям. С тарифом «Премиум» у каждого гостя будет своя ссылка с обращением по имени, а ответы соберутся в одном списке.',
        ],
        cta: 'Подготовить рассылку', url: upgradeUrl(i, kind),
      } : {
        subject: 'До свадьбы три месяца — пора приглашать гостей',
        title: 'До свадьбы три месяца',
        paragraphs: [
          'Обычно приглашения рассылают за 2–3 месяца — самое время.',
          'Добавьте гостей в кабинете: у каждого будет своя ссылка с обращением по имени, и вы увидите, кто уже ответил.',
        ],
        cta: 'Открыть список гостей', url: `${SITE}/dashboard/${encodeURIComponent(i.id)}?utm_source=email&utm_medium=lifecycle&utm_campaign=${kind}`,
      };
    case 'date_60':
      return {
        subject: 'Два месяца до свадьбы: успейте собрать ответы',
        title: 'Два месяца до свадьбы',
        paragraphs: [
          'Скоро понадобится точное число гостей — для банкета, рассадки и меню.',
          'Анкета в приглашении соберёт ответы за вас: кто придёт, с кем, будут ли дети, что пьют. Ответы приходят сразу в Telegram или на почту.',
        ],
        cta: 'Подключить анкету', url: upgradeUrl(i, kind),
      };
  }
}

// ─── Отбор и отправка ───────────────────────────────────────────────────
const daysUntil = (date: string, now: number): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = Date.parse(`${date}T12:00:00Z`);
  return Number.isNaN(t) ? null : Math.round((t - now) / DAY);
};

async function recentlyEmailed(userId: string, now: number): Promise<boolean> {
  const last = await prisma.emailEvent.findFirst({
    where: { userId, sentAt: { gt: new Date(now - 20 * HOUR) }, NOT: { kind: { startsWith: 'mark:' } } },
    select: { id: true },
  });
  return !!last;
}

const already = async (invitationId: string, kind: string) =>
  !!(await prisma.emailEvent.findUnique({ where: { invitationId_kind: { invitationId, kind } }, select: { id: true } }));

let sentThisRun = 0;

/** Отправить письмо, если человек не отписан, не тестовый и не получал писем сутки. */
async function deliver(kind: Kind, i: InviteRow, user: { email: string; emailOptOut: boolean }, now: number): Promise<void> {
  if (sentThisRun >= MAX_PER_RUN) return;
  if (user.emailOptOut || isFreeAccount(user.email)) return;
  if (await already(i.id, kind)) return;
  if (await recentlyEmailed(i.userId, now)) return;
  // Сначала отметка (уникальный ключ) — два прохода одно письмо не отправят.
  try {
    await prisma.emailEvent.create({ data: { userId: i.userId, invitationId: i.id, kind } });
  } catch { return; }
  sentThisRun += 1;
  const letter = letterFor(kind, i);
  const { text, html } = render(letter, i.userId);
  try {
    await sendEmail({
      to: user.email, subject: letter.subject, text, html,
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl(i.userId)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
    console.log(`✉️ Серия писем: ${kind} отправлено`);
  } catch (e) {
    // Повтор не делаем: лучше потерять одно письмо, чем слать его по кругу.
    console.error(`Серия писем: ${kind} не отправлено:`, (e as Error).message);
  }
}

const SELECT = {
  id: true, userId: true, slug: true, plan: true, groomName: true, brideName: true, weddingDate: true, status: true, createdAt: true,
  user: { select: { email: true, emailOptOut: true } },
} as const;

export async function runLifecycleEmails(now = Date.now()): Promise<void> {
  sentThisRun = 0;

  // 1. Черновик лежит сутки (но не дольше недели) и опубликованных сайтов нет.
  const drafts = await prisma.invitation.findMany({
    where: { status: 'draft', createdAt: { lte: new Date(now - DAY), gte: new Date(now - 7 * DAY) } },
    select: SELECT, orderBy: { createdAt: 'asc' }, take: 300,
  });
  for (const d of drafts) {
    const published = await prisma.invitation.count({ where: { userId: d.userId, status: { in: ['paid', 'published'] } } });
    if (published) continue;
    const draftMailed = await prisma.emailEvent.findFirst({ where: { userId: d.userId, kind: 'draft_24h' }, select: { id: true } });
    if (draftMailed) continue;
    await deliver('draft_24h', d, d.user, now);
  }

  // 2. Бесплатно опубликованные: отметка «увидели», затем письма через 1 и 4 дня.
  const frees = await prisma.invitation.findMany({ where: { status: 'published', plan: 'free' }, select: SELECT, take: 1000 });
  for (const f of frees) {
    const mark = await prisma.emailEvent.findUnique({ where: { invitationId_kind: { invitationId: f.id, kind: 'mark:free_seen' } } });
    if (!mark) {
      await prisma.emailEvent.create({ data: { userId: f.userId, invitationId: f.id, kind: 'mark:free_seen' } }).catch(() => {});
      continue;
    }
    const age = now - mark.sentAt.getTime();
    if (age >= 4 * DAY && age < 10 * DAY) await deliver('free_4d', f, f.user, now);
    else if (age >= DAY && age < 6 * DAY) await deliver('free_1d', f, f.user, now);
  }

  // 3. По дате свадьбы — у опубликованных сайтов.
  const live = await prisma.invitation.findMany({
    where: { status: { in: ['paid', 'published'] }, weddingDate: { not: '' } }, select: SELECT, take: 2000,
  });
  for (const l of live) {
    const left = daysUntil(l.weddingDate, now);
    if (left === null) continue;
    if (left >= 84 && left <= 90) await deliver('date_90', l, l.user, now);
    else if (left >= 54 && left <= 60 && l.plan === 'free') await deliver('date_60', l, l.user, now);
  }
}

/** Запуск по расписанию: раз в 30 минут. Только на проде с настроенной почтой
    (или LIFECYCLE_EMAILS=on); LIFECYCLE_EMAILS=off выключает совсем. */
export function startLifecycleEmails(): void {
  const flag = (process.env.LIFECYCLE_EMAILS || '').toLowerCase();
  if (flag === 'off') return;
  if (flag !== 'on' && process.env.NODE_ENV !== 'production') return;
  if (!isEmailConfigured()) { console.log('✉️ Серия писем выключена: почта не настроена'); return; }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runLifecycleEmails(); }
    catch (e) { console.error('Серия писем: ошибка прохода:', (e as Error).message); }
    finally { running = false; }
  };
  setTimeout(tick, 3 * 60_000);
  setInterval(tick, 30 * 60_000).unref();
  console.log('✉️ Серия писем включена (проход раз в 30 минут)');
}
