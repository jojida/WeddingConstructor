import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { tgSend } from '../lib/notify';

const router = Router();

// POST /api/telegram/webhook — приём апдейтов от Telegram.
// Подключение пары: deep-link https://t.me/<bot>?start=<telegramConnectToken>.
// На /start <token> находим приглашение и сохраняем chat_id владельца.
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const msg = req.body?.message;
    const text: string = msg?.text || '';
    const chatId = msg?.chat?.id;

    if (chatId && /^\/start(\s|$)/.test(text)) {
      const token = text.split(/\s+/)[1] || '';
      if (token) {
        const invite = await prisma.invitation.findFirst({ where: { telegramConnectToken: token } });
        if (invite) {
          await prisma.invitation.update({
            where: { id: invite.id },
            data: { notifyTelegramChatId: String(chatId), notifyChannel: 'telegram' },
          });
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
