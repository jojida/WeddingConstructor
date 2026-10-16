// Настройка Telegram-бота сервиса. Бот ОДИН на весь WeddingCraft — его заводит
// владелец сервиса в @BotFather, пары ничего не настраивают: они лишь переходят
// по deep-link t.me/<bot>?start=<token>, и вебхук запоминает их chat_id.
//
// Владельцу достаточно положить в .env один TELEGRAM_BOT_TOKEN: имя бота
// определяется через getMe, а вебхук ставится сам при старте сервера.

import { telegramWebhookSecret } from './security';
let cachedUsername = '';

/** Вызов Bot API: null — бот не подключён или Telegram не ответил (ошибка уже в логе). */
export async function telegramApi(method: string, body: Record<string, unknown>): Promise<any> {
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

/** Имя бота для deep-link. Берётся из Telegram, env — запасной вариант. */
export function botUsername(): string {
  return cachedUsername || process.env.TELEGRAM_BOT_USERNAME || '';
}

/** Разовая настройка при старте: узнать имя бота и прописать вебхук. */
export async function initTelegram(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return; // бот не подключён — уведомления пойдут только на email

  try {
    const me: any = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(10_000), redirect: 'error',
    }).then(r => r.json());
    if (!me?.ok || !me.result?.username) {
      console.error('Telegram getMe failed');
      return;
    }
    cachedUsername = me.result.username;
    console.log(`🤖 Telegram-бот: @${cachedUsername}`);
  } catch {
    console.error('Telegram getMe failed');
    return;
  }

  // Telegram принимает только https, поэтому локально вебхук не ставим:
  // на разработке подключение пары не проверить, и это нормально.
  const base = (process.env.BACKEND_URL || '').replace(/\/$/, '');
  if (!base.startsWith('https://')) {
    console.log('🤖 Telegram: вебхук не установлен — BACKEND_URL не https (локальная разработка)');
    return;
  }

  const url = `${base}/api/telegram/webhook`;
  try {
    const res: any = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      // callback_query — кнопки «Опубликовать / Скрыть» под отзывами в чате поддержки
      body: JSON.stringify({ url, secret_token: telegramWebhookSecret(), allowed_updates: ['message', 'callback_query'] }),
    }).then(r => r.json());
    if (res?.ok) console.log(`🤖 Telegram: вебхук установлен на ${url}`);
    else console.error('Telegram setWebhook failed');
  } catch {
    console.error('Telegram setWebhook failed');
  }
}
