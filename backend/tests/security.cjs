const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const jwt = require('jsonwebtoken');

const root = path.resolve(__dirname, '..');
const tmpRoot = path.join(root, '.test-tmp');
fs.mkdirSync(tmpRoot, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpRoot, 'security-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-security-suite-only-32-bytes';
process.env.DATABASE_URL = `file:${path.join(tmp, 'test.db').replace(/\\/g, '/')}`;
for (const key of ['RESEND_API_KEY', 'BREVO_API_KEY', 'SMTP_USER', 'SMTP_PASS', 'TELEGRAM_BOT_TOKEN', 'YOOKASSA_SHOP_ID', 'YOOKASSA_SECRET_KEY', 'YUMONEY_SHOP_ID', 'YUMONEY_SECRET_KEY']) process.env[key] = '';
const db = new DatabaseSync(path.join(tmp, 'test.db'));
for (const dir of fs.readdirSync(path.join(root, 'prisma/migrations')).sort()) {
  const file = path.join(root, 'prisma/migrations', dir, 'migration.sql');
  if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
}
db.close();
const prisma = require('../dist/lib/prisma').default;
const { hashCode, jwtSecret, escapeHtml } = require('../dist/lib/security');
const app = require('../dist/index').default;
let server;
let base;
const uploaded = [];
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await prisma.$disconnect();
  for (const file of uploaded) fs.unlinkSync(file);
  assert.equal(path.dirname(tmp), tmpRoot);
  fs.rmSync(tmp, { recursive: true });
});

