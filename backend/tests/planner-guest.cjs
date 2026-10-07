// «Ваш стол» на сайте: гость по персональной ссылке видит стол и блюда только своей группы,
// и только если пара включила показ. Отдельная временная база.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const jwt = require('jsonwebtoken');

const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, '.test-tmp'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(root, '.test-tmp/planner-guest-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'planner-guest-suite-secret-at-least-32-chars';
process.env.DATABASE_URL = `file:${path.join(tmp, 'test.db').replace(/\\/g, '/')}`;
for (const key of ['BREVO_API_KEY', 'SMTP_USER', 'SMTP_PASS', 'TELEGRAM_BOT_TOKEN', 'YOOKASSA_SHOP_ID', 'YOOKASSA_SECRET_KEY', 'PLANNER_PUBLIC']) process.env[key] = '';
process.env.PLANNER_PUBLIC = '0';
process.env.FREE_ACCOUNTS = 'guest-owner@example.test';
const db = new DatabaseSync(path.join(tmp, 'test.db'));
for (const dir of fs.readdirSync(path.join(root, 'prisma/migrations')).sort()) {
  const file = path.join(root, 'prisma/migrations', dir, 'migration.sql');
  if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
}
db.close();

const prisma = require('../dist/lib/prisma').default;
const app = require('../dist/index').default;
let server;
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect();
  fs.rmSync(tmp, { recursive: true });
});

