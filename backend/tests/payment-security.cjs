const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const jwt = require('jsonwebtoken');
const root = path.resolve(__dirname, '..');
const tmpRoot = path.join(root, '.test-tmp');
fs.mkdirSync(tmpRoot, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpRoot, 'payment-security-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'payment-test-secret-only-at-least-32-bytes';
process.env.DATABASE_URL = `file:${path.join(tmp, 'test.db').replace(/\\/g, '/')}`;
process.env.YOOKASSA_SHOP_ID = 'fixture-shop';
process.env.YOOKASSA_SECRET_KEY = 'fixture-secret';
for (const key of ['FREE_ACCOUNTS', 'TELEGRAM_BOT_TOKEN', 'YUMONEY_SHOP_ID', 'YUMONEY_SECRET_KEY', 'PROMO_CODES', 'YOOKASSA_RECEIPT']) process.env[key] = '';
const db = new DatabaseSync(path.join(tmp, 'test.db'));
for (const dir of fs.readdirSync(path.join(root, 'prisma/migrations')).sort()) {
  const file = path.join(root, 'prisma/migrations', dir, 'migration.sql');
  if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
}
db.close();
const prisma = require('../dist/lib/prisma').default;
const app = require('../dist/index').default;
const { confirmInvitationPayment } = require('../dist/lib/invitePayment');
const { confirmPrintPayment } = require('../dist/lib/printPayment');
const { kassaAuth } = require('../dist/lib/paymentGateway');
const { PRINT_SAMPLE } = require('../dist/lib/printDesign');
const realFetch = global.fetch;
let server;
after(async () => {
  global.fetch = realFetch;
  if (server) await new Promise(resolve => server.close(resolve));
  await prisma.$disconnect();
  assert.equal(path.dirname(tmp), tmpRoot);
  fs.rmSync(tmp, { recursive: true });
});

test('payments fail closed, keep durable attempts and verify gateway facts', async t => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const owner = await prisma.user.create({ data: { email: 'payment-owner@example.test' } });
  const other = await prisma.user.create({ data: { email: 'payment-other@example.test' } });
  const token = jwt.sign({ userId: owner.id }, process.env.JWT_SECRET);
  const otherToken = jwt.sign({ userId: other.id }, process.env.JWT_SECRET);
  const call = async (route, body, auth = token, method = body === undefined ? 'GET' : 'POST') => {
    const res = await realFetch(base + route, { method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text() };
  };
  const invite = () => prisma.invitation.create({ data: { userId: owner.id, slug: require('node:crypto').randomUUID(), templateId: 'calla', plan: 'free' } });
  const create = (inv, plan = 'premium', promoCode) => call('/api/payment/create', { inviteId: inv.id, plan, ...(promoCode ? { promoCode } : {}) });
  const records = new Map();
  const keys = new Map();
  const posts = [];
  let dropNextResponse = false;
  let onCreate = null;
  global.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/api\.yookassa\.ru\/v3\/payments(?:\/[a-zA-Z0-9-]+)?$/);
    if (options.method === 'POST') {
      const key = options.headers['Idempotence-Key'];
      const payload = JSON.parse(options.body);
      posts.push({ key, payload });
      let payment = keys.get(key);
      if (payment) assert.deepEqual(payment.originalPayload, payload, 'idempotent retry must reuse the exact stored payload');
      else {
        payment = { id: `fixture-${keys.size + 1}`, status: 'pending', paid: false, amount: payload.amount, metadata: payload.metadata,
          test: false, recipient: { account_id: 'fixture-shop' }, originalPayload: payload,
          confirmation: { confirmation_url: `https://checkout.example.test/${key}` } };
        records.set(payment.id, payment); keys.set(key, payment);
      }
      if (dropNextResponse) { dropNextResponse = false; throw new Error('Simulated network timeout after gateway created payment'); }
      if (onCreate) { const action = onCreate; onCreate = null; await action(payment); }
      return Response.json(payment);
    }
    const payment = records.get(String(url).split('/').pop());
    assert.ok(payment, 'only saved mocked payments may be read');
    return Response.json(payment);
  };
  const currentPayment = async inv => records.get((await prisma.invitation.findUnique({ where: { id: inv.id } })).paymentId);

  await t.test('requires owner, rejects invalid inputs and gives no public billing status by id', async () => {
    const inv = await invite();
    assert.equal((await call('/api/payment/create', { inviteId: inv.id }, '')).status, 401);
    assert.equal((await call('/api/payment/create', { inviteId: inv.id }, otherToken)).status, 404);
    for (const body of [{}, { inviteId: {} }, { inviteId: inv.id, plan: 'constructor' }, { inviteId: inv.id, plan: 'toString' }, { inviteId: inv.id, promoCode: {} }]) {
      assert.equal((await call('/api/payment/create', body)).status, 400);
    }
    assert.equal((await call(`/api/payment/public-status/${inv.id}`, undefined, '')).status, 401);
    assert.equal((await call(`/api/payment/public-status/${inv.id}`, undefined, otherToken)).status, 401);
    assert.equal((await call(`/api/payment/status/${inv.id}`, undefined, otherToken)).status, 404);
    assert.equal(posts.length, 0);
  });

  await t.test('free return token is narrowly scoped, expiring and cannot authenticate APIs', async () => {
    const inv = await invite(); const another = await invite();
    const created = await create(inv, 'free'); assert.equal(created.status, 200);
    const capability = new URL(created.body.redirectUrl).searchParams.get('token');
    assert.ok(capability);
    assert.equal((await call(`/api/payment/public-status/${inv.id}?token=${capability}`, undefined, '')).body.paid, true);
    assert.equal((await call(`/api/payment/public-status/${another.id}?token=${capability}`, undefined, '')).status, 401);
    assert.equal((await call(`/api/payment/status/${inv.id}`, undefined, capability)).status, 401);
    const expired = jwt.sign({ purpose: 'payment-return', inviteId: inv.id }, process.env.JWT_SECRET, { expiresIn: -1 });
    assert.equal((await call(`/api/payment/public-status/${inv.id}?token=${expired}`, undefined, '')).status, 401);
  });

  await t.test('concurrent creation reserves one payment and plan changes cannot abandon it', async () => {
    const inv = await invite(); const before = keys.size;
    const results = await Promise.all([create(inv), create(inv), create(inv), create(inv)]);
    results.forEach(result => assert.equal(result.status, 200, JSON.stringify(result.body)));
    assert.equal(new Set(results.map(result => result.body.paymentUrl)).size, 1);
    assert.equal(keys.size - before, 1);
    assert.equal(await prisma.paymentAttempt.count({ where: { invitationId: inv.id } }), 1);
    assert.equal((await create(inv, 'maximum')).status, 409);
    process.env.PROMO_CODES = 'PROMO:10';
    assert.equal((await create(inv, 'premium', 'PROMO')).status, 409);
    process.env.PROMO_CODES = '';
  });

  await t.test('timeout retry retains key, promo, receipt and return URL across configuration changes', async () => {
    const inv = await invite(); const before = posts.length;
    process.env.PROMO_CODES = 'SAVE:10'; process.env.YOOKASSA_RECEIPT = 'true';
    dropNextResponse = true;
    assert.equal((await create(inv, 'premium', 'SAVE')).status, 502);
    const attempt = await prisma.paymentAttempt.findUnique({ where: { invitationId: inv.id } });
    assert.equal(attempt.amountKopecks, 224100);
    assert.equal(attempt.paymentId, '');
    process.env.PROMO_CODES = ''; process.env.YOOKASSA_RECEIPT = '';
    assert.equal((await create(inv)).status, 200);
    assert.equal(posts.length - before, 2);
    assert.equal(posts.at(-1).key, posts.at(-2).key);
    assert.deepEqual(posts.at(-1).payload, posts.at(-2).payload);
    const payment = await currentPayment(inv); payment.status = 'succeeded'; payment.paid = true;
    assert.equal(await confirmInvitationPayment(payment), true, 'stored discounted amount survives promo removal');
  });

  await t.test('uncertain creation older than idempotency window cannot double charge', async () => {
    const inv = await invite(); dropNextResponse = true;
    assert.equal((await create(inv)).status, 502);
    await prisma.paymentAttempt.update({ where: { invitationId: inv.id }, data: { createdAt: new Date(Date.now() - 25 * 60 * 60_000) } });
    const before = posts.length;
    assert.equal((await create(inv)).status, 409);
    assert.equal(posts.length, before);
  });

  await t.test('gateway webhook arriving before POST response is not lost', async () => {
    const inv = await invite();
    onCreate = async payment => {
      payment.status = 'succeeded'; payment.paid = true;
      assert.equal((await prisma.invitation.findUnique({ where: { id: inv.id } })).paymentId, '');
      assert.equal(await confirmInvitationPayment(payment), true);
    };
    const result = await create(inv);
    assert.equal(result.status, 200); assert.equal(result.body.alreadyPaid, true);
    assert.equal((await prisma.invitation.findUnique({ where: { id: inv.id } })).plan, 'premium');
  });

  await t.test('upgrade webhook recovers a lost response while invitation still holds the old paid id', async () => {
    const inv = await invite(); await create(inv);
    const premium = await currentPayment(inv); premium.status = 'succeeded'; premium.paid = true;
    assert.equal(await confirmInvitationPayment(premium), true);
    dropNextResponse = true;
    assert.equal((await create(inv, 'maximum')).status, 502);
    const attempt = await prisma.paymentAttempt.findUnique({ where: { invitationId: inv.id } });
    assert.equal(attempt.paymentId, '');
    assert.equal((await prisma.invitation.findUnique({ where: { id: inv.id } })).paymentId, premium.id);
    const maximum = keys.get(attempt.id); maximum.status = 'succeeded'; maximum.paid = true;
    assert.equal(await confirmInvitationPayment(maximum), true);
    const saved = await prisma.invitation.findUnique({ where: { id: inv.id } });
    assert.equal(saved.paymentId, maximum.id); assert.equal(saved.plan, 'maximum');
  });

  await t.test('rejects underpayment, wrong currency, product, plan, invitation, key, id and unsettled status', async () => {
    const inv = await invite(); assert.equal((await create(inv)).status, 200);
    const payment = await currentPayment(inv);
    const paid = { ...payment, status: 'succeeded', paid: true };
    for (const invalid of [
      { ...paid, amount: { value: '1.00', currency: 'RUB' } },
      { ...paid, amount: { value: '2490.00', currency: 'USD' } },
      { ...paid, metadata: { ...paid.metadata, product: 'print' } },
      { ...paid, metadata: { ...paid.metadata, plan: 'maximum' } },
      { ...paid, metadata: { ...paid.metadata, inviteId: 'other' } },
      { ...paid, metadata: { ...paid.metadata, paymentKey: 'forged' } },
      { ...paid, id: 'unrelated' }, { ...paid, paid: false }, { ...paid, paid: 'true' },
      { ...paid, status: 'waiting_for_capture' }, { ...paid, recipient: { account_id: 'wrong-shop' } },
    ]) assert.equal(await confirmInvitationPayment(invalid), false);
    assert.equal((await prisma.invitation.findUnique({ where: { id: inv.id } })).status, 'draft');
    assert.equal(await confirmInvitationPayment(paid), true);
    const paidAt = (await prisma.invitation.findUnique({ where: { id: inv.id } })).paidAt;
    assert.equal(await confirmInvitationPayment(paid), true);
    assert.deepEqual((await prisma.invitation.findUnique({ where: { id: inv.id } })).paidAt, paidAt);
  });

  await t.test('webhook trusts only retrieved gateway state and rejects mismatched gateway identity', async () => {
    const inv = await invite(); await create(inv); const payment = await currentPayment(inv);
    const webhook = id => call('/api/payment/webhook', { event: 'payment.succeeded', object: { id, paid: true, metadata: { plan: 'maximum' } } }, '');
    assert.equal((await webhook('../not-a-payment')).status, 400);
    assert.equal((await webhook(payment.id)).status, 200);
    assert.equal((await prisma.invitation.findUnique({ where: { id: inv.id } })).status, 'draft');
    payment.status = 'succeeded'; payment.paid = true;
    assert.equal((await webhook(payment.id)).status, 200);
    const paid = await prisma.invitation.findUnique({ where: { id: inv.id } }); assert.equal(paid.plan, 'premium');
    assert.equal((await webhook(payment.id)).status, 200);
    assert.deepEqual((await prisma.invitation.findUnique({ where: { id: inv.id } })).paidAt, paid.paidAt);
  });

  await t.test('cancellation rotates key once; upgrade charges 1500 RUB and never downgrades', async () => {
    const inv = await invite(); await create(inv); const old = await currentPayment(inv);
    old.status = 'canceled';
    const before = keys.size;
    const results = await Promise.all([create(inv), create(inv)]);
    results.forEach(result => assert.equal(result.status, 200, JSON.stringify(result.body)));
    assert.equal(keys.size - before, 1);
    const premium = await currentPayment(inv); assert.notEqual(premium.metadata.paymentKey, old.metadata.paymentKey);
    premium.status = 'succeeded'; premium.paid = true; assert.equal(await confirmInvitationPayment(premium), true);
    assert.equal((await create(inv, 'maximum')).status, 200);
    const maximum = await currentPayment(inv); assert.equal(maximum.amount.value, '1500.00');
    assert.equal((await prisma.invitation.findUnique({ where: { id: inv.id } })).plan, 'premium');
    maximum.status = 'succeeded'; maximum.paid = true;
    assert.equal((await call(`/api/payment/status/${inv.id}`)).body.plan, 'maximum');
    assert.equal(await confirmInvitationPayment(premium), false);
    assert.equal((await create(inv, 'premium')).status, 400);
  });

  await t.test('production rejects test keys, test transactions and ALLOW_TEST_PAYMENTS bypass', async () => {
    const inv = await invite(); await create(inv); const payment = await currentPayment(inv);
    const originalKey = process.env.YOOKASSA_SECRET_KEY;
    process.env.NODE_ENV = 'production'; process.env.ALLOW_TEST_PAYMENTS = 'true';
    try {
      assert.equal(await confirmInvitationPayment({ ...payment, status: 'succeeded', paid: true, test: true }), false);
      assert.equal(await confirmInvitationPayment({ ...payment, status: 'succeeded', paid: true, test: undefined }), false);
      process.env.YOOKASSA_SECRET_KEY = 'test_fixture'; assert.equal(kassaAuth().configured, false);
      assert.equal((await create(await invite())).status, 503);
      delete process.env.NODE_ENV;
      assert.equal(kassaAuth().configured, false, 'unset environment must also reject test credentials');
      process.env.YOOKASSA_SHOP_ID = ''; process.env.YOOKASSA_SECRET_KEY = '';
      assert.equal((await create(await invite())).status, 503);
    } finally {
      process.env.NODE_ENV = 'test'; process.env.YOOKASSA_SHOP_ID = 'fixture-shop'; process.env.YOOKASSA_SECRET_KEY = originalKey; delete process.env.ALLOW_TEST_PAYMENTS;
    }
  });

  await t.test('legacy settled payment can upgrade without recharging its historical tariff', async () => {
    const inv = await invite();
    const payment = { id: 'legacy-paid', status: 'succeeded', paid: true, amount: { value: '1990.00', currency: 'RUB' }, metadata: { inviteId: inv.id, plan: 'premium' } };
    records.set(payment.id, payment);
    await prisma.invitation.update({ where: { id: inv.id }, data: { status: 'paid', plan: 'premium', paymentId: payment.id, paidAt: new Date() } });
    assert.equal((await create(inv, 'maximum')).status, 200);
    assert.equal((await currentPayment(inv)).amount.value, '1500.00');
  });

  await t.test('legacy pending payment recovers only after exact price and metadata checks', async () => {
    const inv = await invite();
    const payment = { id: 'legacy-pending', status: 'succeeded', paid: true, amount: { value: '1.00', currency: 'RUB' }, metadata: { inviteId: inv.id, plan: 'premium' } };
    await prisma.invitation.update({ where: { id: inv.id }, data: { paymentId: payment.id } });
    assert.equal(await confirmInvitationPayment(payment), false);
    payment.amount.value = '2490.00';
    assert.equal(await confirmInvitationPayment(payment), true);
  });

  await t.test('printing has durable retries and cannot be unlocked by test or foreign payment', async () => {
    const order = await prisma.printOrder.create({ data: { userId: owner.id, templateId: 'vow', data: JSON.stringify(PRINT_SAMPLE) } });
    const pay = () => call(`/api/print/orders/${order.id}/pay`, {});
    dropNextResponse = true; assert.equal((await pay()).status, 502);
    const first = posts.at(-1);
    assert.equal((await pay()).status, 200); assert.deepEqual(posts.at(-1), first);
    const stored = await prisma.printOrder.findUnique({ where: { id: order.id } });
    const payment = records.get(stored.paymentId);
    assert.equal(payment.amount.value, '290.00');
    assert.equal(await confirmPrintPayment({ ...payment, status: 'succeeded', paid: true, metadata: { ...payment.metadata, printOrderId: 'other' } }), false);
    process.env.NODE_ENV = 'production';
    try { assert.equal(await confirmPrintPayment({ ...payment, status: 'succeeded', paid: true, test: true }), false); }
    finally { process.env.NODE_ENV = 'test'; }
    payment.status = 'succeeded'; payment.paid = true;
    assert.equal(await confirmPrintPayment(payment), true);
    assert.equal((await call(`/api/print/orders/${order.id}`, undefined, otherToken)).status, 404);
  });

  await t.test('printing prevents late replay and concurrent canceled retries create one payment', async () => {
    const uncertain = await prisma.printOrder.create({ data: { userId: owner.id, templateId: 'vow', data: JSON.stringify(PRINT_SAMPLE) } });
    dropNextResponse = true;
    assert.equal((await call(`/api/print/orders/${uncertain.id}/pay`, {})).status, 502);
    await prisma.paymentAttempt.update({ where: { printOrderId: uncertain.id }, data: { createdAt: new Date(Date.now() - 25 * 60 * 60_000) } });
    const beforeLate = posts.length;
    assert.equal((await call(`/api/print/orders/${uncertain.id}/pay`, {})).status, 409);
    assert.equal(posts.length, beforeLate);
    const order = await prisma.printOrder.create({ data: { userId: owner.id, templateId: 'vow', data: JSON.stringify(PRINT_SAMPLE) } });
    const pay = () => call(`/api/print/orders/${order.id}/pay`, {});
    assert.equal((await pay()).status, 200);
    const saved = await prisma.printOrder.findUnique({ where: { id: order.id } });
    records.get(saved.paymentId).status = 'canceled';
    const before = keys.size;
    const results = await Promise.all([pay(), pay(), pay()]);
    results.forEach(result => assert.equal(result.status, 200, JSON.stringify(result.body)));
    assert.equal(keys.size - before, 1);
  });

  await t.test('print persistence errors do not disclose database context or submitted personal data', async () => {
    const originalCreate = prisma.printOrder.create;
    const originalUpdate = prisma.printOrder.updateMany;
    const marker = 'PRIVATE_SQL_CONTEXT_and_customer_email';
    try {
      prisma.printOrder.create = async () => { throw new Error(marker); };
      const created = await call('/api/print/orders', { templateId: 'vow', data: PRINT_SAMPLE });
      assert.equal(created.status, 400); assert.ok(!JSON.stringify(created.body).includes(marker));
      prisma.printOrder.updateMany = async () => { throw new Error(marker); };
      const updated = await call('/api/print/orders/any-order', { data: PRINT_SAMPLE }, token, 'PUT');
      assert.equal(updated.status, 400); assert.ok(!JSON.stringify(updated.body).includes(marker));
    } finally { prisma.printOrder.create = originalCreate; prisma.printOrder.updateMany = originalUpdate; }
  });
});
