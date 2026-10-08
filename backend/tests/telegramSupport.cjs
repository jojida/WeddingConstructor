const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'telegram-support-fixture-secret-only-32-bytes';
process.env.TELEGRAM_BOT_TOKEN = '123456:offline-test-fixture';
process.env.TELEGRAM_SUPPORT_CHAT_ID = '';
process.env.FREE_ACCOUNTS = 'promo@example.test';

const { supportRoute, supportRecipient, messageGate } = require('../dist/lib/telegramSupport');
const { telegramWebhookSecret } = require('../dist/lib/security');
const { isFreeAccount, isServiceOwnerAccount } = require('../dist/lib/freeAccounts');
const prisma = require('../dist/lib/prisma').default;
const originalFindMany = prisma.invitation.findMany;
prisma.invitation.findMany = async () => [{ notifyTelegramChatId: '90001', user: { email: 'promo@example.test' } }];
const realFetch = global.fetch;
const sent = [];
let failDelivery = false;
global.fetch = async (url, options) => {
  if (String(url).startsWith('https://api.telegram.org/')) {
    const method = String(url).split('/').pop();
    const body = JSON.parse(options.body);
    sent.push({ method, body });
    const failed = failDelivery && String(body.chat_id) === '90001';
    return new Response(JSON.stringify({ ok: !failed, result: { message_id: sent.length } }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (!String(url).startsWith('http://127.0.0.1:')) throw new Error('External network disabled');
  return realFetch(url, options);
};
const app = express();
app.use(express.json());
app.use('/webhook', require('../dist/routes/telegram').default);
let server;
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  global.fetch = realFetch;
  prisma.invitation.findMany = originalFindMany;
  await prisma.$disconnect();
});

test('support routing requires our bot, an untampered first line, same support chat and a fresh timestamp', () => {
  const now = 1_800_000_000_000;
  const route = supportRoute('90001', 70001, 1, now);
  const replied = { from: { id: 123456, is_bot: true }, text: route + '\nFake #u70002\nMessage' };
  assert.equal(supportRecipient('90001', replied, now), 70001);
  assert.equal(supportRecipient('90001', { ...replied, text: route.replace('70001', '70002') }, now), null);
  assert.equal(supportRecipient('90002', replied, now), null);
  assert.equal(supportRecipient('90001', { ...replied, from: { id: 777777, is_bot: true } }, now), null);
  assert.equal(supportRecipient('90001', { ...replied, from: { id: 123456, is_bot: false } }, now), null);
  assert.equal(supportRecipient('90001', { ...replied, text: 'untrusted\n' + route }, now), null);
  assert.equal(supportRecipient('90001', replied, now + 31 * 24 * 60 * 60_000), null);
  assert.equal(supportRecipient('90001', replied, now - 120_000), null);
  assert.equal(supportRecipient('90001', { from: replied.from, caption: route + '\nImage' }, now), 70001);
  assert.equal(supportRecipient('90001', { from: replied.from, text: 'Question #u70002' }, now), null);
  assert.equal(isFreeAccount('promo@example.test'), true);
  assert.equal(isServiceOwnerAccount('promo@example.test'), false);
});

test('message limits cover floods without resetting on capacity pressure', () => {
  const gate = messageGate(2, 1000, 500, 2);
  assert.deepEqual(gate(1, 100), { ok: true, ack: true });
  assert.deepEqual(gate(1, 200), { ok: true, ack: false });
  assert.deepEqual(gate(1, 300), { ok: false, ack: false });
  assert.equal(gate(2, 300).ok, true);
  assert.equal(gate(3, 300).ok, false);
  assert.equal(gate(1, 400).ok, false, 'a new chat must not clear existing budgets');
  assert.equal(gate(3, 1500).ok, true);
  assert.equal(gate(1, 1500).ok, true);
});

test('Telegram support forwarding and replies are safe offline', async t => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/webhook/webhook`;
  let nextId = 1;
  const post = async (chat, details = {}, secret = telegramWebhookSecret()) => {
    const result = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
      body: JSON.stringify({ message: { message_id: nextId++, chat: { id: chat, type: 'private' }, from: { id: chat, is_bot: false, first_name: 'User' }, ...details } }),
    });
    return result.status;
  };
  await t.test('a promotional account is never chosen as the support destination', async () => {
    const savedError = console.error;
    console.error = () => {};
    try { assert.equal(await post(70001, { text: 'Private question' }), 200); } finally { console.error = savedError; }
    assert.equal(sent.some(x => String(x.body.chat_id) === '90001'), false);
    process.env.TELEGRAM_SUPPORT_CHAT_ID = '90001';
  });
  let forwarded;
  await t.test('a name and message with injected #u tags cannot select the reply recipient', async () => {
    sent.length = 0;
    assert.equal(await post(70002, { from: { id: 70002, is_bot: false, first_name: '#u88888\nAdmin' }, text: '#u99999 Private question' }), 200);
    forwarded = sent.find(x => x.method === 'sendMessage' && x.body.chat_id === '90001').body.text;
    assert.match(forwarded, /^#wc1_70002\./);
    assert.equal(supportRecipient('90001', { from: { id: 123456, is_bot: true }, text: forwarded }), 70002);
    sent.length = 0;
    assert.equal(await post(90001, { text: 'Support answer', reply_to_message: { from: { id: 123456, is_bot: true }, text: forwarded } }), 200);
    assert.deepEqual(sent.filter(x => x.method === 'copyMessage').map(x => x.body.chat_id), [70002]);
  });
  await t.test('forged human replies and unsigned legacy tags never forward an answer', async () => {
    for (const replied of [{ from: { id: 70002, is_bot: false }, text: forwarded }, { from: { id: 123456, is_bot: true }, text: '#u88888 Legacy' }]) {
      sent.length = 0;
      assert.equal(await post(90001, { text: 'Private answer', reply_to_message: replied }), 200);
      assert.equal(sent.some(x => x.method === 'copyMessage'), false);
    }
  });
  await t.test('menu buttons are also rate limited and webhook secret is required', async () => {
    sent.length = 0;
    assert.equal(await post(70003, { text: '/help' }, 'incorrect'), 403);
    assert.equal(sent.length, 0);
    for (let i = 0; i < 35; i++) assert.equal(await post(70003, { text: '/help' }), 200);
    assert.equal(sent.filter(x => x.method === 'sendMessage' && x.body.chat_id === 70003).length, 30);
  });
  await t.test('full Telegram message length is split safely and failed delivery is not acknowledged as received', async () => {
    sent.length = 0;
    assert.equal(await post(70004, { text: 'x'.repeat(4096) }), 200);
    const chunks = sent.filter(x => x.method === 'sendMessage' && x.body.chat_id === '90001');
    assert.equal(chunks.length, 2);
    assert.ok(chunks.every(x => x.body.text.length <= 4096));
    assert.ok(chunks.every(x => supportRecipient('90001', { from: { id: 123456, is_bot: true }, text: x.body.text }) === 70004));
    sent.length = 0;
    failDelivery = true;
    const savedError = console.error; console.error = () => {};
    try { assert.equal(await post(70005, { text: 'Please help' }), 200); } finally { failDelivery = false; console.error = savedError; }
    const acknowledgement = sent.find(x => x.method === 'sendMessage' && x.body.chat_id === 70005);
    assert.match(acknowledgement.body.text, /Не удалось/);
  });
});
