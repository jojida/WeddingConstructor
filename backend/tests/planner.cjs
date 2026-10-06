// Меню и рассадка: доступ, синхронизация состава с анкетой, посадка и гонки за места,
// удаление столов и вариантов меню, CSV. HTTP-запросы к настоящему приложению на отдельной
// временной базе, собранной из prisma/migrations (как в security.cjs и print.cjs).
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const jwt = require('jsonwebtoken');

const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, '.test-tmp'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(root, '.test-tmp/planner-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'planner-suite-secret-at-least-32-characters-long';
process.env.DATABASE_URL = `file:${path.join(tmp, 'test.db').replace(/\\/g, '/')}`;
for (const key of ['RESEND_API_KEY', 'BREVO_API_KEY', 'SMTP_USER', 'SMTP_PASS', 'TELEGRAM_BOT_TOKEN', 'YOOKASSA_SHOP_ID', 'YOOKASSA_SECRET_KEY', 'YUMONEY_SHOP_ID', 'YUMONEY_SECRET_KEY', 'FREE_ACCOUNTS', 'PLANNER_PUBLIC']) process.env[key] = '';
const db = new DatabaseSync(path.join(tmp, 'test.db'));
for (const dir of fs.readdirSync(path.join(root, 'prisma/migrations')).sort()) {
  const file = path.join(root, 'prisma/migrations', dir, 'migration.sql');
  if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
}
db.close();

const prisma = require('../dist/lib/prisma').default;
const { planParty, buildParties } = require('../dist/lib/planner/roster');
const { csvCell, toCsv } = require('../dist/lib/planner/csv');
const { planAutoseat } = require('../dist/lib/planner/autoseat');
const { ensureSchema } = require('../dist/lib/ensureSchema');
const app = require('../dist/index').default;
let server;
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect();
  fs.rmSync(tmp, { recursive: true });
});

/* ── Чистые функции ───────────────────────────────────────────────────────── */

const party = (over = {}) => ({
  key: 'g:1', kind: 'guest', guestId: '1', responseId: null, label: 'Денис и Мария', status: 'yes', want: 2, kids: 0,
  createdAt: new Date(0), answeredAt: new Date(0), seatWish: '', note: '', singleName: '', respondent: '', ...over,
});
const row = (slot, over = {}) => ({
  id: 'p' + slot, invitationId: 'i', guestId: '1', responseId: null, slot, name: '', isChild: false, excluded: false,
  menuOptionId: null, menuReview: false, diet: '', tag: '', tableId: null, ...over,
});

test('planParty: людей столько, сколько назвал гость; имён не выдумывает', () => {
  const plan = planParty(party({ want: 3, kids: 1 }), []);
  assert.deepEqual(plan.create.map((c) => [c.slot, c.name, c.isChild]), [[0, '', false], [1, '', false], [2, '', true]]);
  // единственный гость с обращением «дорогая» — имя известно; в группе из двоих — нет
  assert.equal(planParty(party({ want: 1, singleName: 'Анна' }), []).create[0].name, 'Анна');
  assert.equal(planParty(party({ want: 2, singleName: 'Анна' }), []).create[0].name, '');
  // по общей ссылке первым идёт назвавшийся в анкете
  const byLink = planParty(party({ kind: 'response', guestId: null, responseId: 'r', want: 2, respondent: 'Иван Петров' }), []);
  assert.deepEqual(byLink.create.map((c) => c.name), ['Иван Петров', '']);
});

test('planParty: лишних убирает только пустые заготовки, названных и посаженных не трогает', () => {
  const rows = [row(0, { name: 'Денис' }), row(1, { name: 'Мария', tableId: 't' }), row(2), row(3, { excluded: true })];
  const plan = planParty(party({ want: 2 }), rows);
  assert.deepEqual(plan.remove.sort(), ['p2', 'p3']);
  // заготовок нет — молча ничего не удаляем
  assert.deepEqual(planParty(party({ want: 1 }), rows.slice(0, 2)).remove, []);
});

test('planParty: убранный из списка человек остаётся «учтённым» и не воскресает', () => {
  const rows = [row(0, { name: 'Денис' }), row(1, { excluded: true })];
  const plan = planParty(party({ want: 2 }), rows);
  assert.deepEqual(plan.create, []);
  assert.deepEqual(plan.remove, []);
});

test('planParty: отказ снимает со стола, имя в пустую строку — только пустую', () => {
  const rows = [row(0, { tableId: 't1' }), row(1, { tableId: 't2', name: 'Мария' })];
  assert.deepEqual(planParty(party({ status: 'no', want: 1 }), rows).unseat.sort(), ['p0', 'p1']);
  const fill = planParty(party({ want: 1, singleName: 'Анна' }), [row(0), row(5, { name: 'Иной' })]);
  assert.deepEqual(fill.fill, [{ id: 'p0', name: 'Анна' }]);
  assert.deepEqual(planParty(party({ want: 1, singleName: 'Анна' }), [row(0, { name: 'Аня' })]).fill, []);
});

