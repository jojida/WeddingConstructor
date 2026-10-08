import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { tgSend } from '../lib/notify';
import { telegramWebhookSecret } from '../lib/security';
import { isFreeAccount } from '../lib/freeAccounts';

import { hasNotifications } from '../lib/plans';
import { errName } from '../lib/planner/util';

const router = Router();

/* Бот один на весь сервис и делает три вещи:
   1. /start <token> — подключает паре уведомления об ответах гостей;
   2. меню (/start без токена, /help, кнопки) — шаблоны, тарифы, вопросы;
   3. поддержка — любое другое сообщение уходит владельцу в личку, а его
      ответ реплаем возвращается человеку от имени бота.

   Куда идёт поддержка: TELEGRAM_SUPPORT_CHAT_ID из env, а если его нет —
   чат, где владелец (аккаунт из freeAccounts) подключил уведомления
   своего приглашения. Так ничего не нужно настраивать на сервере. */

const SITE = (process.env.FRONTEND_URL || 'https://weddingcraft.ru').replace(/\/$/, '');
const utm = (path: string, content: string) =>
  `${SITE}${path}?utm_source=telegram&utm_medium=bot&utm_campaign=${content}`;

async function tg(method: string, body: Record<string, unknown>): Promise<any> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json: any = await res.json();
    if (!json?.ok) console.error(`Telegram ${method} failed`);
    return json;
  } catch {
    console.error(`Telegram ${method} failed`);
    return null;
  }
}

// ─── Меню ────────────────────────────────────────
const BTN = {
  templates: '🎨 Шаблоны',
  prices:    '💳 Тарифы',
  faq:       '❓ Частые вопросы',
  notify:    '🔔 Уведомления о гостях',
  support:   '✉️ Поддержка',
} as const;

