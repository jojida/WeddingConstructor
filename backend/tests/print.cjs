const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const jwt = require('jsonwebtoken');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, '.test-tmp'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(root, '.test-tmp/print-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-print-test-secret-at-least-32-characters';
process.env.DATABASE_URL = `file:${path.join(tmp, 'test.db').replace(/\\/g, '/')}`;
process.env.YOOKASSA_SHOP_ID = '';
process.env.YOOKASSA_SECRET_KEY = '';
process.env.YUMONEY_SHOP_ID = '';
process.env.YUMONEY_SECRET_KEY = '';
const db = new DatabaseSync(path.join(tmp, 'test.db'));
for (const dir of fs.readdirSync(path.join(root, 'prisma/migrations')).sort()) {
  const file = path.join(root, 'prisma/migrations', dir, 'migration.sql');
  if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
}
db.close();
const prisma = require('../dist/lib/prisma').default;
const { PRINT_SAMPLE, PRINT_TEMPLATES, printSize, validatePrintData } = require('../dist/lib/printDesign');
const { confirmPrintPayment } = require('../dist/lib/printPayment');
const app = require('../dist/index').default;
const realFetch = global.fetch;
let server;
after(async () => { global.fetch = realFetch; if (server) await new Promise(r => server.close(r)); await prisma.$disconnect(); fs.rmSync(tmp, { recursive: true }); });

test('print purchase and PDF use a separate, owner-bound product', async t => {
  server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const owner = await prisma.user.create({ data: { email: 'print-owner@example.test' } });
  const other = await prisma.user.create({ data: { email: 'print-other@example.test' } });
  const token = jwt.sign({ userId: owner.id }, process.env.JWT_SECRET);
  const otherToken = jwt.sign({ userId: other.id }, process.env.JWT_SECRET);
  const request = (url, method = 'GET', body, auth = token) => realFetch(base + '/api/print' + url, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let order;
  await t.test('validates templates and dates; previews escape markup', async () => {
    assert.throws(() => validatePrintData({ ...PRINT_SAMPLE, date: '2027-02-31' }));
    assert.throws(() => validatePrintData({ ...PRINT_SAMPLE, groom: 'x'.repeat(25) }));
    assert.equal((await request('/orders', 'POST', { templateId: 'missing', data: PRINT_SAMPLE })).status, 400);
    assert.equal((await request('/orders', 'POST', { templateId: 'vow', data: PRINT_SAMPLE }, '')).status, 401);
    const preview = await request('/preview', 'POST', { templateId: 'vow', data: { ...PRINT_SAMPLE, groom: '<script>test</script>' } }, '');
    assert.equal(preview.status, 200); const svg = await preview.text(); assert.ok(!svg.includes('<script>')); assert.ok(svg.includes('PREVIEW'));
  });
  await t.test('creates a print order without granting website access', async () => {
    const result = await request('/orders', 'POST', { templateId: 'vow', data: PRINT_SAMPLE, status: 'paid', price: 1 });
    assert.equal(result.status, 201); order = await result.json();
    assert.equal(await prisma.invitation.count(), 0);
    assert.equal((await request(`/orders/${order.id}/pdf`)).status, 402);
    assert.equal((await request(`/orders/${order.id}/pay`, 'POST')).status, 503);
    for (const route of [`/orders/${order.id}`, `/orders/${order.id}/pdf`]) assert.equal((await request(route, 'GET', undefined, otherToken)).status, 404);
    assert.equal((await request(`/orders/${order.id}`, 'PUT', { data: PRINT_SAMPLE }, otherToken)).status, 404);
    assert.equal((await request(`/orders/${order.id}/pay`, 'POST', {}, otherToken)).status, 404);
  });
  let gatewayPayment; let paymentCalls = 0; let payload; let key;
  await t.test('charges exactly 290 RUB and reuses pending payment', async () => {
    process.env.YOOKASSA_SHOP_ID = 'test-shop'; process.env.YOOKASSA_SECRET_KEY = 'test-only';
    global.fetch = async (url, options) => {
      assert.ok(String(url).startsWith('https://api.yookassa.ru/v3/payments'));
      if (options.method === 'POST') {
        paymentCalls++; payload = JSON.parse(options.body); key = options.headers['Idempotence-Key'];
        gatewayPayment = { id: 'print-payment-test', status: 'pending', paid: false, amount: payload.amount, metadata: payload.metadata, confirmation: { confirmation_url: 'https://example.test/pay' } };
      }
      return new Response(JSON.stringify(gatewayPayment), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    assert.equal((await request(`/orders/${order.id}/pay`, 'POST', { price: 1 })).status, 200);
    assert.deepEqual(payload.amount, { value: '290.00', currency: 'RUB' });
    assert.equal(payload.metadata.product, 'print'); assert.equal(payload.metadata.paymentKey, key);
    assert.equal((await request(`/orders/${order.id}/pay`, 'POST')).status, 200); assert.equal(paymentCalls, 1);
    assert.equal((await request(`/orders/${order.id}/pdf`)).status, 402);
  });
  await t.test('rejects wrong payment amount, currency, key and identity', async () => {
    const paid = { ...gatewayPayment, status: 'succeeded', paid: true };
    for (const invalid of [
      { ...paid, amount: { value: '1.00', currency: 'RUB' } },
      { ...paid, amount: { value: '290.00', currency: 'USD' } },
      { ...paid, id: 'unrelated-payment' },
      { ...paid, metadata: { ...paid.metadata, paymentKey: 'forged-key' } },
    ]) assert.equal(await confirmPrintPayment(invalid), false);
    assert.equal((await request(`/orders/${order.id}/pdf`)).status, 402);
  });
  await t.test('webhook reads verified gateway state and is idempotent', async () => {
    const webhook = () => realFetch(base + '/api/payment/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'payment.succeeded', object: { id: gatewayPayment.id, paid: true } }) });
    assert.equal((await webhook()).status, 200);
    assert.equal((await request(`/orders/${order.id}/pdf`)).status, 402);
    gatewayPayment = { ...gatewayPayment, status: 'succeeded', paid: true };
    assert.equal((await webhook()).status, 200);
    const paidAt = (await prisma.printOrder.findUnique({ where: { id: order.id } })).paidAt.toISOString();
    assert.equal((await webhook()).status, 200);
    assert.equal((await prisma.printOrder.findUnique({ where: { id: order.id } })).paidAt.toISOString(), paidAt);
  });
  await t.test('paid texts remain editable, design and payment cannot be changed', async () => {
    assert.equal((await request(`/orders/${order.id}`, 'PUT', { data: { ...PRINT_SAMPLE, groom: 'Михаил' }, templateId: 'noir', status: 'draft' })).status, 200);
    const result = await (await request(`/orders/${order.id}`)).json();
    assert.equal(result.templateId, 'vow'); assert.equal(result.status, 'paid'); assert.equal(result.data.groom, 'Михаил');
    assert.equal(result.paymentKey, undefined); assert.equal(result.paymentId, undefined);
    assert.equal((await request(`/orders/${order.id}/pdf`, 'GET', undefined, otherToken)).status, 404);
  });
  await t.test('status recovers a lost webhook; canceled payment starts a new attempt', async () => {
    const sample = await (await request('/orders', 'POST', { templateId: 'blue', data: PRINT_SAMPLE })).json();
    await request(`/orders/${sample.id}/pay`, 'POST');
    const firstKey = key;
    gatewayPayment = { ...gatewayPayment, status: 'canceled' };
    assert.equal((await request(`/orders/${sample.id}/pay`, 'POST')).status, 200);
    assert.notEqual(key, firstKey);
    gatewayPayment = { ...gatewayPayment, status: 'succeeded', paid: true };
    assert.equal((await (await request(`/orders/${sample.id}`)).json()).status, 'paid');
    const callsBefore = paymentCalls;
    assert.equal((await request(`/orders/${sample.id}/pay`, 'POST')).status, 200);
    assert.equal(paymentCalls, callsBefore);
  });
  await t.test('uploaded photo persists, renders and resets', async () => {
    assert.throws(() => validatePrintData({ ...PRINT_SAMPLE, photo: 'https://example.com/photo.jpg' }));
    assert.throws(() => validatePrintData({ ...PRINT_SAMPLE, photoPosition: 'invalid' }));
    const bytes = fs.readFileSync(path.join(root, 'assets/print-art/azure-photo.jpg'));
    const form = new FormData(); form.append('image', new Blob([bytes], { type: 'image/jpeg' }), 'photo.jpg');
    const upload = await realFetch(base + '/api/upload/image', { method: 'POST', body: form });
    assert.equal(upload.status, 200);
    const { url } = await upload.json();
    try {
      const data = { ...PRINT_SAMPLE, photo: url, photoPosition: 'xMinYMax' };
      const preview = await request('/preview', 'POST', { templateId: 'azure-bloom', data }, '');
      assert.equal(preview.status, 200); assert.ok((await preview.text()).includes('xMinYMax slice'));
      const sample = await prisma.printOrder.create({ data: { userId: owner.id, templateId: 'azure-bloom', data: JSON.stringify(PRINT_SAMPLE), status: 'paid' } });
      assert.equal((await request(`/orders/${sample.id}`, 'PUT', { data })).status, 200);
      assert.equal((await (await request(`/orders/${sample.id}`)).json()).data.photo, url);
      const result = await request(`/orders/${sample.id}/pdf`); assert.equal(result.status, 200);
      assert.ok(Buffer.from(await result.arrayBuffer()).includes(bytes));
      assert.equal((await request(`/orders/${sample.id}`, 'PUT', { data: { ...data, photo: '' } })).status, 200);
      assert.ok(!(await (await request(`/orders/${sample.id}`)).json()).data.photo);
    } finally { fs.unlinkSync(path.join(root, 'uploads', path.basename(url))); }
  });
  await t.test('all designs produce downloadable PDFs with correct page boxes', async () => {
    const output = path.join(root, '.test-tmp/print-samples'); fs.mkdirSync(output, { recursive: true });
    for (const template of PRINT_TEMPLATES) {
      const sample = await prisma.printOrder.create({ data: { userId: owner.id, templateId: template.id, data: JSON.stringify(PRINT_SAMPLE), status: 'paid' } });
      for (const bleed of [0, 1]) {
        const result = await request(`/orders/${sample.id}/pdf?bleed=${bleed}`);
        assert.equal(result.status, 200); assert.equal(result.headers.get('content-type'), 'application/pdf');
        const pdf = Buffer.from(await result.arrayBuffer()); assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
        const text = pdf.toString('latin1'); assert.match(text, /\/TrimBox/);
        // This design converts personalized lettering to vector outlines;
        // all other designs continue to embed their font files.
        if (['floral-gold', 'azure-bloom'].includes(template.id)) assert.match(text, /\/Subtype \/Image/);
        else assert.match(text, /\/FontFile/);
        const box = text.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/); assert.ok(box);
        assert.ok(Math.abs(Number(box[1]) - (printSize(template.id).width + bleed * 6) * 72 / 25.4) < .01);
        assert.ok(Math.abs(Number(box[2]) - (printSize(template.id).height + bleed * 6) * 72 / 25.4) < .01);
        fs.writeFileSync(path.join(output, `${template.id}${bleed ? '-bleed' : ''}.pdf`), pdf);
      }
    }
    const longData = { ...PRINT_SAMPLE, groom: 'Александр-Константин', bride: 'Александра-Анастасия', greeting: 'ДОРОГИЕ РОДНЫЕ, БЛИЗКИЕ И ЛЮБИМЫЕ ДРУЗЬЯ!', message: 'ШИРОКИЕ БУКВЫ И ДЛИННЫЕ СЛОВА '.repeat(8).slice(0, 220), venue: 'Усадьба «Самое длинное название места проведения нашей свадьбы»', address: 'Московская область, городской округ Красногорск, посёлок Архангельское, улица Центральная, 12'.slice(0, 90), footer: 'С огромной любовью и в ожидании встречи, ваши Александр и Александра' };
    validatePrintData(longData);
    const stress = await prisma.printOrder.create({ data: { userId: owner.id, templateId: 'vow', data: JSON.stringify(longData), status: 'paid' } });
    const stressResult = await request(`/orders/${stress.id}/pdf`); assert.equal(stressResult.status, 200);
    fs.writeFileSync(path.join(output, 'long-text.pdf'), Buffer.from(await stressResult.arrayBuffer()));
  });
});
