// Люди и группы: добавить, поправить, убрать из списка, вставить список имён.
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { isSalutation } from '../plans';
import { LIMITS, PlannerError, cleanText, isBool, nameKey, plural } from './util';
import { parsePartyKey, reconcile } from './roster';

const genToken = (): string => crypto.randomBytes(16).toString('base64url');
const isSlotTaken = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

// «Денис и Мария», «Анна, Пётр» — это не одно имя
const looksSingle = (names: string): boolean => !/[,&+]|(^|\s)(и|с)(\s|$)/i.test(names);

function text(value: unknown, max: number, what: string): string {
  const v = cleanText(value, max);
  if (v === null) throw new PlannerError(400, `${what}: не больше ${max} символов`);
  return v;
}

/** Группа должна принадлежать этому приглашению. */
async function requireParty(inviteId: string, rawKey: unknown) {
  const key = parsePartyKey(rawKey);
  if (!key) throw new PlannerError(400, 'Не указана группа');
  const found = key.kind === 'guest'
    ? await prisma.guest.findFirst({ where: { id: key.id, invitationId: inviteId }, select: { id: true } })
    : await prisma.guestResponse.findFirst({ where: { id: key.id, invitationId: inviteId }, select: { id: true } });
  if (!found) throw new PlannerError(404, 'Группа не найдена');
  return key;
}

const partyWhere = (key: { kind: 'guest' | 'response'; id: string }) =>
  key.kind === 'guest' ? { guestId: key.id } : { responseId: key.id };

async function ensureRoom(inviteId: string, adding: number): Promise<void> {
  const total = await prisma.person.count({ where: { invitationId: inviteId } });
  if (total + adding > LIMITS.persons) throw new PlannerError(409, `В списке не больше ${LIMITS.persons} человек`);
}

/** Добавить человека в существующую группу (плюс-один, ребёнок, гость, которого назвали по телефону). */
export async function createPerson(inviteId: string, body: Record<string, unknown>) {
  const key = await requireParty(inviteId, body.partyKey);
  const name = text(body.name, LIMITS.name, 'Имя');
  const tag = text(body.tag, LIMITS.tag, 'Метка');
  if (body.isChild !== undefined && !isBool(body.isChild)) throw new PlannerError(400, 'Проверьте поля');
  await ensureRoom(inviteId, 1);
  const where = partyWhere(key);
  for (let attempt = 0; ; attempt++) {
    const last = await prisma.person.aggregate({ where, _max: { slot: true } });
    try {
      return await prisma.person.create({
        data: { invitationId: inviteId, ...where, slot: (last._max.slot ?? -1) + 1, name, tag, isChild: body.isChild === true },
      });
    } catch (e) {
      if (!isSlotTaken(e) || attempt > 0) throw e;   // другая вкладка заняла тот же номер — берём следующий
    }
  }
}

export async function updatePerson(inviteId: string, personId: string, body: Record<string, unknown>) {
  const person = await prisma.person.findFirst({ where: { id: personId, invitationId: inviteId }, select: { id: true } });
  if (!person) throw new PlannerError(404, 'Гость не найден');

  const data: Prisma.PersonUncheckedUpdateInput = {};
  if (body.name !== undefined) data.name = text(body.name, LIMITS.name, 'Имя');
  if (body.diet !== undefined) data.diet = text(body.diet, LIMITS.diet, 'Пищевые ограничения');
  if (body.tag !== undefined) data.tag = text(body.tag, LIMITS.tag, 'Метка');
  if (body.isChild !== undefined) {
    if (!isBool(body.isChild)) throw new PlannerError(400, 'Проверьте поля');
    data.isChild = body.isChild;
  }
  if (body.excluded !== undefined) {
    if (!isBool(body.excluded)) throw new PlannerError(400, 'Проверьте поля');
    data.excluded = body.excluded;
    if (body.excluded) data.tableId = null;          // убранный из списка не занимает место
  }
  if (body.menuOptionId !== undefined) {
    if (body.menuOptionId === null) {
      data.menuOptionId = null;
    } else if (typeof body.menuOptionId === 'string') {
      const option = await prisma.menuOption.findFirst({ where: { id: body.menuOptionId, invitationId: inviteId }, select: { id: true } });
      if (!option) throw new PlannerError(404, 'Такого варианта меню нет');
      data.menuOptionId = option.id;
    } else {
      throw new PlannerError(400, 'Проверьте поля');
    }
    data.menuReview = false;                        // выбор сделан заново — уточнять больше нечего
  }
  if (Object.keys(data).length === 0) throw new PlannerError(400, 'Нечего менять');
  return prisma.person.update({ where: { id: personId }, data });
}

