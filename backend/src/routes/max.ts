import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { maxConfigured, maxSend } from '../lib/maxBot';
import { forgetMaxUser, handleMaxReminderCallback, handleReminderStart } from '../lib/reminders';
import { maxWebhookSecret } from '../lib/security';
import { messageGate } from '../lib/telegramSupport';
import { errName } from '../lib/planner/util';

const router = Router();

/* Бот MAX нужен только для напоминаний гостям (lib/maxBot.ts, lib/reminders.ts):
   1. bot_started с payload r_<токен> — гость пришёл по ссылке из анкеты;
   2. message_callback — кнопки «Буду / Не смогу» под напоминанием;
   3. bot_stopped — гость остановил бота, больше туда не пишем.
   Поддержку и меню для пар ведёт Telegram-бот, здесь на прочие сообщения — короткая подсказка. */

const HELP =
  'Здравствуйте! Это бот WeddingCraft: он присылает гостям напоминание о свадьбе, ' +
  'а ответить «Буду» или «Не смогу» можно кнопками под ним.\n\n' +
  'Чтобы получить напоминание, отметьте «Напомнить мне» в анкете на сайте приглашения. ' +
  'Вопрос о сервисе — на support@weddingcraft.ru.';

const TOKEN = /(?:^|[^A-Za-z0-9_])r_([A-Za-z0-9]{10,24})(?![A-Za-z0-9])/;

// Не больше 30 событий в минуту от одного человека, подсказка — не чаще раза в 10 минут
const allow = messageGate(30, 60_000, 10 * 60_000);

function secretOk(got: string | undefined): boolean {
  const a = Buffer.from(String(got || ''));
  const b = Buffer.from(maxWebhookSecret());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const userIdOf = (u: unknown): string | null => {
  const id = (u as { user_id?: unknown } | null)?.user_id;
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? String(id) : null;
};

// POST /api/max/webhook — события бота (подписка ставится при старте, lib/maxBot.ts initMax).
// MAX ждёт 200 не дольше 30 секунд, иначе повторяет событие.
router.post('/webhook', async (req: Request, res: Response) => {
  if (!maxConfigured() || !secretOk(req.get('X-Max-Bot-Api-Secret'))) return res.status(403).send('Forbidden');
  try {
    const u = req.body || {};
    switch (u.update_type) {
      case 'bot_started': {
        const user = userIdOf(u.user);
        if (!user || u.user?.is_bot || !allow(Number(user)).ok) break;
        const m = TOKEN.exec(typeof u.payload === 'string' ? u.payload : '');
        if (m) await handleReminderStart({ channel: 'max', id: user }, m[1]);
        else await maxSend(user, HELP);
        break;
      }
      case 'message_created': {
        const msg = u.message;
        const user = userIdOf(msg?.sender);
        if (!user || msg?.sender?.is_bot || msg?.recipient?.chat_type !== 'dialog') break;
        const gate = allow(Number(user));
        if (!gate.ok) break;
        // Гость, у которого диалог с ботом уже был, может прислать «start r_…» сообщением
        const m = TOKEN.exec(typeof msg?.body?.text === 'string' ? msg.body.text : '');
        if (m) await handleReminderStart({ channel: 'max', id: user }, m[1]);
        else if (gate.ack) await maxSend(user, HELP);
        break;
      }
      case 'message_callback': {
        const user = userIdOf(u.callback?.user);
        if (!user || !allow(Number(user)).ok) break;
        await handleMaxReminderCallback(u);
        break;
      }
      case 'bot_stopped': {
        const user = userIdOf(u.user);
        if (user) await forgetMaxUser(user);
        break;
      }
    }
  } catch (e) {
    console.error('MAX webhook error:', errName(e));
  }
  return res.status(200).send('OK');
});

export default router;
