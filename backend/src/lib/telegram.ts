// Настройка Telegram-бота сервиса. Бот ОДИН на весь WeddingCraft — его заводит
// владелец сервиса в @BotFather, пары ничего не настраивают: они лишь переходят
// по deep-link t.me/<bot>?start=<token>, и вебхук запоминает их chat_id.
//
// Владельцу достаточно положить в .env один TELEGRAM_BOT_TOKEN: имя бота
// определяется через getMe, а вебхук ставится сам при старте сервера.

let cachedUsername = '';

/** Имя бота для deep-link. Берётся из Telegram, env — запасной вариант. */
export function botUsername(): string {
  return cachedUsername || process.env.TELEGRAM_BOT_USERNAME || '';
}

/** Разовая настройка при старте: узнать имя бота и прописать вебхук. */
export async function initTelegram(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return; // бот не подключён — уведомления пойдут только на email

  try {
    const me: any = await fetch(`https://api.telegram.org/bot${token}/getMe`).then(r => r.json());
    if (!me?.ok || !me.result?.username) {
      console.error('🤖 Telegram: не удалось определить бота —', me?.description || 'пустой ответ getMe');
      return;
    }
    cachedUsername = me.result.username;
    console.log(`🤖 Telegram-бот: @${cachedUsername}`);
  } catch (e) {
    console.error('🤖 Telegram getMe:', e);
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, allowed_updates: ['message'] }),
    }).then(r => r.json());
    if (res?.ok) console.log(`🤖 Telegram: вебхук установлен на ${url}`);
    else console.error('🤖 Telegram setWebhook:', res?.description || res);
  } catch (e) {
    console.error('🤖 Telegram setWebhook:', e);
  }
}