/** Метка группы («Семья жениха») — всем людям группы сразу. */
export async function setPartyTag(inviteId: string, rawKey: unknown, rawTag: unknown) {
  const key = await requireParty(inviteId, rawKey);
  const tag = text(rawTag, LIMITS.tag, 'Метка');
  const res = await prisma.person.updateMany({ where: { invitationId: inviteId, ...partyWhere(key) }, data: { tag } });
  return { updated: res.count };
}

/** Новое приглашение вручную: это обычный Guest (появится и во вкладке «Гости», и сможет
    получить персональную ссылку), поэтому список гостей остаётся один. */
export async function createParty(inviteId: string, body: Record<string, unknown>) {
  const names = text(body.names, 200, 'Имена');
  if (!names) throw new PlannerError(400, 'Укажите имя гостя');
  const salutation = body.salutation === undefined ? 'дорогие' : body.salutation;
  if (typeof salutation !== 'string' || !isSalutation(salutation)) throw new PlannerError(400, 'Неверное обращение');

  const rawPeople = body.people === undefined ? [] : body.people;
  if (!Array.isArray(rawPeople) || rawPeople.length > LIMITS.partyPeople) {
    throw new PlannerError(400, `В одном приглашении не больше ${LIMITS.partyPeople} человек`);
  }
  const people = rawPeople.map((p) => {
    const item = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
    return { name: text(item.name, LIMITS.name, 'Имя'), isChild: item.isChild === true };
  });
  await ensureRoom(inviteId, Math.max(1, people.length));

  const guest = await prisma.guest.create({
    data: {
      invitationId: inviteId, token: genToken(), salutation, names,
      persons: { create: people.map((p, slot) => ({ invitationId: inviteId, slot, name: p.name, isChild: p.isChild })) },
    },
  });
  if (!people.length) await reconcile(inviteId, `g:${guest.id}`);
  return guest;
}

/** Вставка списка имён: каждая строка — отдельное приглашение, «Иван Петров +2» — ещё двое без имён.
    Уже существующие имена пропускаются, чтобы повторная вставка не плодила дубли. */
export async function importGuests(inviteId: string, body: Record<string, unknown>) {
  const raw = body.text;
  if (typeof raw !== 'string' || !raw.trim()) throw new PlannerError(400, 'Вставьте список имён — по одному в строке');
  if (Buffer.byteLength(raw, 'utf8') > LIMITS.importBytes) throw new PlannerError(413, 'Список слишком большой');
  const salutation = body.salutation === undefined ? 'дорогие' : body.salutation;
  if (typeof salutation !== 'string' || !isSalutation(salutation)) throw new PlannerError(400, 'Неверное обращение');

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > LIMITS.importLines) throw new PlannerError(413, `Не больше ${LIMITS.importLines} строк за раз`);

  const known = new Set((await prisma.guest.findMany({ where: { invitationId: inviteId }, select: { names: true } })).map((g) => nameKey(g.names)));
  const skipped: string[] = [];
  const invalid: string[] = [];
  const plans: { names: string; salutation: string; people: { name: string; isChild: boolean }[] }[] = [];
  let people = 0;

  for (const line of lines) {
    const m = /^(.*?)\s*\+\s*(\d{1,2})$/.exec(line);
    let names = cleanText(m ? m[1] : line, 200);
    const extra = m ? Math.min(Number(m[2]), LIMITS.partyPeople - 1) : 0;
    // «Семья Ивановых» — приглашение семьи: обращение «Семья Ивановых», люди без имён
    let lineSalutation: string = salutation;
    const family = names ? /^семья\s+(.+)$/i.exec(names) : null;
    if (family) { names = family[1]; lineSalutation = 'семья'; }
    if (!names) { invalid.push(line.slice(0, 40)); continue; }
    if (known.has(nameKey(names))) { skipped.push(names); continue; }
    known.add(nameKey(names));
    // Названного человека создаём, только если строка — одно имя; «Денис и Мария» и семьи уточнятся позже
    const named = lineSalutation !== 'семья' && looksSingle(names) && names.length <= LIMITS.name;
    const list = [{ name: named ? names : '', isChild: false }, ...Array.from({ length: extra }, () => ({ name: '', isChild: false }))];
    people += list.length;
    plans.push({ names, salutation: lineSalutation, people: list });
  }
  if (!plans.length) return { created: 0, skipped, invalid };
  await ensureRoom(inviteId, people);

  await prisma.$transaction(plans.map((p) => prisma.guest.create({
    data: {
      invitationId: inviteId, token: genToken(), salutation: p.salutation, names: p.names,
      persons: { create: p.people.map((x, slot) => ({ invitationId: inviteId, slot, name: x.name, isChild: x.isChild })) },
    },
  })));
  return { created: plans.length, skipped, invalid };
}

export const peopleWord = (n: number): string => plural(n, 'человек', 'человека', 'человек');