test('security and functional regressions on an isolated migrated database', async t => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const request = (route, method = 'GET', body, token) => fetch(base + route, {
    method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const owner = await prisma.user.create({ data: { email: 'owner@example.test' } });
  const stranger = await prisma.user.create({ data: { email: 'other@example.test' } });
  const token = jwt.sign({ userId: owner.id }, jwtSecret());
  const otherToken = jwt.sign({ userId: stranger.id }, jwtSecret());
  const invite = await prisma.invitation.create({ data: { userId: owner.id, slug: 'audit-wedding', templateId: 'calla', status: 'paid', plan: 'premium' } });
  const draft = await prisma.invitation.create({ data: { userId: owner.id, slug: 'audit-draft', templateId: 'calla' } });

  await t.test('forged JWT and missing subject are rejected', async () => {
    assert.equal((await request('/api/invites', 'GET', undefined, jwt.sign({ userId: owner.id }, 'secret'))).status, 401);
    assert.equal((await request('/api/invites', 'GET', undefined, jwt.sign({}, jwtSecret()))).status, 401);
    assert.equal((await request('/api/invites/' + invite.id, 'GET', undefined, otherToken)).status, 404);
  });
  await t.test('OTP is single-use, normalized and limited', async () => {
    const email = 'login@example.test';
    await prisma.verificationCode.create({ data: { email, code: hashCode(email, '123456'), expiresAt: new Date(Date.now() + 60000) } });
    assert.equal((await request('/api/auth/verify-code', 'POST', { email: ' Login@Example.Test ', code: '123456' })).status, 200);
    assert.equal((await request('/api/auth/verify-code', 'POST', { email, code: '123456' })).status, 401);
    for (let i = 0; i < 5; i++) await request('/api/auth/verify-code', 'POST', { email: 'brute@example.test', code: '000000' });
    assert.equal((await request('/api/auth/verify-code', 'POST', { email: 'brute@example.test', code: '000000' })).status, 429);
    assert.equal((await request('/api/auth/send-code', 'POST', { email: ['not-an-email'] })).status, 400);
  });
  await t.test('private data and drafts stay private', async () => {
    const result = await (await request('/api/invites/by-slug/' + invite.slug)).json();
    for (const key of ['userId', 'notifyEmail', 'telegramConnectToken', 'paymentId']) assert.equal(key in result, false);
    assert.equal((await request('/api/invites/by-slug/' + draft.slug)).status, 402);
  });
  await t.test('personal RSVP updates one answer and rejects foreign tokens', async () => {
    const guest = await prisma.guest.create({ data: { invitationId: invite.id, token: 'test-personal-token', names: 'Анна' } });
    for (const attending of [true, false]) assert.equal((await request('/api/rsvp/' + invite.slug, 'POST', { attending, guestToken: guest.token })).status, 200);
    assert.equal(await prisma.guestResponse.count({ where: { invitationId: invite.id } }), 1);
    const summary = await (await request('/api/rsvp/' + invite.id, 'GET', undefined, token)).json();
    assert.equal(summary.stats.notAttending, 1);
    assert.equal((await request('/api/rsvp/' + invite.slug, 'POST', { attending: true, guestToken: 'wrong' })).status, 400);
    assert.equal((await request('/api/rsvp/' + invite.slug, 'POST', { attending: 'false', guestName: 'Guest' })).status, 400);
  });
  await t.test('unsafe uploads fail, safe uploads get a server-selected extension', async () => {
    async function upload(content, type, name) {
      const form = new FormData(); form.append('image', new Blob([content], { type }), name);
      return fetch(base + '/api/upload/image', { method: 'POST', body: form });
    }
    assert.equal((await upload('<svg onload="alert(1)">', 'image/svg+xml', 'test.svg')).status, 400);
    assert.equal((await upload('<html>payload</html>', 'image/png', 'test.png')).status, 400);
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=', 'base64');
    const result = await upload(image, 'image/png', 'payload.html');
    assert.equal(result.status, 200);
    const { url } = await result.json();
    assert.match(url, /\.png$/);
    uploaded.push(path.join(root, 'uploads', path.basename(url)));
    const served = await fetch(base + url);
    assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
    assert.match(served.headers.get('content-security-policy'), /sandbox/);
  });
  await t.test('telegram spoofing and implicit test payments are blocked', async () => {
    assert.equal((await request('/api/telegram/webhook', 'POST', { message: {} })).status, 403);
    assert.equal((await request('/api/payment/create', 'POST', { inviteId: draft.id, plan: 'premium' }, token)).status, 503);
    assert.equal((await request('/api/payment/create', 'POST', { inviteId: draft.id, plan: 'constructor' }, token)).status, 400);
    assert.equal((await prisma.invitation.findUnique({ where: { id: draft.id } })).status, 'draft');
  });
  await t.test('invalid editor payload and reserved slug are rejected', async () => {
    const created = await (await request('/api/invites', 'POST', { templateId: 'calla' }, token)).json();
    assert.ok(Array.isArray(created.schedule));
    assert.ok(Array.isArray(created.galleryPhotos));
    assert.equal(typeof created.enabledSections, 'object');
    assert.equal((await request('/api/invites/' + created.id, 'PUT', created, token)).status, 200);
    assert.equal((await request('/api/invites/' + draft.id, 'PUT', { schedule: 'invalid' }, token)).status, 400);
    assert.equal((await request('/api/invites/' + draft.id, 'PUT', { groomName: 'Иван', schedule: [] }, token)).status, 200);
    assert.equal((await request('/api/invites/' + draft.id + '/slug', 'PATCH', { slug: 'privacy' }, token)).status, 400);
  });
  await t.test('deleting an invitation with RSVP succeeds and removes dependants', async () => {
    assert.equal((await request('/api/invites/' + invite.id, 'DELETE', undefined, token)).status, 200);
    assert.equal(await prisma.guestResponse.count({ where: { invitationId: invite.id } }), 0);
    assert.equal(await prisma.guest.count({ where: { invitationId: invite.id } }), 0);
  });
  await t.test('production rejects a weak JWT key and HTML is escaped', () => {
    const saved = process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production'; process.env.JWT_SECRET = 'secret';
    assert.throws(jwtSecret, /JWT_SECRET/);
    process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = saved;
    assert.equal(escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
  });
});
