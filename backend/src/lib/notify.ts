// Уведомления владельцу приглашения о новом ответе гостя.
// Пара выбирает ОДИН канал: telegram | email | none.
import prisma from './prisma';
import { escapeHtml } from './security';
import { sendEmail, isEmailConfigured } from './email';
import { inviteDrinkLabels, formatDrinkChoice } from './drinks';
import { hasNotifications } from './plans';

const TG_API = (method: string) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || ''}/${method}`;

export async function tgSend(chatId: string | number, text: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    await fetch(TG_API('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.error('Telegram send error:', e);
  }
}

interface InviteLike {
  id: string;
  userId: string;
  groomName: string;
  brideName: string;
  notifyChannel: string;
  notifyEmail: string;
  notifyTelegramChatId: string;
  customData?: string | null;
}

interface ResponseLike {
  guestName: string;
  attending: boolean;
  drinkChoice: string;
  wishes: string;
}

function formatMessage(invite: InviteLike, r: ResponseLike): { subject: string; text: string; html: string } {
  const couple = [invite.groomName, invite.brideName].filter(Boolean).join(' & ') || 'ваша свадьба';
  const attend = r.attending ? '✅ Придёт' : '❌ Не придёт';
  const lines = [
    `Новый ответ на приглашение (${couple})`,
    ``,
    `👤 Гость: ${r.guestName}`,
    `${attend}`,
  ];
  if (r.drinkChoice) lines.push(`🥂 Напитки: ${formatDrinkChoice(r.drinkChoice, inviteDrinkLabels(invite.customData))}`);
  if (r.wishes) lines.push(`💌 Пожелания: ${r.wishes}`);
  const text = lines.join('\n');
  const html = lines.map((l) => (l ? `<div>${escapeHtml(l)}</div>` : '<br>')).join('');
  return { subject: `RSVP: ${r.guestName} — ${invite.groomName || ''} & ${invite.brideName || ''}`, text, html };
}

/** Отправляет уведомление владельцу по выбранному им каналу (best-effort, не бросает). */
export async function notifyOwner(invite: InviteLike, r: ResponseLike): Promise<void> {
  try {
    // На «Лайте» уведомлений нет — ответы гость видит только в кабинете пары.
    if (!hasNotifications((invite as { plan?: string }).plan)) return;
    const channel = invite.notifyChannel || 'none';
    if (channel === 'none') return;
    const msg = formatMessage(invite, r);

    if (channel === 'telegram') {
      if (invite.notifyTelegramChatId) await tgSend(invite.notifyTelegramChatId, msg.text);
      return;
    }

    if (channel === 'email') {
      let to = invite.notifyEmail;
      if (!to) {
        const user = await prisma.user.findUnique({ where: { id: invite.userId } });
        to = user?.email || '';
      }
      if (!to) return;
      if (isEmailConfigured()) {
        await sendEmail({ to, subject: msg.subject, text: msg.text, html: msg.html });
      }
    }
  } catch (e) {
    console.error('notifyOwner error:', e);
  }
}
