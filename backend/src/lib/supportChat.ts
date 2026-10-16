// Чат владельца сервиса в Telegram: туда приходят обращения в поддержку и отзывы пар.
// TELEGRAM_SUPPORT_CHAT_ID из env, а если его нет — чат, где владелец сервиса (промо-
// аккаунты не подходят) подключил уведомления своего приглашения.
import prisma from './prisma';
import { isServiceOwnerAccount } from './freeAccounts';

let cache: { id: string; at: number } | null = null;

/** Номер чата или ''. Кэш на 10 минут, чтобы не ходить в БД на каждое сообщение. */
export async function supportChatId(): Promise<string> {
  const fromEnv = (process.env.TELEGRAM_SUPPORT_CHAT_ID || '').trim();
  if (fromEnv) return /^[1-9]\d{0,15}$/.test(fromEnv) && Number.isSafeInteger(Number(fromEnv)) ? fromEnv : '';
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.id;
  const invites = await prisma.invitation.findMany({
    where: { notifyTelegramChatId: { not: '' } },
    select: { notifyTelegramChatId: true, user: { select: { email: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  const own = invites.find(i => isServiceOwnerAccount(i.user.email));
  cache = { id: own?.notifyTelegramChatId || '', at: Date.now() };
  return cache.id;
}

/** Кто-то подключил уведомления — вдруг это владелец: перечитать чат при следующем вызове. */
export function resetSupportChat(): void {
  cache = null;
}