test('«Ваш стол» по персональной ссылке', async (t) => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (url, method = 'GET', body, token, extra = {}) => {
    const res = await fetch(base + url, {
      method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, text, json: text ? JSON.parse(text) : null };
  };

  const owner = await prisma.user.create({ data: { email: 'guest-owner@example.test' } });
  const tok = jwt.sign({ userId: owner.id }, process.env.JWT_SECRET);
  const inv = await prisma.invitation.create({ data: { userId: owner.id, slug: 'guest-view', templateId: 'tenderness', status: 'paid', plan: 'maximum' } });
  const other = await prisma.invitation.create({ data: { userId: owner.id, slug: 'guest-view-other', templateId: 'calla', status: 'paid', plan: 'maximum' } });
  const P = (route) => `/api/planner/${inv.id}${route}`;
  const act = async (route, method, body) => {
    const r = await call(P(route), method, body, tok);
    assert.equal(r.status, 200, `${route}: ${r.text}`);
    return r.json;
  };
  const settings = (s) => act('/settings', 'PUT', s);

  // Столы, меню и две группы: «Ивановы» (Анна, Борис, безымянный) и чужая «Петровы» за тем же столом
  const t5 = (await act('/tables', 'POST', { name: '5', capacity: 10 })).result;
  await act('/tables', 'POST', { name: 'Молодожёны', capacity: 4 });
  const meat = (await act('/menu', 'POST', { label: 'Мясное', note: 'Говядина' })).result;
  await act('/menu', 'POST', { label: 'Рыбное', note: '' });
  const ivanovy = await act('/parties', 'POST', { names: 'Ивановы', salutation: 'семья', people: [{ name: 'Анна' }, { name: 'Борис' }, { name: '' }] });
  const petrovy = await act('/parties', 'POST', { names: 'Петровы', salutation: 'дорогие', people: [{ name: 'Чужой Петров' }] });
  const guestA = await prisma.guest.findUnique({ where: { id: ivanovy.result.id } });
  const guestB = await prisma.guest.findUnique({ where: { id: petrovy.result.id } });
  const personsA = await prisma.person.findMany({ where: { guestId: guestA.id }, orderBy: { slot: 'asc' } });
  const personB = await prisma.person.findFirst({ where: { guestId: guestB.id } });
  const [anna, boris, noname] = personsA;
  await act('/seat', 'POST', { personIds: [anna.id, noname.id, personB.id], tableId: t5.id });
  await act(`/persons/${anna.id}`, 'PUT', { menuOptionId: meat.id, diet: 'аллергия на орехи' });
  await act(`/persons/${boris.id}`, 'PUT', { diet: 'без глютена' });

  const resolve = (token, invite = inv.id) => call(`/api/guests/resolve/${token}${invite ? `?invite=${invite}` : ''}`);

  await t.test('пока пара ничего не включила — плашки нет, обращение работает', async () => {
    const r = await resolve(guestA.token);
    assert.equal(r.status, 200);
    assert.equal(r.json.planner, null);
    assert.match(r.json.greeting, /Ивановы/);
  });

  await t.test('стол: только своя группа, безымянные — числом, кто ещё без стола', async () => {
    await settings({ showTable: true });
    const r = await resolve(guestA.token);
    assert.deepEqual(r.json.planner.tables, [{ name: '5', title: 'Стол 5', people: ['Анна'], others: 1 }]);
    assert.deepEqual(r.json.planner.waiting, { people: ['Борис'], others: 0 });
    assert.deepEqual(r.json.planner.dishes, [], 'блюда — только с отдельной галочкой');
    assert.deepEqual(r.json.planner.menu, []);
    assert.equal(r.json.planner.accent, '#b07784', 'цвет — как у печати для «Нежности»');
    assert.equal(r.json.planner.size, 3, 'вся группа, включая тех, кто ещё без стола');
    assert.ok(!r.text.includes('Петров'), 'чужих за тем же столом не видно');
    assert.ok(!/орех|глютен/.test(r.text), 'пищевых ограничений нет');
  });

  await t.test('меню и выбор группы — по второй галочке', async () => {
    await settings({ showMenu: true });
    const r = await resolve(guestA.token);
    assert.deepEqual(r.json.planner.dishes, [{ name: 'Анна', dish: 'Мясное' }]);
    assert.deepEqual(r.json.planner.menu, [{ label: 'Мясное', note: 'Говядина' }, { label: 'Рыбное', note: '' }]);
    assert.ok(!/орех|глютен|Петров/.test(r.text));
    await settings({ showTable: false });
    const menuOnly = await resolve(guestA.token);
    assert.deepEqual(menuOnly.json.planner.tables, []);
    assert.equal(menuOnly.json.planner.waiting, null);
    assert.equal(menuOnly.json.planner.menu.length, 2);
    await settings({ showTable: true });
  });

  await t.test('ссылка работает только на своём сайте; без названного сайта — без «Ваш стол»', async () => {
    assert.equal((await resolve(guestA.token, other.id)).status, 404);
    const bare = await resolve(guestA.token, '');
    assert.equal(bare.status, 200);
    assert.equal(bare.json.planner, null);
    assert.equal((await resolve('нет-такого-токена')).status, 404);
  });

  await t.test('отказавшемуся гостю ничего не показываем', async () => {
    const r = await call('/api/rsvp/guest-view', 'POST', { guestName: 'Петровы', attending: false, attendance: 'no', guestToken: guestB.token }, undefined, { 'X-Forwarded-For': '10.7.0.1' });
    assert.equal(r.status, 200, r.text);
    assert.equal((await resolve(guestB.token)).json.planner, null);
  });

  await t.test('тариф без функции, закрытый флаг, неоплаченный сайт', async () => {
    await prisma.invitation.update({ where: { id: inv.id }, data: { plan: 'premium' } });
    assert.equal((await resolve(guestA.token)).json.planner, null);
    await prisma.invitation.update({ where: { id: inv.id }, data: { plan: 'maximum' } });

    // Владелец не из тестовых аккаунтов: пока PLANNER_PUBLIC не включён, плашки нет
    process.env.FREE_ACCOUNTS = '';
    try {
      assert.equal((await resolve(guestA.token)).json.planner, null);
      process.env.PLANNER_PUBLIC = '1';
      assert.equal((await resolve(guestA.token)).json.planner.tables[0].name, '5');
    } finally {
      process.env.PLANNER_PUBLIC = '0';
      process.env.FREE_ACCOUNTS = 'guest-owner@example.test';
    }

    await prisma.invitation.update({ where: { id: inv.id }, data: { status: 'draft' } });
    try { assert.equal((await resolve(guestA.token)).status, 404); }
    finally { await prisma.invitation.update({ where: { id: inv.id }, data: { status: 'paid' } }); }
  });

  await t.test('стол удалили — гость его больше не видит', async () => {
    await act(`/tables/${t5.id}?confirm=1`, 'DELETE');
    const r = await resolve(guestA.token);
    assert.deepEqual(r.json.planner.tables, []);
    assert.equal(r.json.planner.menu.length, 2, 'меню осталось');
  });
});
