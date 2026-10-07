const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const jwt = require('jsonwebtoken');

const root = path.resolve(__dirname, '..');
const tmpRoot = path.join(root, '.test-tmp');
fs.mkdirSync(tmpRoot, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpRoot, 'plans-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'plans-test-secret-only-at-least-32-bytes';
process.env.DATABASE_URL = `file:${path.join(tmp, 'test.db').replace(/\\/g, '/')}`;
for (const key of ['FREE_ACCOUNTS', 'PLANNER_PUBLIC', 'TELEGRAM_BOT_TOKEN', 'YOOKASSA_SHOP_ID', 'YOOKASSA_SECRET_KEY', 'YUMONEY_SHOP_ID', 'YUMONEY_SECRET_KEY']) process.env[key] = '';
const db = new DatabaseSync(path.join(tmp, 'test.db'));
for (const dir of fs.readdirSync(path.join(root, 'prisma/migrations')).sort()) {
  const file = path.join(root, 'prisma/migrations', dir, 'migration.sql');
  if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
}
db.close();
const prisma = require('../dist/lib/prisma').default;
const app = require('../dist/index').default;
const backend = require('../dist/lib/plans');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const frontend = require('../../frontend/src/lib/plans.ts');
let server;
const realFetch = global.fetch;
after(async () => {
  global.fetch = realFetch;
  if (server) await new Promise(resolve => server.close(resolve));
  await prisma.$disconnect();
  assert.equal(path.dirname(tmp), tmpRoot);
  fs.rmSync(tmp, { recursive: true });
});

test('тарифы: состав и цены фронтенда совпадают с сервером', () => {
  assert.deepEqual(frontend.PLANS.map(p => [p.id, p.price]), [['free', 0], ['premium', 2490], ['maximum', 3990]]);
  for (const p of frontend.PLANS) {
    assert.equal(p.price * 100, backend.PLANS[p.id].price);
    for (const feature of ['hasRsvp', 'hasResponseStats', 'hasNotifications', 'hasMusic', 'hasCustomDomain', 'hasPlanner']) {
      assert.equal(frontend[feature](p.id), backend[feature](p.id), `${p.id}: ${feature}`);
    }
    assert.deepEqual(frontend.planSections(p.id), backend.planSections(p.id));
    assert.equal(frontend.planPriceDue('maximum', p.id, true) * 100, backend.planPriceDue('maximum', p.id, true));
  }
  assert.equal(backend.hasRsvp('free'), false);
  assert.equal(backend.hasPlanner('premium'), false);
  assert.equal(backend.hasPlanner('maximum'), true);
});

test('публикация, ограничения и улучшение тарифа на изолированной базе', async t => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const owner = await prisma.user.create({ data: { email: 'plan-owner@example.test' } });
  const token = jwt.sign({ userId: owner.id }, process.env.JWT_SECRET);
  const call = async (route, method = 'GET', body, auth = true) => {
    const res = await realFetch(base + route, {
      method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, json: res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
  };
  const inv = (await call('/api/invites', 'POST', { templateId: 'calla' })).json;

  await t.test('бесплатная публикация без кассы, запрет платных функций даже при прямом запросе', async () => {
    const published = await call('/api/payment/create', 'POST', { inviteId: inv.id, plan: 'free' });
    assert.equal(published.status, 200);
    assert.equal(published.json.free, true);
    assert.match(published.json.redirectUrl, /plan=free/);
    await call(`/api/invites/${inv.id}`, 'PUT', { enabledSections: { venue: true, schedule: true, rsvp: true }, musicUrl: '/music.mp3', customData: { plan: 'maximum' } });
    const pub = (await call(`/api/invites/by-slug/${inv.slug}`, 'GET', undefined, false)).json;
    assert.equal(pub.plan, 'free');
    assert.equal(pub.customData.plan, 'free');
    assert.equal(pub.musicUrl, '/music.mp3');
    for (const id of backend.FREE_LOCKED_SECTIONS) assert.equal(pub.enabledSections[id], false, id);
    const raw = await prisma.invitation.findUnique({ where: { id: inv.id } });
    assert.equal(raw.paymentId, '');
    assert.equal(JSON.parse(raw.enabledSections).venue, true, 'настройки сохранены для улучшения');
    for (const [route, method, body] of [
      [`/api/rsvp/${inv.slug}`, 'POST', { guestName: 'Анна', attending: true }],
      [`/api/rsvp/${inv.id}`, 'GET'],
      [`/api/guests/${inv.id}`, 'GET'],
      [`/api/invites/${inv.id}/telegram-connect`, 'POST', {}],
      [`/api/invites/${inv.id}/settings`, 'PATCH', { notifyChannel: 'telegram' }],
      [`/api/planner/${inv.id}`, 'GET'],
    ]) assert.equal((await call(route, method, body)).status, 403, route);
  });

  await t.test('Премиум собирает ответы, Максимум открывает планировщик обычному клиенту', async () => {
    await prisma.invitation.update({ where: { id: inv.id }, data: { plan: 'premium' } });
    assert.equal((await call(`/api/rsvp/${inv.slug}`, 'POST', { guestName: 'Анна', attending: true }, false)).status, 200);
    assert.equal((await call(`/api/rsvp/${inv.id}`)).json.stats.total, 1);
    const locked = await call(`/api/planner/${inv.id}`);
    assert.equal(locked.status, 403);
    assert.equal(locked.json.code, 'plan');
    await prisma.invitation.update({ where: { id: inv.id }, data: { plan: 'maximum' } });
    assert.equal((await call(`/api/planner/${inv.id}`)).status, 200);
    assert.equal((await call('/api/payment/create', 'POST', { inviteId: inv.id, plan: 'premium' })).status, 400);
  });

  await t.test('улучшение: доплата 1500 ₽, до подтверждения остаётся Премиум, отмена не открывает Максимум', async () => {
    process.env.YOOKASSA_SHOP_ID = 'fixture-shop';
    process.env.YOOKASSA_SECRET_KEY = 'fixture-key';
    let payload;
    const payment = { id: 'plan-payment-1', status: 'pending', paid: false, metadata: { inviteId: inv.id, plan: 'maximum' } };
    global.fetch = async (url, options) => {
      assert.match(String(url), /^https:\/\/api\.yookassa\.ru\/v3\/payments/);
      if (options.method === 'POST') {
        payload = JSON.parse(options.body);
        return Response.json({ ...payment, confirmation: { confirmation_url: 'https://checkout.example.test/pay' } });
      }
      return Response.json(payment);
    };
    await prisma.invitation.update({ where: { id: inv.id }, data: { plan: 'premium', status: 'paid', paymentId: '' } });
    assert.equal((await call('/api/payment/create', 'POST', { inviteId: inv.id, plan: 'maximum' })).status, 200);
    assert.equal(payload.amount.value, '1500.00');
    assert.equal((await prisma.invitation.findUnique({ where: { id: inv.id } })).plan, 'premium');
    assert.equal((await call(`/api/payment/public-status/${inv.id}`)).json.plan, 'premium');
    payment.status = 'canceled';
    assert.equal((await call(`/api/payment/public-status/${inv.id}`)).json.paymentStatus, 'canceled');
    assert.equal((await call(`/api/planner/${inv.id}`)).status, 403);
    payment.status = 'succeeded'; payment.paid = true;
    const confirmed = (await call(`/api/payment/public-status/${inv.id}`)).json;
    assert.equal(confirmed.plan, 'maximum');
    assert.equal((await call(`/api/planner/${inv.id}`)).status, 200);
    assert.equal((await call('/api/payment/webhook', 'POST', { event: 'payment.succeeded', object: { id: payment.id } }, false)).status, 200);
    assert.equal((await prisma.invitation.findUnique({ where: { id: inv.id } })).plan, 'maximum');
    global.fetch = realFetch;
  });

  await t.test('тестовый аккаунт может переключить все три тарифа без кассы', async () => {
    process.env.FREE_ACCOUNTS = owner.email;
    for (const plan of ['free', 'premium', 'maximum']) {
      assert.equal((await call('/api/payment/create', 'POST', { inviteId: inv.id, plan })).status, 200);
      assert.equal((await prisma.invitation.findUnique({ where: { id: inv.id } })).plan, plan);
    }
  });
});
