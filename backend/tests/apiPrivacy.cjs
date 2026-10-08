const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const dns = require('node:dns').promises;
const jwt = require('jsonwebtoken');
const express = require('express');

// This suite uses only a fresh local database and loopback HTTP. DNS and Telegram
// are stubbed before loading routes; no credentials, real guests or messages are used.
const root = path.resolve(__dirname, '..');
const tmpRoot = path.join(root, '.test-tmp');
fs.mkdirSync(tmpRoot, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpRoot, 'api-privacy-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'privacy-suite-local-only-secret-at-least-32-bytes';
process.env.SERVER_IP = '192.0.2.10';
process.env.DATABASE_URL = `file:${path.join(tmp, 'test.db').replace(/\\/g, '/')}`;
for (const key of ['FREE_ACCOUNTS', 'RESEND_API_KEY', 'BREVO_API_KEY', 'SMTP_USER', 'SMTP_PASS', 'TELEGRAM_BOT_TOKEN']) process.env[key] = '';
const db = new DatabaseSync(path.join(tmp, 'test.db'));
for (const dir of fs.readdirSync(path.join(root, 'prisma/migrations')).sort()) {
  const file = path.join(root, 'prisma/migrations', dir, 'migration.sql');
  if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
}
db.close();

const oldResolve4 = dns.Resolver.prototype.resolve4;
const oldResolveTxt = dns.Resolver.prototype.resolveTxt;
const records = new Map();
dns.Resolver.prototype.resolve4 = async () => [process.env.SERVER_IP];
dns.Resolver.prototype.resolveTxt = async name => records.get(name) || [];
const notify = require('../dist/lib/notify');
const oldTgSend = notify.tgSend;
notify.tgSend = async () => {};
const realFetch = global.fetch;
global.fetch = async (url, options) => {
  if (String(url).startsWith('https://api.telegram.org/')) return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { headers: { 'Content-Type': 'application/json' } });
  if (!String(url).startsWith('http://127.0.0.1:')) throw new Error('External network disabled in privacy tests');
  return realFetch(url, options);
};

const prisma = require('../dist/lib/prisma').default;
const { hashCode, jwtSecret, telegramWebhookSecret, normalizeEmail } = require('../dist/lib/security');
const { normalizeDomain, domainVerification } = require('../dist/lib/domains');
const { validInviteInput, safeAssetUrl } = require('../dist/lib/inviteValidation');
const app = express();
app.use(express.json({ strict: false }));
for (const name of ['auth', 'invites', 'guests', 'rsvp', 'domains', 'telegram']) app.use('/api/' + name, require('../dist/routes/' + name).default);
let server;
after(async () => {
  dns.Resolver.prototype.resolve4 = oldResolve4;
  dns.Resolver.prototype.resolveTxt = oldResolveTxt;
  notify.tgSend = oldTgSend;
  global.fetch = realFetch;
  if (server) await new Promise(resolve => server.close(resolve));
  await prisma.$disconnect();
  assert.equal(path.dirname(tmp), tmpRoot);
  fs.rmSync(tmp, { recursive: true });
});

test('stored URLs, JSON budgets, domains and email reject malformed input', () => {
  for (const value of ['javascript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,<script/>', '//example.test/a', '/\\example.test/a']) assert.equal(safeAssetUrl(value), false, value);
  for (const value of ['', '/uploads/photo.png', '/invite/calla/a.jpg', 'assets/photo.jpg', 'https://example.test/photo.jpg']) assert.equal(safeAssetUrl(value), true, value);
  assert.equal(validInviteInput({ mapLink: 'javascript:alert(1)' }), false);
  assert.equal(validInviteInput(JSON.parse('{"customData":{"__proto__":{"polluted":true}}}')), false);
  assert.equal(validInviteInput({ customData: Object.fromEntries(Array.from({ length: 301 }, (_, i) => ['x' + i, ''])) }), false);
  assert.equal(validInviteInput({ customData: { rows: Array.from({ length: 100 }, () => Array(100).fill('x')) } }), false);
  assert.equal(validInviteInput({ customData: { caption: 'Our wedding', photoFrames: { photo: { x: 0.5, y: 0.5, z: 1 } } } }), true);
  for (const value of ['https://user@example.test', 'example.test:8443', 'example.test/a', '127.0.0.1', 'foo.localhost', ['example.test'], 'x'.repeat(64) + '.test']) assert.equal(normalizeDomain(value), null);
  assert.equal(normalizeDomain('https://WWW.Example.test/'), 'example.test');
  assert.equal(normalizeDomain('пример.рф'), 'xn--e1afmkfd.xn--p1ai');
  assert.equal(normalizeEmail('unsafe\0@example.test'), null);
});

