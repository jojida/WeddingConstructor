import { TEMPLATE_FIELDS } from './constants';
import { ownPlace, quotePlace } from './own-place';
import { isSectionEnabled } from './section-visibility';

interface InviteLike {
  templateId?: string;
  venue?: string | null;
  venueAddress?: string | null;
  schedule?: unknown;
  enabledSections?: Record<string, boolean> | null;
  customData?: Record<string, unknown> | null;
}

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};

/** Что из приглашения пары гости не увидят на бесплатном тарифе — её же словами
    («место — «Белый сад» — и карту проезда»), в винительном падеже: читается после
    «Гости не увидят:». Только блоки, которые есть в шаблоне и не выключены парой.
    Пусто — сказать нечего (у шаблона нет таких блоков). */
export function freeLosses(invite: InviteLike): string[] {
  const sections = TEMPLATE_FIELDS[invite.templateId || ''] || [];
  const on = (id: string) => sections.some(s => s.id === id
    && isSectionEnabled(s, invite.enabledSections || undefined, invite.customData?.showMap));
  const items: string[] = [];
  if (on('venue')) {
    const { venue, address } = ownPlace(invite);
    items.push(venue ? `место — ${quotePlace(venue)} — и карту проезда`
      : address ? `адрес — ${quotePlace(address)} — и карту проезда` : 'место и карту проезда');
  }
  const steps = Array.isArray(invite.schedule)
    ? invite.schedule.filter(s => !!s && typeof s === 'object' && String((s as { title?: unknown }).title ?? '').trim()).length
    : 0;
  if (on('schedule') && steps) items.push(`программу дня (${steps} ${plural(steps, 'пункт', 'пункта', 'пунктов')})`);
  if (on('dresscode')) items.push('дресс-код');
  if (on('envelope')) items.push('анимацию открытия');
  if (on('hall')) items.push('фото места');
  return items;
}
