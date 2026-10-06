// Меню: варианты выбора блюда и настройки анкеты. Варианты хранятся в своей таблице, а не в
// customData приглашения: редактор перезаписывает customData целиком и затёр бы их.
import prisma from '../prisma';
import { LIMITS, PlannerError, cleanText, isBool, nameKey, plural } from './util';

function text(value: unknown, max: number, what: string): string {
  const v = cleanText(value, max);
  if (v === null) throw new PlannerError(400, `${what}: не больше ${max} символов`);
  return v;
}

export async function getSettings(inviteId: string) {
  const s = await prisma.plannerSettings.findUnique({ where: { invitationId: inviteId } });
  return {
    askMenu: s?.askMenu ?? false,
    askDiet: s?.askDiet ?? false,
    showMenu: s?.showMenu ?? false,
    showTable: s?.showTable ?? false,
  };
}

const SETTING_KEYS = ['askMenu', 'askDiet', 'showMenu', 'showTable'] as const;

export async function saveSettings(inviteId: string, body: Record<string, unknown>) {
  const data: Partial<Record<(typeof SETTING_KEYS)[number], boolean>> = {};
  for (const key of SETTING_KEYS) {
    const v = body[key];
    if (v === undefined) continue;
    if (!isBool(v)) throw new PlannerError(400, 'Проверьте настройки');
    data[key] = v;
  }
  if (!Object.keys(data).length) throw new PlannerError(400, 'Нечего менять');
  await prisma.plannerSettings.upsert({
    where: { invitationId: inviteId },
    create: { invitationId: inviteId, ...data },
    update: data,
  });
  return getSettings(inviteId);
}

export async function createOption(inviteId: string, body: Record<string, unknown>) {
  const label = text(body.label, LIMITS.optionLabel, 'Название');
  const note = text(body.note, LIMITS.optionNote, 'Описание');
  if (!label) throw new PlannerError(400, 'Укажите название варианта');
  const options = await prisma.menuOption.findMany({ where: { invitationId: inviteId }, select: { label: true, sort: true } });
  if (options.length >= LIMITS.options) throw new PlannerError(409, `Вариантов не больше ${LIMITS.options}`);
  if (options.some((o) => nameKey(o.label) === nameKey(label))) throw new PlannerError(409, `Вариант «${label}» уже есть`);
  return prisma.menuOption.create({
    data: { invitationId: inviteId, label, note, sort: options.reduce((m, o) => Math.max(m, o.sort), 0) + 1 },
  });
}

export async function updateOption(inviteId: string, optionId: string, body: Record<string, unknown>) {
  const option = await prisma.menuOption.findFirst({ where: { id: optionId, invitationId: inviteId } });
  if (!option) throw new PlannerError(404, 'Вариант не найден');
  const data: { label?: string; note?: string } = {};
  if (body.label !== undefined) {
    const label = text(body.label, LIMITS.optionLabel, 'Название');
    if (!label) throw new PlannerError(400, 'Укажите название варианта');
    const twin = (await prisma.menuOption.findMany({ where: { invitationId: inviteId, NOT: { id: optionId } }, select: { label: true } }))
      .some((o) => nameKey(o.label) === nameKey(label));
    if (twin) throw new PlannerError(409, `Вариант «${label}» уже есть`);
    data.label = label;
  }
  if (body.note !== undefined) data.note = text(body.note, LIMITS.optionNote, 'Описание');
  if (!Object.keys(data).length) throw new PlannerError(400, 'Нечего менять');
  return prisma.menuOption.update({ where: { id: optionId }, data });
}

/** Порядок вариантов: присылают все id в новом порядке. */
export async function reorderOptions(inviteId: string, rawIds: unknown) {
  const existing = await prisma.menuOption.findMany({ where: { invitationId: inviteId }, select: { id: true } });
  if (!Array.isArray(rawIds) || rawIds.length !== existing.length || new Set(rawIds).size !== existing.length
      || !rawIds.every((id) => typeof id === 'string' && existing.some((o) => o.id === id))) {
    throw new PlannerError(400, 'Проверьте порядок вариантов');
  }
  await prisma.$transaction((rawIds as string[]).map((id, i) =>
    prisma.menuOption.updateMany({ where: { id, invitationId: inviteId }, data: { sort: i + 1 } })));
  return { ok: true };
}

/** Удаление варианта не теряет ответы молча. Если его кто-то выбрал, нужно решить:
    перенести на другой вариант (reassignTo = id) или отметить «выбор нужно уточнить»
    (reassignTo = 'review'). Перенос и удаление — одной транзакцией. */
export async function deleteOption(inviteId: string, optionId: string, reassignTo?: string) {
  const option = await prisma.menuOption.findFirst({ where: { id: optionId, invitationId: inviteId } });
  if (!option) throw new PlannerError(404, 'Вариант не найден');
  const holders = await prisma.person.count({ where: { menuOptionId: optionId, invitationId: inviteId } });

  let target: string | null = null;
  if (reassignTo && reassignTo !== 'review') {
    if (reassignTo === optionId) throw new PlannerError(400, 'Выберите другой вариант');
    const other = await prisma.menuOption.findFirst({ where: { id: reassignTo, invitationId: inviteId }, select: { id: true } });
    if (!other) throw new PlannerError(404, 'Такого варианта меню нет');
    target = other.id;
  } else if (holders > 0 && reassignTo !== 'review') {
    throw new PlannerError(409,
      `«${option.label}» выбрали ${holders} ${plural(holders, 'гость', 'гостя', 'гостей')}. Перенесите их на другой вариант или отметьте «нужно уточнить»`,
      { code: 'in_use', holders });
  }
  // Перенос всех, кто выбрал вариант к этому моменту, и удаление — одним пакетом: если кто-то
  // успел выбрать его между проверкой и удалением, он тоже попадёт в «нужно уточнить», а не пропадёт
  await prisma.$transaction([
    prisma.person.updateMany({
      where: { menuOptionId: optionId, invitationId: inviteId },
      data: { menuOptionId: target, menuReview: target === null },
    }),
    prisma.menuOption.deleteMany({ where: { id: optionId, invitationId: inviteId } }),
  ]);
  return { moved: holders, mode: target ? 'moved' : 'review' };
}
