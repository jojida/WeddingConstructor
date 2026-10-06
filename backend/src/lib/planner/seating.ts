// Столы и посадка. Все инварианты (вместимость, один стол на человека, чужое приглашение)
// проверяются здесь, на сервере, а не в интерфейсе.
//
// Вместимость проверяется ВНУТРИ одного SQL-оператора (условный UPDATE): SQLite выполняет
// оператор целиком под блокировкой записи, поэтому две вкладки, бьющие в последнее место,
// получают «одна посажена, вторая — отказ» без таймаутов и без превышения. Интерактивная
// транзакция Prisma «прочитать — сравнить — записать» под нагрузкой на SQLite падает по таймауту.
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { LIMITS, PlannerError, cleanText, intInRange, plural } from './util';
import { loadRoster, partyKeyOfPerson } from './roster';

const SHAPES = ['round', 'long'] as const;
const isShape = (v: unknown): v is (typeof SHAPES)[number] => typeof v === 'string' && (SHAPES as readonly string[]).includes(v);

const places = (n: number) => `${n} ${plural(n, 'место', 'места', 'мест')}`;

/* ── Посадка ───────────────────────────────────────────────────────────────── */

export async function assignPersons(inviteId: string, rawIds: unknown, rawTableId: unknown): Promise<{ assigned: number }> {
  if (!Array.isArray(rawIds) || rawIds.some((x) => typeof x !== 'string' || !x || x.length > 64)) {
    throw new PlannerError(400, 'Укажите, кого посадить');
  }
  const ids = [...new Set(rawIds as string[])];
  if (ids.length === 0 || ids.length > LIMITS.seatBatch) {
    throw new PlannerError(400, `За один раз можно посадить от 1 до ${LIMITS.seatBatch} человек`);
  }
  if (rawTableId !== null && (typeof rawTableId !== 'string' || !rawTableId || rawTableId.length > 64)) {
    throw new PlannerError(400, 'Укажите стол');
  }
  const tableId = rawTableId as string | null;

  // Люди — только этого приглашения: чужие id не найдутся
  const persons = await prisma.person.findMany({ where: { id: { in: ids }, invitationId: inviteId } });
  if (persons.length !== ids.length) throw new PlannerError(404, 'Гость не найден');

  if (tableId === null) {
    await prisma.person.updateMany({ where: { id: { in: ids }, invitationId: inviteId }, data: { tableId: null } });
    return { assigned: ids.length };
  }

  const table = await prisma.seatTable.findFirst({ where: { id: tableId, invitationId: inviteId } });
  if (!table) throw new PlannerError(404, 'Стол не найден');

  // Отказавшихся и убранных из списка за стол не сажаем
  const { parties } = await loadRoster(inviteId);
  const status = new Map(parties.map((p) => [p.key, p.status]));
  const blocked = persons.filter((p) => p.excluded || status.get(partyKeyOfPerson(p) ?? '') === 'no');
  if (blocked.length) {
    throw new PlannerError(409, 'Отказавшихся и убранных из списка гостей за стол сажать нельзя', {
      code: 'not_seatable', ids: blocked.map((p) => p.id),
    });
  }

  const idList = Prisma.join(ids);
  const changed = await prisma.$executeRaw`
    UPDATE "Person" SET "tableId" = ${tableId}
    WHERE "invitationId" = ${inviteId} AND "id" IN (${idList})
      AND (SELECT COUNT(*) FROM "Person" WHERE "tableId" = ${tableId} AND "id" NOT IN (${idList})) + ${ids.length}
          <= (SELECT "capacity" FROM "SeatTable" WHERE "id" = ${tableId} AND "invitationId" = ${inviteId})`;
  if (changed === ids.length) return { assigned: ids.length };

  // Не посадили: стол успели удалить или места не хватило — отвечаем по свежим данным
  const fresh = await prisma.seatTable.findFirst({ where: { id: tableId, invitationId: inviteId } });
  if (!fresh) throw new PlannerError(404, 'Стол не найден');
  const [row] = await prisma.$queryRaw<{ n: bigint | number }[]>`
    SELECT COUNT(*) AS n FROM "Person" WHERE "tableId" = ${tableId} AND "id" NOT IN (${idList})`;
  const free = Math.max(0, fresh.capacity - Number(row?.n ?? 0));
  throw new PlannerError(409, `За столом «${fresh.name}» свободно ${places(free)}, а нужно ${places(ids.length)}`, {
    code: 'full', free, need: ids.length, capacity: fresh.capacity, table: fresh.name,
  });
}

/* ── Столы ─────────────────────────────────────────────────────────────────── */

