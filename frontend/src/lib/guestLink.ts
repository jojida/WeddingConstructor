// Персональная ссылка гостя ?g=<token> — общая часть трёх страниц сайта (/<slug>,
// /invite/<slug>, свой домен): обращение и имя гостя, а если пара включила — его стол и блюда.
import { TEMPLATE_GREETING_KEY } from '@/lib/constants';
import type { GuestSeatView } from '@/components/GuestSeat';

export interface ResolvedGuest {
  greeting: string;
  names: string;
  attending: boolean | null;
  planner?: GuestSeatView | null;
}

/** Гость по токену. Страница называет своё приглашение: чужая ссылка на этом сайте не сработает. */
export async function resolveGuest(api: string, token: string, inviteId: string): Promise<ResolvedGuest | null> {
  try {
    const res = await fetch(`${api}/api/guests/resolve/${encodeURIComponent(token)}?invite=${encodeURIComponent(inviteId)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as ResolvedGuest;
  } catch { return null; }
}

/** Обращение и имя — в customData: дойдут до шаблона через существующий postMessage
    (обёртки шаблонов не меняются). */
export function applyGuest(invite: { templateId: string; customData?: Record<string, unknown> }, guest: ResolvedGuest, token: string): void {
  const greetingKey = TEMPLATE_GREETING_KEY[invite.templateId];
  invite.customData = { ...(invite.customData || {}) };
  if (greetingKey) invite.customData[greetingKey] = guest.greeting;
  invite.customData.guestName = guest.names;
  invite.customData.guestToken = token;
}