test('buildParties: последний ответ гостя, ответы без гостя — отдельные группы', () => {
  const guests = [{ id: 'g1', names: 'Анна', salutation: 'дорогая', createdAt: new Date(1) }];
  const base = { invitationId: 'i', attending: true, attendance: 'yes', guestsCount: 1, childrenCount: 0, answers: '[]' };
  const responses = [
    { ...base, id: 'r1', guestId: 'g1', guestName: 'Анна', createdAt: new Date(2), attending: false, attendance: 'no' },
    { ...base, id: 'r2', guestId: 'g1', guestName: 'Анна', createdAt: new Date(3), guestsCount: 2 },
    { ...base, id: 'r3', guestId: null, guestName: 'Иван', createdAt: new Date(4) },
    { ...base, id: 'r4', guestId: 'deleted', guestName: 'Пётр', createdAt: new Date(5) },
  ];
  const parties = buildParties(guests, responses);
  assert.deepEqual(parties.map((p) => [p.key, p.status, p.want]), [['g:g1', 'yes', 2], ['r:r3', 'yes', 1], ['r:r4', 'yes', 1]]);
});

test('авторассадка: группа целиком, метки рядом, большая группа делится, нехватка мест', () => {
  const tables = [{ id: 't1', free: 4, tags: [], order: 0 }, { id: 't2', free: 4, tags: [], order: 1 }];
  const plan = planAutoseat(tables, [
    { key: 'a', tag: 'жених', ids: ['a1', 'a2', 'a3'], order: 0 },
    { key: 'b', tag: 'невеста', ids: ['b1', 'b2', 'b3'], order: 1 },
    { key: 'c', tag: 'жених', ids: ['c1'], order: 2 },
  ]);
  const at = (id) => plan.placements.find((p) => p.personId === id).tableId;
  assert.deepEqual(['a1', 'a2', 'a3', 'c1'].map(at), ['t1', 't1', 't1', 't1']);   // «жених» сидят вместе
  assert.deepEqual(['b1', 'b2', 'b3'].map(at), ['t2', 't2', 't2']);
  assert.deepEqual(plan.unplaced, []);
  // кто-то из группы уже сидит — остальных ищем за тем же столом, даже если другой «плотнее»
  const withAnchor = planAutoseat([{ id: 'p', free: 2, tags: [], order: 0 }, { id: 'q', free: 5, tags: [], order: 1 }],
    [{ key: 'f', tag: '', ids: ['f2', 'f3'], order: 0, anchor: 'q' }]);
  assert.deepEqual(withAnchor.placements.map((x) => x.tableId), ['q', 'q']);
  // не помещаются все за свой стол — добиваем его, остаток уходит дальше
  const overflow = planAutoseat([{ id: 'p', free: 5, tags: [], order: 0 }, { id: 'q', free: 1, tags: [], order: 1 }],
    [{ key: 'f', tag: '', ids: ['f2', 'f3', 'f4', 'f5', 'f6', 'f7'], order: 0, anchor: 'q' }]);
  assert.equal(overflow.placements.filter((x) => x.tableId === 'q').length, 1);
  assert.equal(overflow.placements.filter((x) => x.tableId === 'p').length, 5);
  // группа больше любого стола делится по самым свободным; нехватка мест — в «не рассажены»
  const split = planAutoseat([{ id: 'x', free: 2, tags: [], order: 0 }, { id: 'y', free: 2, tags: [], order: 1 }],
    [{ key: 'g', tag: '', ids: ['1', '2', '3'], order: 0 }]);
  assert.deepEqual(split.placements.map((p) => p.tableId), ['x', 'x', 'y']);
  const short = planAutoseat([{ id: 'x', free: 2, tags: [], order: 0 }], [{ key: 'g', tag: '', ids: ['1', '2', '3'], order: 0 }]);
  assert.equal(short.placements.length, 2);
  assert.deepEqual(short.unplaced, ['3']);
  // никогда не больше свободных мест
  const none = planAutoseat([{ id: 'x', free: 0, tags: [], order: 0 }], [{ key: 'g', tag: '', ids: ['1'], order: 0 }]);
  assert.deepEqual([none.placements.length, none.unplaced.length], [0, 1]);
});

test('CSV: кириллица, кавычки, формулы', () => {
  assert.equal(csvCell('Иван Петров'), 'Иван Петров');
  assert.equal(csvCell('Иван; Мария'), '"Иван; Мария"');
  assert.equal(csvCell('Он сказал "да"'), '"Он сказал ""да"""');
  for (const bad of ['=1+1', '+7 999', '-5', '@SUM(A1)', '\tTab']) assert.ok(csvCell(bad).startsWith("'"), bad);
  const csv = toCsv([['Стол', 'Гость'], ['1', 'А']]);
  assert.ok(csv.startsWith('﻿Стол;Гость\r\n'));
});

/* ── Через HTTP ───────────────────────────────────────────────────────────── */