const isNameTaken = (e: unknown): boolean =>
  (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2002' || /UNIQUE constraint failed/i.test(e.message)));

export async function createTable(inviteId: string, body: Record<string, unknown>) {
  const name = cleanText(body.name, LIMITS.tableName);
  const capacity = intInRange(body.capacity, 1, LIMITS.capacityMax);
  const shape = body.shape === undefined ? 'round' : body.shape;
  if (!name) throw new PlannerError(400, 'Укажите название или номер стола');
  if (capacity === null) throw new PlannerError(400, `Вместимость: от 1 до ${LIMITS.capacityMax} мест`);
  if (!isShape(shape)) throw new PlannerError(400, 'Неизвестная форма стола');
  const count = await prisma.seatTable.count({ where: { invitationId: inviteId } });
  if (count >= LIMITS.tables) throw new PlannerError(409, `Столов не больше ${LIMITS.tables}`);
  const last = await prisma.seatTable.aggregate({ where: { invitationId: inviteId }, _max: { sort: true } });
  try {
    return await prisma.seatTable.create({
      data: { invitationId: inviteId, name, capacity, shape, sort: (last._max.sort ?? 0) + 1 },
    });
  } catch (e) {
    if (isNameTaken(e)) throw new PlannerError(409, `Стол «${name}» уже есть — выберите другое название`);
    throw e;
  }
}

/** Несколько столов сразу: «7 столов по 10 мест». Названия — свободные номера по порядку. */
export async function createTables(inviteId: string, body: Record<string, unknown>) {
  const count = intInRange(body.count, 1, 50);
  const capacity = intInRange(body.capacity, 1, LIMITS.capacityMax);
  const shape = body.shape === undefined ? 'round' : body.shape;
  if (count === null) throw new PlannerError(400, 'Сколько столов: от 1 до 50');
  if (capacity === null) throw new PlannerError(400, `Вместимость: от 1 до ${LIMITS.capacityMax} мест`);
  if (!isShape(shape)) throw new PlannerError(400, 'Неизвестная форма стола');
  const existing = await prisma.seatTable.findMany({ where: { invitationId: inviteId }, select: { name: true, sort: true } });
  if (existing.length + count > LIMITS.tables) throw new PlannerError(409, `Столов не больше ${LIMITS.tables}`);
  const used = new Set(existing.map((t) => t.name));
  let sort = existing.reduce((m, t) => Math.max(m, t.sort), 0);
  const creates: Prisma.PrismaPromise<unknown>[] = [];
  for (let n = 1, made = 0; made < count; n++) {
    if (used.has(String(n))) continue;
    creates.push(prisma.seatTable.create({ data: { invitationId: inviteId, name: String(n), capacity, shape, sort: ++sort } }));
    made++;
  }
  await prisma.$transaction(creates);
  return { created: count };
}

export async function updateTable(inviteId: string, tableId: string, body: Record<string, unknown>) {
  const current = await prisma.seatTable.findFirst({ where: { id: tableId, invitationId: inviteId } });
  if (!current) throw new PlannerError(404, 'Стол не найден');

  const name = body.name === undefined ? current.name : cleanText(body.name, LIMITS.tableName);
  const capacity = body.capacity === undefined ? current.capacity : intInRange(body.capacity, 1, LIMITS.capacityMax);
  const shape = body.shape === undefined ? current.shape : body.shape;
  if (!name) throw new PlannerError(400, 'Укажите название или номер стола');
  if (capacity === null) throw new PlannerError(400, `Вместимость: от 1 до ${LIMITS.capacityMax} мест`);
  if (!isShape(shape)) throw new PlannerError(400, 'Неизвестная форма стола');

  if (name !== current.name) {
    const twin = await prisma.seatTable.findFirst({ where: { invitationId: inviteId, name, NOT: { id: tableId } }, select: { id: true } });
    if (twin) throw new PlannerError(409, `Стол «${name}» уже есть — выберите другое название`);
  }

  // Одним оператором: вместимость нельзя опустить ниже числа сидящих, даже если в этот
  // момент кого-то садят с другой вкладки
  let changed: number;
  try {
    changed = await prisma.$executeRaw`
      UPDATE "SeatTable" SET "name" = ${name}, "capacity" = ${capacity}, "shape" = ${shape}
      WHERE "id" = ${tableId} AND "invitationId" = ${inviteId}
        AND (SELECT COUNT(*) FROM "Person" WHERE "tableId" = "SeatTable"."id") <= ${capacity}`;
  } catch (e) {
    if (isNameTaken(e)) throw new PlannerError(409, `Стол «${name}» уже есть — выберите другое название`);
    throw e;
  }
  if (changed === 0) {
    const seated = await prisma.person.count({ where: { tableId, invitationId: inviteId } });
    if (!(await prisma.seatTable.findFirst({ where: { id: tableId, invitationId: inviteId }, select: { id: true } }))) {
      throw new PlannerError(404, 'Стол не найден');
    }
    throw new PlannerError(409,
      `За столом «${current.name}» сидят ${seated} ${plural(seated, 'человек', 'человека', 'человек')} — сначала пересадите лишних`,
      { code: 'too_small', seated });
  }
  return prisma.seatTable.findFirst({ where: { id: tableId, invitationId: inviteId } });
}

/** Удаление стола требует подтверждения, если за ним кто-то сидит. Люди остаются в списке
    нераспределёнными — их удалять нельзя. */
export async function deleteTable(inviteId: string, tableId: string, confirmed: boolean): Promise<{ released: number }> {
  const table = await prisma.seatTable.findFirst({ where: { id: tableId, invitationId: inviteId } });
  if (!table) throw new PlannerError(404, 'Стол не найден');
  const seated = await prisma.person.count({ where: { tableId, invitationId: inviteId } });
  if (seated > 0 && !confirmed) {
    throw new PlannerError(409, `За столом «${table.name}» сидят ${seated} ${plural(seated, 'человек', 'человека', 'человек')}. Они станут нераспределёнными`, {
      code: 'needs_confirm', seated,
    });
  }
  await prisma.$transaction([
    prisma.person.updateMany({ where: { tableId, invitationId: inviteId }, data: { tableId: null } }),
    prisma.seatTable.deleteMany({ where: { id: tableId, invitationId: inviteId } }),
  ]);
  return { released: seated };
}
