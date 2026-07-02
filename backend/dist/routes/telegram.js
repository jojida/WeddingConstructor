"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const notify_1 = require("../lib/notify");
const router = (0, express_1.Router)();
// POST /api/telegram/webhook — приём апдейтов от Telegram.
// Подключение пары: deep-link https://t.me/<bot>?start=<telegramConnectToken>.
// На /start <token> находим приглашение и сохраняем chat_id владельца.
router.post('/webhook', async (req, res) => {
    try {
        const msg = req.body?.message;
        const text = msg?.text || '';
        const chatId = msg?.chat?.id;
        if (chatId && /^\/start(\s|$)/.test(text)) {
            const token = text.split(/\s+/)[1] || '';
            if (token) {
                const invite = await prisma_1.default.invitation.findFirst({ where: { telegramConnectToken: token } });
                if (invite) {
                    await prisma_1.default.invitation.update({
                        where: { id: invite.id },
                        data: { notifyTelegramChatId: String(chatId), notifyChannel: 'telegram' },
                    });
                    await (0, notify_1.tgSend)(chatId, '✅ Уведомления подключены! Ответы гостей будут приходить сюда.');
                }
                else {
                    await (0, notify_1.tgSend)(chatId, 'Ссылка устарела. Сгенерируйте новую в кабинете WeddingCraft.');
                }
            }
            else {
                await (0, notify_1.tgSend)(chatId, 'Откройте кабинет WeddingCraft и нажмите «Подключить Telegram».');
            }
        }
        // Telegram ждёт 200 на любой апдейт
        return res.status(200).send('OK');
    }
    catch (e) {
        console.error('Telegram webhook error:', e);
        return res.status(200).send('OK');
    }
});
exports.default = router;