const KEYBOARD = {
  keyboard: [
    [{ text: BTN.templates }, { text: BTN.prices }],
    [{ text: BTN.faq }, { text: BTN.notify }],
    [{ text: BTN.support }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

const linkButton = (text: string, url: string) => ({ inline_keyboard: [[{ text, url }]] });

const TEXT = {
  welcome:
    'Здравствуйте! Это WeddingCraft — свадебные сайты-приглашения.\n\n' +
    'Здесь можно посмотреть шаблоны и тарифы, найти ответы на частые вопросы ' +
    'или написать нам — ответим прямо в этом чате.',
  templates:
    'Больше десяти шаблонов: с конвертом, живой обложкой, витражными дверями, ' +
    'акварелью и минимализмом. Любой можно открыть и посмотреть целиком.',
  prices:
    '• Бесплатный — 0 ₽: любой шаблон, имена, дата, тексты, фото, музыка, ссылка для гостей.\n\n' +
    '• Премиум — 2 490 ₽: анимация открытия, анкета для гостей, карта, программа дня и дресс-код, ' +
    'статистика ответов, уведомления в Telegram и на почту, список гостей и персональные ссылки.\n\n' +
    '• Максимум — 3 990 ₽: всё из «Премиум» + рассадка гостей по столам, меню и выбор блюд, ' +
    'печатные материалы.\n\n' +
    'Оплата разовая, без подписки. Сайт и правки — без срока действия.',
  faq:
    '❔ Как гости получат приглашение?\n' +
    'Отправьте ссылку в мессенджере, по SMS или на почту. Приложения и регистрация гостям не нужны.\n\n' +
    '❔ Можно ли опубликовать сайт бесплатно?\n' +
    'Да: имена, дата, фото и музыка входят в бесплатный тариф. Анкета, карта и программа дня — в платных.\n\n' +
    '❔ Можно ли править сайт после оплаты?\n' +
    'Да, бесплатно и сколько угодно — ссылка останется прежней.\n\n' +
    '❔ Что умеет анкета?\n' +
    'Собирает ответы гостей: придут ли, с кем, есть ли дети, что пьют. Ответы видны в кабинете и приходят сюда.\n\n' +
    '❔ Можно свой домен?\n' +
    'Да, в любом тарифе — инструкция в кабинете.\n\n' +
    'Не нашли ответ — нажмите «Поддержка» и напишите вопрос.',
  notify:
    'Чтобы ответы гостей приходили в этот чат:\n' +
    '1. Откройте кабинет на сайте.\n' +
    '2. В карточке приглашения нажмите «Подключить Telegram».\n' +
    '3. Telegram откроет этот бот — нажмите «Старт».\n\n' +
    'Уведомления доступны в тарифах «Премиум» и «Максимум».',
  support:
    'Напишите вопрос одним сообщением — можно со скриншотом. Мы ответим здесь же, ' +
    'обычно в течение дня.',
  received: '✅ Спасибо! Передали ваш вопрос — ответим в этом чате.',
};

async function sendMenu(chatId: number, text: string = TEXT.welcome) {
  await tg('sendMessage', { chat_id: chatId, text, reply_markup: KEYBOARD });
}

/** Ответ на кнопку меню или команду; false — это не пункт меню. */
async function handleMenu(chatId: number, text: string): Promise<boolean> {
  const t = text.trim();
  if (/^\/(start|help|menu)(@\w+)?$/.test(t)) { await sendMenu(chatId); return true; }
  if (t === BTN.templates || /^\/templates/.test(t)) {
    await tg('sendMessage', { chat_id: chatId, text: TEXT.templates,
      reply_markup: linkButton('Открыть шаблоны', utm('/templates', 'templates')) });
    return true;
  }
  if (t === BTN.prices || /^\/prices/.test(t)) {
    await tg('sendMessage', { chat_id: chatId, text: TEXT.prices,
      reply_markup: linkButton('Создать приглашение', utm('/templates', 'prices')) });
    return true;
  }
  if (t === BTN.faq || /^\/faq/.test(t)) { await tg('sendMessage', { chat_id: chatId, text: TEXT.faq }); return true; }
  if (t === BTN.notify) {
    await tg('sendMessage', { chat_id: chatId, text: TEXT.notify,
      reply_markup: linkButton('Открыть кабинет', utm('/dashboard', 'notify')) });
    return true;
  }
  if (t === BTN.support || /^\/support(@\w+)?$/.test(t)) { await tg('sendMessage', { chat_id: chatId, text: TEXT.support }); return true; }
  return false;
}

// ─── Поддержка ───────────────────────────────────
let supportCache: { id: string; at: number } | null = null;

/** Чат владельца для обращений. Кэш на 10 минут, чтобы не ходить в БД на каждое сообщение. */
async function supportChatId(): Promise<string> {
  const fromEnv = (process.env.TELEGRAM_SUPPORT_CHAT_ID || '').trim();
  if (fromEnv) return fromEnv;
  if (supportCache && Date.now() - supportCache.at < 10 * 60_000) return supportCache.id;
  const invites = await prisma.invitation.findMany({
    where: { notifyTelegramChatId: { not: '' } },
    select: { notifyTelegramChatId: true, user: { select: { email: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  const own = invites.find(i => isFreeAccount(i.user.email));
  supportCache = { id: own?.notifyTelegramChatId || '', at: Date.now() };
  return supportCache.id;
}

// Защита от потока сообщений: не больше 20 обращений в час от одного человека,
// и «спасибо, передали» — не чаще раза в 10 минут.
const recent = new Map<number, { count: number; since: number; ackAt: number }>();
function allow(chatId: number): { ok: boolean; ack: boolean } {
  const now = Date.now();
  let r = recent.get(chatId);
  if (!r || now - r.since > 3600_000) { r = { count: 0, since: now, ackAt: 0 }; recent.set(chatId, r); }
  if (recent.size > 5000) recent.clear();
  r.count += 1;
  const ack = now - r.ackAt > 10 * 60_000;
  if (ack) r.ackAt = now;
  return { ok: r.count <= 20, ack };
}

const TAG = /#u(\d{3,20})\b/;

async function forwardToSupport(msg: any, support: string) {
  const from = msg.from || {};
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Без имени';
  const header = `✉️ ${name}${from.username ? ' @' + from.username : ''} · #u${msg.chat.id}`;
  if (typeof msg.text === 'string') {
    await tg('sendMessage', { chat_id: support, text: `${header}\n\n${msg.text}` });
  } else {
    // Фото, файл, голосовое: шапка с #u-номером, а копия получает её же
    // в подпись — тогда реплай можно делать и на саму картинку.
    // (Telegram не передаёт вложенные реплаи, поэтому номер должен быть
    // в том сообщении, на которое отвечают.)
    await tg('sendMessage', { chat_id: support, text: header });
    const caption = [header, msg.caption].filter(Boolean).join('\n\n').slice(0, 1024);
    await tg('copyMessage', { chat_id: support, from_chat_id: msg.chat.id, message_id: msg.message_id, caption });
  }
}

/** Владелец ответил реплаем на обращение — отправляем ответ человеку. */
async function replyFromSupport(msg: any): Promise<void> {
  const replied = msg.reply_to_message;
  const src = String(replied?.text || replied?.caption || '');
  const m = TAG.exec(src);
  if (!m) {
    await tgSend(msg.chat.id, 'Чтобы ответить человеку, сделайте реплай на сообщение с его #u-номером.');
    return;
  }
  const res = await tg('copyMessage', { chat_id: Number(m[1]), from_chat_id: msg.chat.id, message_id: msg.message_id });
  await tgSend(msg.chat.id, res?.ok ? '✅ Отправлено' : '⚠️ Не доставлено — возможно, человек остановил бота.');
}

// ─── Команды в меню Telegram (кнопка «/» у поля ввода) ──
let commandsSet = false;
async function ensureCommands() {
  if (commandsSet) return;
  commandsSet = true;
  await tg('setMyCommands', { commands: [
    { command: 'start',   description: 'Меню' },
    { command: 'prices',  description: 'Тарифы' },
    { command: 'faq',     description: 'Частые вопросы' },
    { command: 'support', description: 'Написать в поддержку' },
  ] });
}

// POST /api/telegram/webhook — приём апдейтов от Telegram.
// Подключение пары: deep-link https://t.me/<bot>?start=<telegramConnectToken>.
// На /start <token> находим приглашение и сохраняем chat_id владельца.
router.post('/webhook', async (req: Request, res: Response) => {
  if (!process.env.TELEGRAM_BOT_TOKEN || req.get('X-Telegram-Bot-Api-Secret-Token') !== telegramWebhookSecret()) {
    return res.status(403).send('Forbidden');
  }
  try {
    const msg = req.body?.message;
    const text: string = typeof msg?.text === 'string' ? msg.text : '';
    const chatId = msg?.chat?.id;
    if (!Number.isSafeInteger(chatId) || chatId <= 0 || msg.chat.type !== 'private') return res.status(200).send('OK');
    void ensureCommands();

    const token = /^\/start\s+(\S+)/.exec(text)?.[1] || '';
    if (token) {
      if (!/^[a-zA-Z0-9_-]{20,64}$/.test(token)) { await sendMenu(chatId); return res.status(200).send('OK'); }
      const invite = await prisma.invitation.findFirst({ where: { telegramConnectToken: token, telegramConnectExpiresAt: { gt: new Date() } } });
      if (invite && !hasNotifications(invite.plan)) {
        await tgSend(chatId, 'Telegram доступен в тарифах «Премиум» и «Максимум».');
        return res.status(200).send('OK');
      }
      if (invite) {
        const connected = await prisma.invitation.updateMany({
          where: { id: invite.id, telegramConnectToken: token, telegramConnectExpiresAt: { gt: new Date() } },
          data: { notifyTelegramChatId: String(chatId), notifyChannel: 'telegram', telegramConnectToken: '', telegramConnectExpiresAt: null },
        });
        if (!connected.count) return res.status(200).send('OK');
        supportCache = null;   // вдруг это владелец подключил свой чат
        await tg('sendMessage', { chat_id: chatId, text: '✅ Уведомления подключены! Ответы гостей будут приходить сюда.', reply_markup: KEYBOARD });
      } else {
        await tgSend(chatId, 'Ссылка устарела. Сгенерируйте новую в кабинете WeddingCraft.');
      }
      return res.status(200).send('OK');
    }

    const support = await supportChatId();
    const fromSupport = !!support && String(chatId) === support;

    if (fromSupport && msg.reply_to_message) { await replyFromSupport(msg); return res.status(200).send('OK'); }
    if (await handleMenu(chatId, text)) return res.status(200).send('OK');
    if (fromSupport) {
      await tgSend(chatId, 'Это чат поддержки: обращения людей приходят сюда. Отвечайте реплаем на сообщение с #u-номером.');
      return res.status(200).send('OK');
    }

    // Всё остальное — обращение в поддержку.
    const gate = allow(chatId);
    if (!gate.ok) return res.status(200).send('OK');
    if (support) {
      await forwardToSupport(msg, support);
      if (gate.ack) await tgSend(chatId, TEXT.received);
    } else {
      console.error('Telegram support: чат поддержки не найден — обращение не переслано');
      if (gate.ack) await tgSend(chatId, 'Поддержка временно недоступна. Напишите, пожалуйста, на почту, указанную на сайте.');
    }
    return res.status(200).send('OK');
  } catch (e) {
    console.error('Telegram webhook error:', errName(e));
    return res.status(200).send('OK');
  }
});

export default router;
