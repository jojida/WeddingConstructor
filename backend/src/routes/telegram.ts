import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { tgSend } from '../lib/notify';
import { telegramWebhookSecret } from '../lib/security';

const router = Router();

// POST /api/telegram/webhook — приём апдейтов от Telegram.
// Подключение пары: deep-link https://t.me/<bot>?start=<telegramConnectToken>.
// На /start <token> находим приглашение и сохраняем chat_id владельца.
router.post('/webhook', async (req: Request, res: Response) => {
  if (!process.env.TELEGRAM_BOT_TOKEN || req.get('X-Telegram-Bot-Api-Secret-Token') !== telegramWebhookSecret()) {
    return res.status(403).send('Forbidden');
  }
  try {
    const msg = req.body?.message;
    const text: string = msg?.text || '';
    const chatId = msg?.chat?.id;

    if (chatId && msg.chat.type === 'private' && typeof text === 'string' && /^\/start(\s|$)/.test(text)) {
      const token = text.split(/\s+/)[1] || '';
      if (token) {
        const invite = await prisma.invitation.findFirst({ where: { telegramConnectToken: token } });
        if (invite) {
          const connected = await prisma.invitation.updateMany({
            where: { id: invite.id, telegramConnectToken: token },
            data: { notifyTelegramChatId: String(chatId), notifyChannel: 'telegram', telegramConnectToken: '' },
          });
          if (!connected.count) return res.status(200).send('OK');
          await tgSend(chatId, '✅ Уведомления подключены! Ответы гостей будут приходить сюда.');
        } else {
          await tgSend(chatId, 'Ссылка устарела. Сгенерируйте новую в кабинете WeddingCraft.');
        }
      } else {
        await tgSend(chatId, 'Откройте кабинет WeddingCraft и нажмите «Подключить Telegram».');
      }
    }
    // Telegram ждёт 200 на любой апдейт
    return res.status(200).send('OK');
  } catch (e) {
    console.error('Telegram webhook error:', e);
    return res.status(200).send('OK');
  }
});

export default router;