test('API ownership, public privacy, persistent OTP, domain ownership and Telegram regression', async t => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const owner = await prisma.user.create({ data: { email: 'owner@privacy.test' } });
  const stranger = await prisma.user.create({ data: { email: 'other@privacy.test' } });
  const ownerToken = jwt.sign({ userId: owner.id }, jwtSecret(), { expiresIn: '5m' });
  const otherToken = jwt.sign({ userId: stranger.id }, jwtSecret(), { expiresIn: '5m' });
  const call = async (route, method = 'GET', body, token = ownerToken, headers = {}) => {
    const response = await fetch(base + route, { method, headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers,
    }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await response.text();
    return { status: response.status, json: response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
  };
  const invite = await prisma.invitation.create({ data: {
    userId: owner.id, slug: 'privacy-wedding', templateId: 'calla', plan: 'premium', status: 'paid',
    title: 'Private owner title', notifyEmail: 'private@privacy.test', notifyTelegramChatId: '123',
    telegramConnectToken: 'private-connect-token', paymentId: 'private-payment-id', paidAt: new Date(),
    customData: JSON.stringify({ apiBase: 'https://bad.test', guestToken: 'private-guest-token', wcMenu: { askDiet: true }, plan: 'maximum', photo: 'java\nscript:alert(1)', caption: 'Visible text' }),
  } });
  const guest = await prisma.guest.create({ data: { invitationId: invite.id, token: 'privacy-personal-guest-token', names: 'Анна' } });

  await t.test('public response is an allowlist and runtime customData cannot be forged', async () => {
    const pub = (await call('/api/invites/by-slug/' + invite.slug, 'GET', undefined, null)).json;
    const visibleKeys = ['id', 'slug', 'templateId', 'status', 'plan', 'groomName', 'brideName', 'weddingDate', 'weddingTime', 'venue', 'venueAddress', 'story', 'inviteText', 'dressCode', 'colorScheme', 'mapLink', 'coverPhoto', 'coverVideo', 'dressCodePhoto', 'musicUrl', 'galleryPhotos', 'schedule', 'dressCodeColors', 'enabledSections', 'customData'];
    assert.deepEqual(Object.keys(pub).sort(), visibleKeys.sort());
    assert.deepEqual(pub.customData, { photo: '', caption: 'Visible text', plan: 'premium' });
    const saved = await call('/api/invites/' + invite.id, 'PUT', { customData: { apiBase: 'https://bad.test', guestName: 'Fake', wcMenu: { askDiet: true }, plan: 'maximum', caption: 'Updated' } });
    assert.equal(saved.status, 200);
    assert.deepEqual(JSON.parse((await prisma.invitation.findUnique({ where: { id: invite.id } })).customData), { caption: 'Updated' });
    const cards = (await call('/api/invites')).json;
    assert.equal(cards.length, 1);
    for (const key of ['customData', 'paymentId', 'telegramConnectToken', 'notifyEmail']) assert.equal(key in cards[0], false, key);
  });

  await t.test('every owner operation rejects a stranger and malformed bodies fail cleanly', async () => {
    for (const [url, method, body] of [
      ['/api/invites/' + invite.id, 'GET'], ['/api/invites/' + invite.id, 'PUT', { groomName: 'Hacked' }],
      ['/api/invites/' + invite.id, 'DELETE'], ['/api/invites/' + invite.id + '/settings', 'PATCH', { notifyEmail: 'other@privacy.test' }],
      ['/api/invites/' + invite.id + '/slug', 'PATCH', { slug: 'hijacked-slug' }],
      ['/api/invites/' + invite.id + '/telegram-connect', 'POST', {}],
      ['/api/guests/' + invite.id, 'GET'], ['/api/guests/' + invite.id, 'POST', { names: 'Other' }],
      ['/api/guests/' + guest.id, 'PUT', { names: 'Other' }], ['/api/guests/' + guest.id, 'DELETE'],
      ['/api/domains/status/' + invite.id, 'GET'],
    ]) assert.equal((await call(url, method, body, otherToken)).status, 404, url);
    assert.equal((await call('/api/rsvp/' + invite.id, 'GET', undefined, otherToken)).status, 403);
    assert.equal((await call('/api/invites/' + invite.id + '/settings', 'PATCH', null)).status, 400);
    assert.equal((await call('/api/guests/' + invite.id, 'POST', { names: {} })).status, 400);
    assert.equal((await call('/api/rsvp/' + invite.slug, 'POST', null, null)).status, 400);
    assert.equal((await call('/api/invites', 'GET', undefined, jwt.sign({ userId: owner.id }, jwtSecret(), { expiresIn: -1 }))).status, 401);
    assert.equal((await call('/api/invites', 'GET', undefined, jwt.sign({ userId: {} }, jwtSecret()))).status, 401);
    const created = await call('/api/invites', 'POST', { templateId: 'calla' });
    assert.equal(created.status, 200);
    assert.match(created.json.slug, /^groom-i-bride-[0-9a-f]{24}$/);
  });

  await t.test('the persisted OTP attempt budget survives an empty process rate limiter', async () => {
    const expiredBudget = 'locked@privacy.test';
    await prisma.verificationCode.create({ data: { email: expiredBudget, code: hashCode(expiredBudget, '123456'), attempts: 5, expiresAt: new Date(Date.now() + 60000) } });
    assert.equal((await call('/api/auth/verify-code', 'POST', { email: expiredBudget, code: '123456' }, null)).status, 401);
    const email = 'last-attempt@privacy.test';
    await prisma.verificationCode.create({ data: { email, code: hashCode(email, '123456'), attempts: 4, expiresAt: new Date(Date.now() + 60000) } });
    assert.equal((await call('/api/auth/verify-code', 'POST', { email, code: '000000' }, null)).status, 401);
    assert.equal((await prisma.verificationCode.findUnique({ where: { email } })).attempts, 5);
    assert.equal((await call('/api/auth/verify-code', 'POST', { email, code: '123456' }, null)).status, 401);
    const okEmail = 'valid@privacy.test';
    await prisma.verificationCode.create({ data: { email: okEmail, code: hashCode(okEmail, '123456'), attempts: 4, expiresAt: new Date(Date.now() + 60000) } });
    assert.equal((await call('/api/auth/verify-code', 'POST', { email: okEmail, code: '123456' }, null)).status, 200);
    assert.equal((await call('/api/auth/verify-code', 'POST', { email: okEmail, code: '123456' }, null)).status, 401);
  });

  await t.test('a public guest capability never reads another invitation or mismatched RSVP', async () => {
    const other = await prisma.invitation.create({ data: { userId: stranger.id, slug: 'other-privacy-wedding', templateId: 'calla', plan: 'premium', status: 'paid' } });
    const privateAnswer = await prisma.guestResponse.create({ data: { invitationId: other.id, guestName: 'Private', attending: true } });
    await prisma.guest.update({ where: { id: guest.id }, data: { responseId: privateAnswer.id } });
    const resolved = await call('/api/guests/resolve/' + guest.token + '?invite=' + invite.id, 'GET', undefined, null);
    assert.equal(resolved.status, 200);
    assert.equal(resolved.json.attendance, null);
    assert.equal(resolved.json.attending, null);
    assert.equal((await call('/api/guests/resolve/' + guest.token + '?invite=' + other.id, 'GET', undefined, null)).status, 404);
    assert.equal((await call('/api/rsvp/' + other.slug, 'POST', { guestToken: guest.token, attending: true }, null)).status, 400);
    await prisma.invitation.update({ where: { id: invite.id }, data: { plan: 'free' } });
    assert.equal((await call('/api/guests/' + guest.id, 'PUT', { names: 'Other' })).status, 403);
    assert.equal((await call('/api/guests/resolve/' + guest.token, 'GET', undefined, null)).status, 404);
    await prisma.invitation.update({ where: { id: invite.id }, data: { plan: 'premium' } });
  });

  await t.test('custom domains require an invite-specific TXT proof, even if A points to the server', async () => {
    const domain = 'privacy-domain.example';
    const pending = await prisma.invitation.create({ data: { userId: stranger.id, slug: 'pending-domain-squatter', templateId: 'calla', plan: 'premium', status: 'paid', customDomain: domain } });
    assert.equal((await call('/api/invites/' + invite.id + '/settings', 'PATCH', { customDomain: domain })).status, 200, 'an unverified claim cannot squat a domain');
    assert.equal((await call('/api/invites/by-domain/' + domain, 'GET', undefined, null)).status, 404);
    assert.equal((await call('/api/domains/check?domain=' + domain, 'GET', undefined, null)).status, 404);
    const status = (await call('/api/domains/status/' + invite.id)).json;
    assert.equal(status.dnsOk, true);
    assert.equal(status.verified, false);
    assert.deepEqual(status.verification, domainVerification(invite.id, domain));
    assert.notEqual(status.verification.value, domainVerification(pending.id, domain).value);
    const { name, value } = status.verification;
    records.set(name, [[value.slice(0, 30), value.slice(30)]]);
    assert.equal((await call('/api/domains/status/' + invite.id)).json.verified, true);
    assert.equal((await call('/api/domains/check?domain=' + domain, 'GET', undefined, null)).status, 200);
    assert.equal((await call('/api/invites/by-domain/' + domain, 'GET', undefined, null)).json.id, invite.id);
    assert.equal((await call('/api/domains/status/' + pending.id, 'GET', undefined, otherToken)).json.verified, false);
    records.set(name, [[domainVerification(pending.id, domain).value]]);
    assert.equal((await call('/api/domains/status/' + pending.id, 'GET', undefined, otherToken)).status, 409, 'database uniqueness prevents two verified owners');
    assert.equal((await call('/api/invites/' + invite.id + '/settings', 'PATCH', { customDomain: 'replacement.example' })).status, 200);
    assert.equal((await prisma.invitation.findUnique({ where: { id: invite.id } })).customDomainVerifiedAt, null);
    assert.equal((await call('/api/domains/check?domain=replacement.example', 'GET', undefined, null)).status, 404);
    assert.equal((await call('/api/invites/' + invite.id + '/settings', 'PATCH', { customDomain: 'api.weddingcraft.ru' })).status, 400);
  });

  await t.test('Telegram deep links expire and successful consumption cannot be replayed', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'local-fixture-no-network';
    const connect = await call('/api/invites/' + invite.id + '/telegram-connect', 'POST', {});
    assert.equal(connect.status, 200);
    assert.match(connect.json.token, /^[A-Za-z0-9_-]{32}$/);
    let saved = await prisma.invitation.findUnique({ where: { id: invite.id } });
    assert.ok(saved.telegramConnectExpiresAt > new Date());
    const webhook = (link, chat, secret = telegramWebhookSecret()) => call('/api/telegram/webhook', 'POST', { message: { message_id: 1, from: { id: chat, is_bot: false }, text: '/start ' + link, chat: { id: chat, type: 'private' } } }, null, { 'X-Telegram-Bot-Api-Secret-Token': secret });
    assert.equal((await webhook(connect.json.token, 10001, 'forged')).status, 403);
    await prisma.invitation.update({ where: { id: invite.id }, data: { telegramConnectExpiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await webhook(connect.json.token, 10001)).status, 200);
    assert.equal((await prisma.invitation.findUnique({ where: { id: invite.id } })).notifyTelegramChatId, '123');
    const next = await call('/api/invites/' + invite.id + '/telegram-connect', 'POST', {});
    assert.notEqual(next.json.token, connect.json.token);
    assert.equal((await webhook(next.json.token, 10001)).status, 200);
    assert.equal((await webhook(next.json.token, 10002)).status, 200);
    saved = await prisma.invitation.findUnique({ where: { id: invite.id } });
    assert.equal(saved.notifyTelegramChatId, '10001');
    assert.equal(saved.telegramConnectToken, '');
    assert.equal(saved.telegramConnectExpiresAt, null);
  });
});
