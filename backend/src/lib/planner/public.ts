// Что анкета гостя знает о меню и что принимает от гостя. Наружу уходят только настройки
// анкеты и названия вариантов — ни чужих ответов, ни пищевых ограничений, ни рассадки.
import prisma from '../prisma';
import type { RsvpAnswer } from '../rsvpDetails';
import { plannerDenial } from './access';
import { LIMITS, cleanText } from './util';
import type { PersonDetail } from './roster';

export interface PublicMenu {
  askMenu: boolean;   // спрашивать блюдо у каждого гостя
  askDiet: boolean;   // спрашивать пищевые ограничения (необязательно)
  options: { id: string; label: string; note: string }[];
}

/** Настройки без проверки доступа — вызывающий её уже сделал. */
export async function loadPublicMenu(inviteId: string): Promise<PublicMenu | null> {
  const s = await prisma.plannerSettings.findUnique({ where: { invitationId: inviteId } });
  if (!s || (!s.askMenu && !s.askDiet)) return null;
  const options = s.askMenu
    ? await prisma.menuOption.findMany({
      where: { invitationId: inviteId }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }], select: { id: true, label: true, note: true },
    })
    : [];
  // Включили выбор, но вариантов ещё нет — спрашивать нечего
  if (!options.length && !s.askDiet) return null;
  return { askMenu: options.length > 0, askDiet: s.askDiet, options };
}

/** Для страницы сайта (by-slug, by-domain). Любая ошибка — null: сайт гостей не должен
    падать из-за планировщика. */
export async function publicMenu(invite: { id: string; plan: string; userId: string }): Promise<PublicMenu | null> {
  try {
    const s = await prisma.plannerSettings.findUnique({ where: { invitationId: invite.id }, select: { askMenu: true, askDiet: true } });
    if (!s || (!s.askMenu && !s.askDiet)) return null;      // большинство сайтов — сразу сюда, без лишних запросов
    if (await plannerDenial(invite)) return null;
    return await loadPublicMenu(invite.id);
  } catch {
    return null;
  }
}

/** Люди из анкеты. Анкета некоторых шаблонов показывает «Спасибо» даже при ошибке сервера, поэтому
    из-за этого поля ответ гостя не отклоняем: что-то не так — поле просто не учитываем (null).
    Вариант блюда, которого уже нет (его удалили, пока гость заполнял), — как «не выбрано». */
export function cleanPeople(raw: unknown, menu: PublicMenu): PersonDetail[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > LIMITS.partyPeople) return null;
  const optionIds = new Set(menu.options.map((o) => o.id));
  const out: PersonDetail[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const { name, menu: choice, diet, child } = item as Record<string, unknown>;
    const cleanName = cleanText(name, 1000);
    const cleanDiet = menu.askDiet ? cleanText(diet, 4000) : '';
    if (cleanName === null || cleanDiet === null) return null;
    out.push({
      name: cleanName.slice(0, LIMITS.name).trim(),
      menuOptionId: menu.askMenu && typeof choice === 'string' && optionIds.has(choice) ? choice : null,
      diet: menu.askDiet ? cleanDiet.slice(0, LIMITS.diet).trim() : null,
      isChild: child === true,
    });
  }
  out[0].isChild = false;   // первый — сам гость, взрослый
  return out;
}

/** Ответ «Гости и блюда» для вкладки «Ответы» и уведомления: имена и выбор, без пищевых
    ограничений (уведомление уходит в Telegram или на почту). Заодно это запись того, что
    выбрал гость, если обновить список людей не получилось. */
export function peopleAnswer(people: PersonDetail[], menu: PublicMenu): RsvpAnswer {
  const label = new Map(menu.options.map((o) => [o.id, o.label]));
  const parts = people.map((p, i) => {
    const who = `${p.name || `Гость ${i + 1}`}${p.isChild ? ' (ребёнок)' : ''}`;
    if (!menu.askMenu) return who;
    return `${who}: ${(p.menuOptionId && label.get(p.menuOptionId)) || 'блюдо не выбрано'}`;
  });
  return { id: 'people', q: menu.askMenu ? 'Гости и блюда' : 'Кто придёт', a: parts.join('; ').slice(0, 1000), t: 'text' };
}
