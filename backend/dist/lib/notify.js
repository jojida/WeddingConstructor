"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tgSend = tgSend;
exports.notifyOwner = notifyOwner;
// Уведомления владельцу приглашения о новом ответе гостя.
// Пара выбирает ОДИН канал: telegram | email | none.
const prisma_1 = __importDefault(require("./prisma"));
const email_1 = require("./email");
const TG_API = (method) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || ''}/${method}`;
async function tgSend(chatId, text) {
    if (!process.env.TELEGRAM_BOT_TOKEN || !chatId)
        return;
    try {
        await fetch(TG_API('sendMessage'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
        });
    }
    catch (e) {
        console.error('Telegram send error:', e);
    }
}
function formatMessage(invite, r) {
    const couple = [invite.groomName, invite.brideName].filter(Boolean).join(' & ') || 'ваша свадьба';
    const attend = r.attending ? '✅ Придёт' : '❌ Не придёт';
    const lines = [
        `Новый ответ на приглашение (${couple})`,
        ``,
        `👤 Гость: ${r.guestName}`,
        `${attend}`,
    ];
    if (r.drinkChoice)
        lines.push(`🥂 Напитки: ${r.drinkChoice}`);
    if (r.wishes)
        lines.push(`💌 Пожелания: ${r.wishes}`);
    const text = lines.join('\n');
    const html = lines.map((l) => (l ? `<div>${l}</div>` : '<br>')).join('');
    return { subject: `RSVP: ${r.guestName} — ${invite.groomName || ''} & ${invite.brideName || ''}`, text, html };
}
/** Отправляет уведомление владельцу по выбранному им каналу (best-effort, не бросает). */
async function notifyOwner(invite, r) {
    try {
        const channel = invite.notifyChannel || 'none';
        if (channel === 'none')
            return;
        const msg = formatMessage(invite, r);
        if (channel === 'telegram') {
            if (invite.notifyTelegramChatId)
                await tgSend(invite.notifyTelegramChatId, msg.text);
            return;
        }
        if (channel === 'email') {
            let to = invite.notifyEmail;
            if (!to) {
                const user = await prisma_1.default.user.findUnique({ where: { id: invite.userId } });
                to = user?.email || '';
            }
            if (!to)
                return;
            console.log(`\n📧 [RSVP NOTIFY] → ${to}\n${msg.text}\n`);
            if ((0, email_1.isEmailConfigured)()) {
                await (0, email_1.sendEmail)({ to, subject: msg.subject, text: msg.text, html: msg.html });
            }
        }
    }
    catch (e) {
        console.error('notifyOwner error:', e);
    }
}