test('меню и рассадка на изолированной базе', async (t) => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (url, method = 'GET', body, token) => {
    const res = await fetch(base + url, {
      method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const type = res.headers.get('content-type') || '';
    // CSV читаем сырыми байтами: fetch.text() молча срезает BOM, а он нужен русскому Excel
    if (type.includes('json')) return { status: res.status, headers: res.headers, json: await res.json(), text: '' };
    return { status: res.status, headers: res.headers, json: undefined, text: Buffer.from(await res.arrayBuffer()).toString('utf8') };
  };

  const owner = await prisma.user.create({ data: { email: 'planner-owner@example.test' } });
  const stranger = await prisma.user.create({ data: { email: 'planner-stranger@example.test' } });
  const sign = (u) => jwt.sign({ userId: u.id }, process.env.JWT_SECRET);
  const tok = sign(owner), otherTok = sign(stranger);
  process.env.FREE_ACCOUNTS = 'planner-owner@example.test, planner-stranger@example.test';

  const mk = (userId, slug, plan = 'premium') => prisma.invitation.create({ data: { userId, slug, templateId: 'calla', status: 'paid', plan } });
  const inv = await mk(owner.id, 'planner-main');
  const P = (route = '') => `/api/planner/${inv.id}${route}`;
  const snap = async () => (await call(P(), 'GET', undefined, tok)).json;
  const people = async (partyKey) => (await snap()).persons.filter((p) => !partyKey || p.partyKey === partyKey);
  const addParty = async (names, list = [{}], salutation = 'дорогие') => {
    const r = await call(P('/parties'), 'POST', { names, salutation, people: list }, tok);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    return { guest: r.json.result, key: `g:${r.json.result.id}`, ids: r.json.snapshot.persons.filter((p) => p.partyKey === `g:${r.json.result.id}`).map((p) => p.id) };
  };
  const seat = (ids, tableId, token = tok, id = inv.id) => call(`/api/planner/${id}/seat`, 'POST', { personIds: ids, tableId }, token);
  const makeTable = async (name, capacity) => (await call(P('/tables'), 'POST', { name, capacity }, tok)).json.result;
  const rsvp = (slug, body) => call(`/api/rsvp/${slug}`, 'POST', body);

  await t.test('доступ: вход, чужое приглашение, тариф и флаг раскрытия', async () => {
    assert.equal((await call(P())).status, 401);
    assert.equal((await call(P(), 'GET', undefined, otherTok)).status, 404);
    const basic = await mk(owner.id, 'planner-basic', 'basic');
    const denied = await call(`/api/planner/${basic.id}`, 'GET', undefined, tok);
    assert.equal(denied.status, 403);
    assert.equal(denied.json.code, 'plan');
    const closedFor = await prisma.user.create({ data: { email: 'planner-customer@example.test' } });
    const customerInv = await mk(closedFor.id, 'planner-customer');
    const closed = await call(`/api/planner/${customerInv.id}`, 'GET', undefined, sign(closedFor));
    assert.equal(closed.status, 403);
    assert.equal(closed.json.code, 'beta');
    process.env.PLANNER_PUBLIC = '1';
    try { assert.equal((await call(`/api/planner/${customerInv.id}`, 'GET', undefined, sign(closedFor))).status, 200); }
    finally { process.env.PLANNER_PUBLIC = ''; }
    // /auth/me сообщает интерфейсу, открыт ли раздел
    assert.equal((await call('/api/auth/me', 'GET', undefined, tok)).json.planner, true);
    assert.equal((await call('/api/auth/me', 'GET', undefined, sign(closedFor))).json.planner, false);
  });

  await t.test('старые ответы становятся людьми при первой синхронизации, повторная ничего не меняет', async () => {
    const legacy = await mk(owner.id, 'planner-legacy');
    const L = (route = '') => `/api/planner/${legacy.id}${route}`;
    const guest = await prisma.guest.create({ data: { invitationId: legacy.id, token: 'legacy-g', names: 'Анна', salutation: 'дорогая' } });
    const solo = await prisma.guest.create({ data: { invitationId: legacy.id, token: 'legacy-s', names: 'Денис и Мария', salutation: 'дорогие' } });
    const base = { invitationId: legacy.id, attending: true, attendance: 'yes', answers: '[]' };
    const r1 = await prisma.guestResponse.create({ data: { ...base, guestId: guest.id, guestName: 'Анна', guestsCount: 1 } });
    await prisma.guest.update({ where: { id: guest.id }, data: { responseId: r1.id } });
    await prisma.guestResponse.create({ data: { ...base, guestName: 'Иван Петров', guestsCount: 3, childrenCount: 1,
      answers: JSON.stringify([{ id: 'seat', q: 'С кем сидеть', a: 'С Сидоровыми', t: 'text' }, { id: 'allergy', q: 'Аллергия', a: 'Орехи', t: 'text' }]) } });
    await prisma.guestResponse.create({ data: { ...base, guestName: 'Пётр', guestsCount: 1, attending: false, attendance: 'no' } });

    const first = await call(L('/sync'), 'POST', {}, tok);
    assert.equal(first.status, 200);
    const s = first.json.snapshot;
    const names = (key) => s.persons.filter((p) => p.partyKey === key).sort((a, b) => a.slot - b.slot);
    assert.deepEqual(names(`g:${guest.id}`).map((p) => p.name), ['Анна']);                 // единственная гостья по обращению
    assert.deepEqual(names(`g:${solo.id}`).map((p) => [p.name, p.status]), [['', 'none']]); // не ответил: одна заготовка без выдуманного имени
    const ivan = s.parties.find((p) => p.label === 'Иван Петров');
    assert.equal(ivan.seatWish, 'С Сидоровыми');
    assert.equal(ivan.note, 'Орехи');
    assert.deepEqual(names(ivan.key).map((p) => [p.name, p.isChild]), [['Иван Петров', false], ['', false], ['', true]]);
    assert.equal(s.summary.headcount.yes.count, 4);                                          // Анна + трое Ивана
    assert.equal(s.summary.headcount.no.count, 1);
    assert.equal(s.summary.headcount.none.count, 1);
    assert.equal(s.summary.seating.unnamed.count, 3);                                        // две заготовки Ивана и «Денис и Мария»
    const second = await call(L('/sync'), 'POST', {}, tok);
    assert.equal(second.json.snapshot.persons.length, s.persons.length);
    // ответы остались на месте
    assert.equal(await prisma.guestResponse.count({ where: { invitationId: legacy.id } }), 3);
  });

  await t.test('анкета: люди подтягиваются сразу; повторный ответ не удаляет названных', async () => {
    const pub = await rsvp(inv.slug, { guestName: 'Ольга Смирнова', attendance: 'yes', guestsCount: 2 });
    assert.equal(pub.status, 200);
    const olga = (await snap()).parties.find((p) => p.label === 'Ольга Смирнова');
    assert.ok(olga, 'группа появилась без ручной синхронизации');
    assert.deepEqual((await people(olga.key)).map((p) => p.name).sort(), ['', 'Ольга Смирнова']);

    const guest = await prisma.guest.create({ data: { invitationId: inv.id, token: 'rsvp-token-1', names: 'Семья Кореловых', salutation: 'дорогие' } });
    const key = `g:${guest.id}`;
    await rsvp(inv.slug, { guestToken: guest.token, attendance: 'yes', guestsCount: 3, childrenCount: 1 });
    assert.equal((await people(key)).length, 3);
    // владелец назвал одного и посадил его — повторный ответ «один человек» его не удалит
    const [first] = (await people(key)).sort((a, b) => a.slot - b.slot);
    await call(P(`/persons/${first.id}`), 'PUT', { name: 'Корелов Пётр' }, tok);
    await rsvp(inv.slug, { guestToken: guest.token, attendance: 'yes', guestsCount: 1 });
    const left = await people(key);
    assert.equal(left.length, 1);
    assert.equal(left[0].name, 'Корелов Пётр');
    assert.equal((await snap()).summary.seating.excess.length, 0);
    // два названных человека, гость пишет «один» — оба остаются, а владельцу показывается расхождение
    const second = (await call(P('/persons'), 'POST', { partyKey: key, name: 'Корелова Анна' }, tok)).json.result;
    await rsvp(inv.slug, { guestToken: guest.token, attendance: 'yes', guestsCount: 1 });
    assert.equal((await people(key)).filter((p) => !p.excluded).length, 2);
    assert.deepEqual((await snap()).summary.seating.excess.map((e) => [e.label, e.want, e.have]), [['Семья Кореловых', 1, 2]]);
    await call(P(`/persons/${second.id}`), 'PUT', { excluded: true }, tok);
    assert.equal((await snap()).summary.seating.excess.length, 0);
  });

  await t.test('отказ снимает со стола, показывает уведомление, и повторное «приду» возвращает в нераспределённые', async () => {
    const table = await makeTable('Д1', 4);
    const guest = await prisma.guest.create({ data: { invitationId: inv.id, token: 'decl-token', names: 'Лена', salutation: 'дорогая' } });
    await rsvp(inv.slug, { guestToken: guest.token, attendance: 'yes', guestsCount: 1 });
    const [lena] = await people(`g:${guest.id}`);
    assert.equal(lena.name, 'Лена');
    assert.equal((await seat([lena.id], table.id)).status, 200);
    assert.equal((await people(`g:${guest.id}`))[0].tableId, table.id);

    await rsvp(inv.slug, { guestToken: guest.token, attendance: 'no' });
    const after = await snap();
    assert.equal(after.persons.find((p) => p.id === lena.id).tableId, null);
    const notice = after.notices.find((n) => n.kind === 'declined');
    assert.ok(notice && notice.text.includes('Лена') && notice.text.includes('Д1'), JSON.stringify(after.notices));
    assert.equal((await seat([lena.id], table.id)).status, 409);                             // отказавшихся не сажаем

    await rsvp(inv.slug, { guestToken: guest.token, attendance: 'yes', guestsCount: 1 });
    const back = (await snap()).persons.find((p) => p.id === lena.id);
    assert.equal(back.tableId, null);                                                        // вернулась нераспределённой
    assert.equal(back.status, 'yes');
    assert.equal((await call(P('/notices/seen'), 'POST', {}, tok)).json.snapshot.notices.every((n) => n.seen), true);
  });

  await t.test('вместимость: переполнить нельзя, семья садится целиком или не садится', async () => {
    const table = await makeTable('В2', 3);
    const a = await addParty('Семья А', [{ name: 'А1' }, { name: 'А2' }]);
    const b = await addParty('Семья Б', [{ name: 'Б1' }, { name: 'Б2' }]);
    assert.equal((await seat(a.ids, table.id)).status, 200);
    const full = await seat(b.ids, table.id);                                                // свободно 1, нужно 2
    assert.equal(full.status, 409);
    assert.equal(full.json.code, 'full');
    assert.equal(full.json.free, 1);
    assert.equal((await people(b.key)).filter((p) => p.tableId).length, 0);
    assert.equal((await seat([b.ids[0]], table.id)).status, 200);                            // одного можно
    assert.equal((await seat([b.ids[1]], table.id)).status, 409);                            // второго — нет
    // тот, кто уже за этим столом, не занимает места второй раз
    assert.equal((await seat([b.ids[0]], table.id)).status, 200);
    assert.equal((await snap()).tables.find((x) => x.id === table.id).occupied, 3);
  });

  await t.test('два одновременных запроса на последнее место: сядет один', async () => {
    const table = await makeTable('Г1', 3);
    const group = await addParty('Гонка', Array.from({ length: 10 }, (_, i) => ({ name: `Гость ${i}` })));
    const results = await Promise.all(group.ids.map((id) => seat([id], table.id)));
    assert.equal(results.filter((r) => r.status === 200).length, 3);
    assert.equal(results.filter((r) => r.status === 409).length, 7);
    assert.equal(results.filter((r) => ![200, 409].includes(r.status)).length, 0, 'никаких таймаутов и 500');
    assert.equal((await snap()).tables.find((x) => x.id === table.id).occupied, 3);

    // две семьи по двое за два свободных места: сядет ровно одна, целиком
    const t2 = await makeTable('Г2', 2);
    const f1 = await addParty('Семья Г1', [{ name: 'Г11' }, { name: 'Г12' }]);
    const f2 = await addParty('Семья Г2', [{ name: 'Г21' }, { name: 'Г22' }]);
    const both = await Promise.all([seat(f1.ids, t2.id), seat(f2.ids, t2.id)]);
    assert.deepEqual(both.map((r) => r.status).sort(), [200, 409]);
    assert.equal((await snap()).tables.find((x) => x.id === t2.id).occupied, 2);
  });

  await t.test('вместимость нельзя опустить ниже числа сидящих; удаление стола — только с подтверждением', async () => {
    const table = await makeTable('У1', 3);
    const grp = await addParty('Уменьшение', [{ name: 'У1' }, { name: 'У2' }]);
    await seat(grp.ids, table.id);
    const shrink = await call(P(`/tables/${table.id}`), 'PUT', { capacity: 1 }, tok);
    assert.equal(shrink.status, 409);
    assert.equal(shrink.json.code, 'too_small');
    assert.equal((await call(P(`/tables/${table.id}`), 'PUT', { capacity: 2 }, tok)).status, 200);

    const ask = await call(P(`/tables/${table.id}`), 'DELETE', undefined, tok);
    assert.equal(ask.status, 409);
    assert.equal(ask.json.code, 'needs_confirm');
    assert.equal((await snap()).tables.some((x) => x.id === table.id), true);
    assert.equal((await call(P(`/tables/${table.id}?confirm=1`), 'DELETE', undefined, tok)).status, 200);
    const after = await people(grp.key);
    assert.equal(after.length, 2, 'люди остались в списке');
    assert.ok(after.every((p) => p.tableId === null), 'и стали нераспределёнными');
  });

  await t.test('столы: названия уникальны, лимиты, пачка столов, чужой стол не подойдёт', async () => {
    await makeTable('Уник', 5);
    assert.equal((await call(P('/tables'), 'POST', { name: 'Уник', capacity: 5 }, tok)).status, 409);
    assert.equal((await call(P('/tables'), 'POST', { name: 'x'.repeat(41), capacity: 5 }, tok)).status, 400);
    assert.equal((await call(P('/tables'), 'POST', { name: 'Ноль', capacity: 0 }, tok)).status, 400);
    assert.equal((await call(P('/tables'), 'POST', { name: 'Много', capacity: 51 }, tok)).status, 400);
    const before = (await snap()).tables.length;
    const bulk = await call(P('/tables/bulk'), 'POST', { count: 3, capacity: 8 }, tok);
    assert.equal(bulk.status, 200);
    assert.equal(bulk.json.snapshot.tables.length, before + 3);
    assert.equal(new Set(bulk.json.snapshot.tables.map((x) => x.name)).size, before + 3);
    const strangerInv = await mk(stranger.id, 'planner-stranger');
    const foreign = (await call(`/api/planner/${strangerInv.id}/tables`, 'POST', { name: '1', capacity: 6 }, otherTok)).json.result;
    const mine = await addParty('Свой', [{ name: 'Свой' }]);
    assert.equal((await seat(mine.ids, foreign.id)).status, 404);                           // стол другого приглашения
    assert.equal((await seat(mine.ids, foreign.id, otherTok, strangerInv.id)).status, 404);  // и мой гость в чужом приглашении
    assert.equal((await call(`/api/planner/${strangerInv.id}/persons/${mine.ids[0]}`, 'PUT', { name: 'Взлом' }, otherTok)).status, 404);
    assert.equal((await call(P(`/tables/${foreign.id}`), 'PUT', { name: 'Взлом' }, tok)).status, 404);
  });

  await t.test('меню: варианты, индивидуальный выбор в семье, удаление варианта с ответами', async () => {
    const meat = (await call(P('/menu'), 'POST', { label: 'Мясное', note: 'Говядина' }, tok)).json.result;
    const fish = (await call(P('/menu'), 'POST', { label: 'Рыбное' }, tok)).json.result;
    const kids = (await call(P('/menu'), 'POST', { label: 'Детское' }, tok)).json.result;
    assert.equal((await call(P('/menu'), 'POST', { label: 'мясное' }, tok)).status, 409);       // дубль без учёта регистра
    const family = await addParty('Семья Меню', [{ name: 'Папа' }, { name: 'Мама' }, { name: 'Сын', isChild: true }]);
    await rsvp(inv.slug, { guestToken: family.guest.token, attendance: 'yes', guestsCount: 3, childrenCount: 1 });
    const [dad, mom, son] = family.ids;
    for (const [id, opt] of [[dad, meat], [mom, fish], [son, kids]]) assert.equal((await call(P(`/persons/${id}`), 'PUT', { menuOptionId: opt.id }, tok)).status, 200);
    const s = await snap();
    const count = (o) => s.summary.menu.options.find((x) => x.optionId === o.id).ids.filter((id) => family.ids.includes(id)).length;
    assert.deepEqual([count(meat), count(fish), count(kids)], [1, 1, 1], 'выбор у каждого свой, а не один на семью');

    const mine = await call(P(`/persons/${mom}`), 'PUT', { menuOptionId: 'нет-такого' }, tok);
    assert.equal(mine.status, 404);
    // вариант чужого приглашения подсунуть нельзя
    const strangerInv = await prisma.invitation.findUnique({ where: { slug: 'planner-stranger' } });
    const foreignOption = (await call(`/api/planner/${strangerInv.id}/menu`, 'POST', { label: 'Чужое' }, otherTok)).json.result;
    assert.equal((await call(P(`/persons/${mom}`), 'PUT', { menuOptionId: foreignOption.id }, tok)).status, 404);

    // удаление варианта, который выбрали
    const blocked = await call(P(`/menu/${fish.id}`), 'DELETE', undefined, tok);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.json.code, 'in_use');
    assert.equal((await people(family.key)).find((p) => p.id === mom).menuOptionId, fish.id, 'ответ не потерян');
    assert.equal((await call(P(`/menu/${fish.id}?reassignTo=${meat.id}`), 'DELETE', undefined, tok)).status, 200);
    assert.equal((await people(family.key)).find((p) => p.id === mom).menuOptionId, meat.id);
    const review = await call(P(`/menu/${meat.id}?reassignTo=review`), 'DELETE', undefined, tok);
    assert.equal(review.status, 200);
    const flagged = (await people(family.key)).filter((p) => p.menuReview);
    assert.equal(flagged.length, 2);
    assert.ok(flagged.every((p) => p.menuOptionId === null));
    assert.equal((await snap()).summary.menu.review.ids.filter((id) => family.ids.includes(id)).length, 2);
    // новый выбор снимает «нужно уточнить»
    await call(P(`/persons/${dad}`), 'PUT', { menuOptionId: kids.id }, tok);
    assert.equal((await people(family.key)).find((p) => p.id === dad).menuReview, false);
  });

  await t.test('одинаковые имена у разных гостей — разные люди', async () => {
    const one = await addParty('Анна Иванова', [{ name: 'Анна Иванова' }]);
    const two = await addParty('Анна Иванова (подруга)', [{ name: 'Анна Иванова' }]);
    assert.notEqual(one.ids[0], two.ids[0]);
    const table = await makeTable('Тёзки', 2);
    await seat([one.ids[0]], table.id);
    const after = await people();
    assert.equal(after.find((p) => p.id === one.ids[0]).tableId, table.id);
    assert.equal(after.find((p) => p.id === two.ids[0]).tableId, null);
  });

  await t.test('«убрать из списка»: освобождает место и не воскресает после синхронизации', async () => {
    const table = await makeTable('Убр', 2);
    const grp = await addParty('Убранные', [{ name: 'У1' }, { name: 'У2' }]);
    await seat(grp.ids, table.id);
    await call(P(`/persons/${grp.ids[1]}`), 'PUT', { excluded: true }, tok);
    const after = await call(P('/sync'), 'POST', {}, tok);
    const out = after.json.snapshot.persons.find((p) => p.id === grp.ids[1]);
    assert.equal(out.excluded, true);
    assert.equal(out.tableId, null);
    assert.equal(after.json.snapshot.tables.find((x) => x.id === table.id).occupied, 1);
    assert.equal((await seat([grp.ids[1]], table.id)).status, 409);                         // убранного не сажаем
  });

  await t.test('вставка списка: «+N», дубли пропускаются, лимиты', async () => {
    const r = await call(P('/import'), 'POST', { text: 'Иван Сидоров\nМария Сидорова +2\nИван сидоров\n\nСемья Ивановых +1', salutation: 'дорогие' }, tok);
    assert.equal(r.status, 200);
    assert.equal(r.json.result.created, 3);
    assert.deepEqual(r.json.result.skipped, ['Иван сидоров']);
    const s = r.json.snapshot;
    const maria = s.parties.find((p) => p.label === 'Мария Сидорова');
    assert.deepEqual(s.persons.filter((p) => p.partyKey === maria.key).sort((a, b) => a.slot - b.slot).map((p) => p.name), ['Мария Сидорова', '', '']);
    assert.equal((await call(P('/import'), 'POST', { text: 'x\n'.repeat(301) }, tok)).status, 413);
    assert.equal((await call(P('/import'), 'POST', { text: 'a'.repeat(20_001) }, tok)).status, 413);
    assert.equal((await call(P('/import'), 'POST', { text: '   ' }, tok)).status, 400);
  });

  await t.test('авторассадка: предпросмотр ничего не пишет, применение не превышает места и не трогает отказавшихся', async () => {
    const auto = await mk(owner.id, 'planner-auto');
    const A = (route = '') => `/api/planner/${auto.id}${route}`;
    const party = async (names, count, answer) => {
      const r = await call(A('/parties'), 'POST', { names, people: Array.from({ length: count }, (_, i) => ({ name: `${names} ${i + 1}` })) }, tok);
      const guest = r.json.result;
      if (answer) assert.equal((await rsvp(auto.slug, { guestToken: guest.token, attendance: answer, guestsCount: count })).status, 200);
      return `g:${guest.id}`;
    };
    const t1 = (await call(A('/tables'), 'POST', { name: '1', capacity: 4 }, tok)).json.result;
    const t2 = (await call(A('/tables'), 'POST', { name: '2', capacity: 3 }, tok)).json.result;
    const famA = await party('Семья А', 3, 'yes');
    const famB = await party('Семья Б', 2, 'yes');
    const solo = await party('Одиночка', 1, 'yes');
    const declined = await party('Отказ', 1, 'no');
    const maybe = await party('Сомневается', 1, 'maybe');
    const silent = await party('Молчит', 1);
    const state = async () => (await call(A(), 'GET', undefined, tok)).json;
    const seatedOf = (s, key) => s.persons.filter((p) => p.partyKey === key && p.tableId).length;

    const preview = await call(A('/autoseat'), 'POST', { dryRun: true }, tok);
    assert.equal(preview.status, 200);
    assert.equal(preview.json.result.applied, false);
    assert.equal(preview.json.result.placements.length, 6);
    assert.equal(preview.json.result.unplaced.length, 0);
    assert.equal((await state()).persons.filter((p) => p.tableId).length, 0, 'предпросмотр ничего не записал');

    const run = await call(A('/autoseat'), 'POST', { dryRun: false }, tok);
    assert.equal(run.json.result.applied, true);
    const s = run.json.snapshot;
    assert.equal(seatedOf(s, famA), 3);
    assert.equal(new Set(s.persons.filter((p) => p.partyKey === famA).map((p) => p.tableId)).size, 1, 'семья за одним столом');
    assert.equal(seatedOf(s, famB) + seatedOf(s, solo), 3);
    assert.equal(seatedOf(s, declined) + seatedOf(s, maybe) + seatedOf(s, silent), 0, 'отказавшиеся, сомневающиеся и молчащие — не по умолчанию');
    for (const table of s.tables) assert.ok(table.occupied <= table.capacity, `стол ${table.name}`);
    assert.equal((await call(A('/autoseat'), 'POST', { dryRun: false }, tok)).json.result.placements.length, 0, 'повтор никого не пересаживает');

    // только на выбранных столах: особые столы можно не трогать
    await call(A('/seat'), 'POST', { personIds: s.persons.filter((p) => p.tableId).map((p) => p.id), tableId: null }, tok);
    const onlyT2 = await call(A('/autoseat'), 'POST', { dryRun: true, tableIds: [t2.id] }, tok);
    assert.ok(onlyT2.json.result.placements.every((p) => p.tableId === t2.id));
    assert.equal(onlyT2.json.result.placements.length, 3);
    assert.equal(onlyT2.json.result.unplaced.length, 3);
    await call(A('/autoseat'), 'POST', { dryRun: false }, tok);
    // «Пока не знают» и «без ответа» — только по просьбе; мест хватит не всем
    const more = await call(A('/autoseat'), 'POST', { dryRun: false, includeMaybe: true, includeNone: true }, tok);
    assert.equal(more.json.result.placements.length, 1);
    assert.equal(more.json.result.unplaced.length, 1);
    assert.equal(more.json.snapshot.tables.reduce((n, x) => n + x.occupied, 0), 7);
    assert.equal(seatedOf(more.json.snapshot, declined), 0);
    // отмена: сняли всех, кого посадила авторассадка
    const placedIds = [...run.json.result.placements, ...more.json.result.placements].map((p) => p.personId);
    assert.equal((await call(A('/seat'), 'POST', { personIds: placedIds, tableId: null }, tok)).json.snapshot.persons.filter((p) => p.tableId).length, 0);
    void t1; void t2;
  });

  await t.test('CSV: кириллица, длинные имена, формулы; питание только по запросу', async () => {
    const long = 'Очень-Длинная-Фамилия-Через-Дефис Александра-Екатерина'.padEnd(110, 'я');
    const table = await makeTable('CSV', 5);
    const grp = await addParty('Экспорт', [{ name: '=HYPERLINK("http://evil.example")' }, { name: long }]);
    await call(P(`/persons/${grp.ids[0]}`), 'PUT', { diet: 'Без орехов; аллергия' }, tok);
    await call(P('/menu'), 'POST', { label: 'Вегетарианское' }, tok);
    await seat(grp.ids, table.id);
    const plain = await call(P('/export.csv'), 'GET', undefined, tok);
    assert.equal(plain.status, 200);
    assert.match(plain.headers.get('content-type'), /text\/csv/);
    assert.ok(plain.text.startsWith('﻿Стол;Гость;Группа;Ответ;Взрослый / ребёнок;Меню\r\n'));
    assert.ok(plain.text.includes("'=HYPERLINK"), 'формула нейтрализована');
    assert.ok(plain.text.includes(long), 'длинное имя не обрезается');
    assert.ok(!plain.text.includes('аллергия'), 'питание по умолчанию не выгружается');
    const withDiet = await call(P('/export.csv?diet=1'), 'GET', undefined, tok);
    assert.ok(withDiet.text.includes('Пищевые ограничения') && withDiet.text.includes('"Без орехов; аллергия"'));
    assert.equal((await call(P('/export.csv'), 'GET', undefined, otherTok)).status, 404);
  });

  await t.test('настройки и проверка полей', async () => {
    assert.equal((await call(P('/settings'), 'PUT', { askMenu: 'yes' }, tok)).status, 400);
    assert.equal((await call(P('/settings'), 'PUT', {}, tok)).status, 400);
    const saved = await call(P('/settings'), 'PUT', { askMenu: true, askDiet: false }, tok);
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.json.snapshot.settings, { askMenu: true, askDiet: false, showMenu: false, showTable: false });
    assert.equal((await call(P('/persons'), 'POST', { partyKey: 'g:nonexistent', name: 'X' }, tok)).status, 404);
    assert.equal((await call(P('/persons'), 'POST', { partyKey: 'мусор', name: 'X' }, tok)).status, 400);
    assert.equal((await call(P('/seat'), 'POST', { personIds: [], tableId: null }, tok)).status, 400);
    assert.equal((await call(P('/seat'), 'POST', { personIds: ['x'.repeat(65)], tableId: null }, tok)).status, 400);
  });

  await t.test('анкета работает и без планировщика; сбой синхронизации не теряет ответ и не пишет данные гостей в лог', async () => {
    const lite = await mk(owner.id, 'planner-lite', 'lite');
    assert.equal((await rsvp(lite.slug, { guestName: 'Без планировщика', attendance: 'yes', guestsCount: 2 })).status, 200);
    assert.equal(await prisma.person.count({ where: { invitationId: lite.id } }), 0);

    const logged = [];
    const original = console.error;
    console.error = (...args) => { logged.push(args.map(String).join(' ')); };
    // Ломаем таблицу людей: ответ гостя всё равно должен сохраниться
    await prisma.$executeRawUnsafe('ALTER TABLE "Person" RENAME TO "Person_off"');
    try {
      const res = await rsvp(inv.slug, { guestName: 'Секретная Гостья', attendance: 'yes', guestsCount: 2, wishes: 'Личное пожелание' });
      assert.equal(res.status, 200);
      assert.equal(await prisma.guestResponse.count({ where: { guestName: 'Секретная Гостья' } }), 1);
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE "Person_off" RENAME TO "Person"');
      console.error = original;
    }
    assert.ok(logged.length > 0, 'сбой записан в лог');
    assert.ok(logged.every((line) => !line.includes('Секретная') && !line.includes('Личное')), logged.join('\n'));
  });

  await t.test('удаление приглашения чистит людей, столы и варианты; удаление гостя освобождает место', async () => {
    const doomed = await mk(owner.id, 'planner-doomed');
    const D = (route = '') => `/api/planner/${doomed.id}${route}`;
    const table = (await call(D('/tables'), 'POST', { name: '1', capacity: 2 }, tok)).json.result;
    await call(D('/menu'), 'POST', { label: 'Мясное' }, tok);
    const g = (await call(D('/parties'), 'POST', { names: 'Удаляемый', people: [{ name: 'Удаляемый' }] }, tok)).json.result;
    const [p] = (await call(D(), 'GET', undefined, tok)).json.persons;
    await call(D('/seat'), 'POST', { personIds: [p.id], tableId: table.id }, tok);
    assert.equal((await call(`/api/guests/${g.id}`, 'DELETE', undefined, tok)).status, 200);
    assert.equal((await call(D(), 'GET', undefined, tok)).json.tables[0].occupied, 0);
    assert.equal((await call(`/api/invites/${doomed.id}`, 'DELETE', undefined, tok)).status, 200);
    for (const model of ['person', 'seatTable', 'menuOption', 'plannerSettings', 'plannerNotice']) {
      assert.equal(await prisma[model].count({ where: { invitationId: doomed.id } }), 0, model);
    }
  });

  await t.test('ensureSchema достраивает таблицы планировщика на базе без них и ничего не ломает на полной', async () => {
    await ensureSchema();                                   // таблицы уже есть — повтор не падает
    const before = await prisma.person.count();
    await ensureSchema();
    assert.equal(await prisma.person.count(), before);

    // рабочая база до этой версии: таблиц планировщика нет — бэкенд обязан создать их сам
    for (const table of ['PlannerNotice', 'Person', 'MenuOption', 'SeatTable', 'PlannerSettings']) {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table}"`);
    }
    await ensureSchema();
    const created = await prisma.seatTable.create({ data: { invitationId: inv.id, name: 'после ensureSchema', capacity: 4 } });
    const guest = await prisma.guest.create({ data: { invitationId: inv.id, token: 'after-ensure', names: 'Проверка' } });
    await prisma.person.create({ data: { invitationId: inv.id, guestId: guest.id, name: 'Проверка', tableId: created.id } });
    await assert.rejects(prisma.seatTable.create({ data: { invitationId: inv.id, name: 'после ensureSchema', capacity: 2 } }), /Unique|unique/);
    await assert.rejects(prisma.person.create({ data: { invitationId: inv.id, guestId: guest.id, slot: 0 } }), /Unique|unique/);
    await prisma.seatTable.delete({ where: { id: created.id } });                       // SET NULL, человек остаётся
    assert.equal((await prisma.person.findFirst({ where: { guestId: guest.id } })).tableId, null);
  });
});
