// Напоминание гостям в MAX: ссылка из анкеты (bot_started с payload), рассылка с кнопками,
// ответ кнопкой (message_callback → POST /answers), остановленный бот, подписка на вебхук.
// API MAX — поддельный сервер на 127.0.0.1 (MAX_API_URL), Telegram подменён, SMS в пробном режиме.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const jwt = require('jsonwebtoken');
const express = require('express');

const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, '.test-tmp'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(root, '.test-tmp/reminders-max-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'reminders-max-suite-secret-at-least-32-chars';
process.env.DATABASE_URL = `file:${path.join(tmp, 'test.db').replace(/\\/g, '/')}`;
for (const key of ['FREE_ACCOUNTS', 'BREVO_API_KEY', 'SMTP_USER', 'SMTP_PASS', 'TELEGRAM_WEBHOOK_SECRET', 'MAX_WEBHOOK_SECRET', 'SMSAERO_EMAIL',
  'SMSAERO_API_KEY', 'SMS_DRY_RUN', 'REMINDER_SMS_LIMIT', 'PLANNER_PUBLIC', 'MAX_CA_FILE', 'BACKEND_URL']) process.env[key] = '';
process.env.TELEGRAM_BOT_TOKEN = 'local-fixture-no-network';
process.env.TELEGRAM_BOT_USERNAME = 'WeddingCraftBot';
process.env.MAX_BOT_TOKEN = 'max-fixture-token';
process.env.MAX_BOT_USERNAME = 'weddingcraft_bot';
process.env.FRONTEND_URL = 'https://weddingcraft.ru';
const db = new DatabaseSync(path.join(tmp, 'test.db'));
for (const dir of fs.readdirSync(path.join(root, 'prisma/migrations')).sort()) {
  const file = path.join(root, 'prisma/migrations', dir, 'migration.sql');
  if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
}
db.close();

// Поддельный API MAX: запоминает вызовы; user_id 403403 «остановил бота»
const max = [];
let subscriptions = [{ url: 'https://old.example.test/hook' }];
const fake = express();
fake.use(express.json());
fake.use((req, res, next) => { max.push({ method: req.method, path: req.path, query: req.query, body: req.body, auth: req.get('Authorization') }); next(); });
fake.get('/me', (_req, res) => res.json({ user_id: 1, name: 'WeddingCraft', username: 'weddingcraft_bot', is_bot: true }));
fake.post('/messages', (req, res) => (req.query.user_id === '403403'
  ? res.status(403).json({ code: 'chat.denied', message: 'Bot is blocked' })
  : res.json({ message: { body: { mid: `mid.${max.length}`, text: req.body.text } } })));
fake.post('/answers', (_req, res) => res.json({ success: true }));
fake.get('/subscriptions', (_req, res) => res.json({ subscriptions }));
fake.delete('/subscriptions', (req, res) => { subscriptions = subscriptions.filter((s) => s.url !== req.query.url); res.json({ success: true }); });
fake.post('/subscriptions', (req, res) => { subscriptions = [...subscriptions.filter((s) => s.url !== req.body.url), { url: req.body.url }]; res.json({ success: true }); });

// Telegram — запись вызовов; чат 6403 «заблокировал бота»
const tg = [];
const realFetch = global.fetch;
global.fetch = async (url, options) => {
  const u = String(url);
  if (u.startsWith('https://api.telegram.org/')) {
    const body = JSON.parse(options.body);
    tg.push({ method: u.split('/').pop(), body });
    const blocked = body.chat_id === '6403' || body.chat_id === 6403;
    return new Response(JSON.stringify(blocked ? { ok: false, error_code: 403, description: 'Forbidden' } : { ok: true, result: { message_id: 1 } }),
      { headers: { 'Content-Type': 'application/json' } });
  }
  if (!u.startsWith('http://127.0.0.1:')) throw new Error('External network disabled in reminders-max tests');
  return realFetch(url, options);
};

const prisma = require('../dist/lib/prisma').default;
const app = require('../dist/index').default;
const R = require('../dist/lib/reminders');
const M = require('../dist/lib/maxBot');
const { maxWebhookSecret } = require('../dist/lib/security');
let server, fakeServer;
after(async () => {
  global.fetch = realFetch;
  if (server) await new Promise((r) => server.close(r));
  if (fakeServer) await new Promise((r) => fakeServer.close(r));
  await prisma.$disconnect();
  fs.rmSync(tmp, { recursive: true });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(list, pred, what) {
  for (let i = 0; i < 100; i++) { const hit = list.find(pred); if (hit) return hit; await sleep(20); }
  throw new Error(`не дождались: ${what}`);
}
const DAY = 864e5;
const mskToday = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const at = (date, hour) => Date.parse(`${date}T00:00:00Z`) + (hour - 3) * 3600e3;
const token = (s) => s.padEnd(10, 'x').slice(0, 10);
const sentTo = (userId) => (c) => c.method === 'POST' && c.path === '/messages' && c.query.user_id === String(userId);

test('чистые функции MAX', () => {
  assert.deepEqual(M.maxKeyboard([[{ text: '✅ Буду', callback_data: 'rm:y:abc' }], [{ text: 'Сайт', url: 'https://weddingcraft.ru/x' }]]), [{
    type: 'inline_keyboard',
    payload: { buttons: [[{ type: 'callback', text: '✅ Буду', payload: 'rm:y:abc' }], [{ type: 'link', text: 'Сайт', url: 'https://weddingcraft.ru/x' }]] },
  }]);
  assert.deepEqual(M.maxKeyboard([]), [], 'без кнопок — без вложения');
  assert.match(maxWebhookSecret(), /^[a-zA-Z0-9_-]{5,256}$/, 'MAX принимает только такие секреты');
  // Корень Минцифры лежит в репозитории и совпадает с опубликованным отпечатком
  const { X509Certificate } = require('node:crypto');
  const cert = new X509Certificate(fs.readFileSync(path.join(root, 'assets/certs/russian-trusted-root-ca.crt')));
  assert.equal(cert.fingerprint, '8F:F9:15:CC:AB:7B:C1:6F:8C:5C:80:99:D5:3E:0E:11:5B:3A:EC:2F');
  assert.match(cert.subject, /CN=Russian Trusted Root CA/);
});

test('напоминания в MAX', async (t) => {
  fakeServer = fake.listen(0, '127.0.0.1');
  await new Promise((r) => fakeServer.once('listening', r));
  process.env.MAX_API_URL = `http://127.0.0.1:${fakeServer.address().port}`;
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (url, method = 'GET', body, tok, extra = {}) => {
    const res = await realFetch(base + url, {
      method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...extra },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, text, json: text && (res.headers.get('content-type') || '').includes('json') ? JSON.parse(text) : null };
  };
  const hook = (update, secret = maxWebhookSecret()) =>
    call('/api/max/webhook', 'POST', { timestamp: Date.now(), ...update }, null, secret === null ? {} : { 'X-Max-Bot-Api-Secret': secret });
  const started = (userId, payload) => hook({ update_type: 'bot_started', chat_id: userId + 1, user: { user_id: userId, first_name: 'Гость', is_bot: false }, payload });
  const said = (userId, text) => hook({ update_type: 'message_created', message: {
    sender: { user_id: userId, first_name: 'Гость', is_bot: false }, recipient: { chat_id: userId + 1, chat_type: 'dialog' }, timestamp: Date.now(), body: { mid: 'm1', text },
  } });
  const press = (userId, payload, message) => hook({ update_type: 'message_callback',
    callback: { timestamp: Date.now(), callback_id: `cb-${max.length}`, payload, user: { user_id: userId, first_name: 'Гость', is_bot: false } }, message });

  const owner = await prisma.user.create({ data: { email: 'couple-max@example.test' } });
  const tok = jwt.sign({ userId: owner.id }, process.env.JWT_SECRET);
  const wedding = addDays(mskToday, 10);
  const inv = await prisma.invitation.create({ data: {
    userId: owner.id, slug: 'max-couple', templateId: 'calla', status: 'published', plan: 'maximum',
    groomName: 'Денис', brideName: 'Мария', weddingDate: wedding, weddingTime: '15:00', venue: 'Усадьба', venueAddress: 'Москва',
  } });
  const rsvp = (body) => call('/api/rsvp/max-couple', 'POST', { attendance: 'yes', guestsCount: 2, ...body });
  const reminderOf = (t) => prisma.guestReminder.findUnique({ where: { token: t }, include: { response: true } });

  await t.test('анкета предлагает и Telegram, и MAX', async () => {
    assert.equal((await call(`/api/reminders/${inv.id}`, 'PUT', { enabled: true, days: '7' }, tok)).status, 200);
    assert.deepEqual((await call('/api/invites/by-slug/max-couple')).json.customData.wcRemind, { days: 7, sms: true, tg: 'WeddingCraftBot', max: 'weddingcraft_bot' });
    const o = (await call(`/api/reminders/${inv.id}`, 'GET', undefined, tok)).json;
    assert.deepEqual(o.channels, { telegram: true, max: true, sms: true });
  });

  await t.test('вебхук без верного секрета не принимается', async () => {
    assert.equal((await hook({ update_type: 'bot_started', user: { user_id: 5 } }, 'forged')).status, 403);
    assert.equal((await hook({ update_type: 'bot_started', user: { user_id: 5 } }, null)).status, 403);
    const before = max.length;
    assert.equal((await hook({ update_type: 'something_new' })).status, 200, 'незнакомое событие — просто 200');
    assert.equal(max.length, before);
  });

  await t.test('MAX до анкеты и после; старый диалог — сообщением', async () => {
    await started(7001, `r_${token('anna')}`);
    const hello = await waitFor(max, sentTo(7001), 'ответ бота');
    assert.equal(hello.auth, 'max-fixture-token', 'токен — как есть, без Bearer');
    assert.match(hello.body.text, /MAX подключён\. Вернитесь на сайт/);
    assert.equal((await reminderOf(token('anna'))).maxUserId, '7001');

    assert.equal((await rsvp({ guestName: 'Анна', remind: { token: token('anna') } })).status, 200);
    await waitFor(max, (c) => sentTo(7001)(c) && /Анкета получена! Напомним о свадьбе за неделю/.test(c.body.text), 'анкета получена');
    const anna = await reminderOf(token('anna'));
    assert.equal(anna.response.guestName, 'Анна');
    assert.equal(anna.maxUserId, '7001');

    // Диалог с ботом у гостя уже был: ссылка открыла чат без bot_started — прислал код сообщением
    assert.equal((await rsvp({ guestName: 'Борис', attendance: 'maybe', remind: { token: token('boris') } })).status, 200);
    await said(7002, `/start r_${token('boris')}`);
    await waitFor(max, (c) => sentTo(7002)(c) && /^✅ Готово! Напомним о свадьбе за неделю/.test(c.body.text), 'готово');
    assert.equal((await reminderOf(token('boris'))).maxUserId, '7002');

    // Без кода — подсказка, и не чаще раза в 10 минут
    await started(7009, null);
    await waitFor(max, (c) => sentTo(7009)(c) && /бот WeddingCraft/.test(c.body.text), 'подсказка');
    await said(7010, 'здравствуйте');
    await said(7010, 'есть кто?');
    await sleep(100);
    assert.equal(max.filter(sentTo(7010)).length, 1);
  });

  await t.test('рассылка: Telegram → MAX → SMS', async () => {
    // Вера: Telegram заблокирован, есть MAX — придёт в MAX; Глеб: MAX заблокирован, есть телефон — SMS
    assert.equal((await rsvp({ guestName: 'Вера', remind: { token: token('vera') } })).status, 200);
    await prisma.guestReminder.update({ where: { token: token('vera') }, data: { telegramChatId: '6403', maxUserId: '7003' } });
    assert.equal((await rsvp({ guestName: 'Глеб', remind: { token: token('gleb'), phone: '9123456789' } })).status, 200);
    await prisma.guestReminder.update({ where: { token: token('gleb') }, data: { maxUserId: '403403' } });

    max.length = 0;
    await R.runReminders(at(addDays(wedding, -7), 11));
    const sends = Object.fromEntries((await prisma.reminderSend.findMany({ include: { reminder: true } })).map((s) => [s.reminder.token, s]));
    assert.deepEqual([sends[token('anna')].channel, sends[token('anna')].status], ['max', 'sent']);
    assert.deepEqual([sends[token('boris')].channel, sends[token('boris')].status], ['max', 'sent']);
    assert.deepEqual([sends[token('vera')].channel, sends[token('vera')].status], ['max', 'sent'], 'Telegram отказал — ушло в MAX');
    assert.deepEqual([sends[token('gleb')].channel, sends[token('gleb')].status], ['sms', 'dry'], 'MAX отказал — SMS');
    assert.equal((await reminderOf(token('vera'))).telegramChatId, '', 'заблокированный Telegram забыт');
    assert.equal((await reminderOf(token('gleb'))).maxUserId, '', 'заблокированный MAX забыт');

    const toAnna = max.find(sentTo(7001));
    assert.equal(toAnna.query.disable_link_preview, 'true');
    assert.match(toAnna.body.text, /^Здравствуйте, Анна!\n\nНапоминаем: Денис и Мария ждут вас на свадьбе/);
    const kb = toAnna.body.attachments[0];
    assert.equal(kb.type, 'inline_keyboard');
    assert.deepEqual(kb.payload.buttons[0], [
      { type: 'callback', text: '✅ Буду', payload: `rm:y:${token('anna')}` },
      { type: 'callback', text: '❌ Не смогу', payload: `rm:n:${token('anna')}` },
    ]);
    assert.deepEqual(kb.payload.buttons[1], [{ type: 'link', text: 'Открыть приглашение', url: 'https://weddingcraft.ru/max-couple' }]);
    assert.match(max.find(sentTo(7002)).body.text, /ждут вашего ответа/, '«Пока не знаю» — просим ответить');
  });

  await t.test('кнопки в MAX: переспрос, «Не смогу», чужой пользователь', async () => {
    const original = max.find(sentTo(7002));
    const message = { body: { mid: 'mid.1', text: original.body.text, attachments: original.body.attachments } };
    max.length = 0;
    await press(7999, `rm:N:${token('boris')}`, message);
    const denied = await waitFor(max, (c) => c.path === '/answers', 'отказ чужому');
    assert.deepEqual(denied.body, { notification: 'Ответ не принят' });
    assert.equal((await reminderOf(token('boris'))).answer, '', 'чужой пользователь ничего не меняет');

    max.length = 0;
    await press(7002, `rm:n:${token('boris')}`, message);
    const ask = await waitFor(max, (c) => c.path === '/answers', 'переспрос');
    assert.equal(ask.query.callback_id.startsWith('cb-'), true);
    assert.equal(ask.body.notification, 'Точно не сможете прийти?');
    assert.equal(ask.body.message.text, original.body.text, 'текст сообщения сохраняется');
    const rows = ask.body.message.attachments[0].payload.buttons;
    assert.deepEqual(rows[0].map((b) => b.payload), [`rm:N:${token('boris')}`, `rm:y:${token('boris')}`]);
    assert.deepEqual(rows[1], [{ type: 'link', text: 'Открыть приглашение', url: 'https://weddingcraft.ru/max-couple' }], 'ссылка на сайт остаётся');
    assert.equal((await reminderOf(token('boris'))).response.attendance, 'maybe', 'одно нажатие ничего не меняет');

    max.length = 0;
    await press(7002, `rm:N:${token('boris')}`, message);
    const done = await waitFor(max, (c) => c.path === '/answers', 'итог');
    assert.equal(done.body.message.text, `${original.body.text}\n\n❌ Вы ответили: не смогу. Мы передали молодожёнам.`);
    assert.deepEqual(done.body.message.attachments[0].payload.buttons, [[{ type: 'link', text: 'Открыть приглашение', url: 'https://weddingcraft.ru/max-couple' }]]);
    const boris = await reminderOf(token('boris'));
    assert.equal(boris.answer, 'no');
    assert.equal(boris.response.attendance, 'no');

    max.length = 0;
    await press(7001, `rm:y:${token('anna')}`, { body: { text: 'Напоминание', attachments: [] } });
    const yes = await waitFor(max, (c) => c.path === '/answers', 'буду');
    assert.equal(yes.body.notification, 'Спасибо!');
    assert.deepEqual(yes.body.message, { text: 'Напоминание\n\n✅ Вы ответили: буду. Ждём вас!', attachments: [] }, 'без ссылок — клавиатура убрана');
    assert.equal((await reminderOf(token('anna'))).answer, 'yes');
  });

  await t.test('сводка и ответы: канал MAX', async () => {
    const o = (await call(`/api/reminders/${inv.id}`, 'GET', undefined, tok)).json;
    assert.deepEqual(o.stats, { total: 3, telegram: 0, max: 2, sms: 1, waiting: 0, confirmed: 1, declined: 1 });
    const list = (await call(`/api/rsvp/${inv.id}`, 'GET', undefined, tok)).json.responses;
    assert.equal(list.find((x) => x.guestName === 'Анна').reminder.channel, 'max');
    assert.ok(list.every((x) => !x.reminder || Object.keys(x.reminder).sort().join() === 'answer,answeredAt,channel,phone'), 'user_id гостя в MAX паре не отдаём');
  });

  await t.test('гость остановил бота — в MAX больше не пишем', async () => {
    await hook({ update_type: 'bot_stopped', chat_id: 7002, user: { user_id: 7001, first_name: 'Анна', is_bot: false } });
    assert.equal((await reminderOf(token('anna'))).maxUserId, '');
  });

  await t.test('подписка на вебхук при старте: лишние удаляются, своя ставится', async () => {
    process.env.BACKEND_URL = 'https://api.example.test';
    max.length = 0;
    await M.initMax();
    process.env.BACKEND_URL = '';
    assert.ok(max.some((c) => c.method === 'GET' && c.path === '/me'));
    assert.ok(max.some((c) => c.method === 'DELETE' && c.path === '/subscriptions' && c.query.url === 'https://old.example.test/hook'), 'старая подписка удалена');
    const sub = max.find((c) => c.method === 'POST' && c.path === '/subscriptions');
    assert.deepEqual(sub.body, {
      url: 'https://api.example.test/api/max/webhook',
      update_types: ['bot_started', 'bot_stopped', 'message_created', 'message_callback'],
      secret: maxWebhookSecret(),
    });
    assert.deepEqual(subscriptions, [{ url: 'https://api.example.test/api/max/webhook' }]);
  });

  await t.test('без токена MAX — анкета MAX не предлагает, вебхук закрыт', async () => {
    process.env.MAX_BOT_TOKEN = '';
    try {
      assert.equal((await call('/api/invites/by-slug/max-couple')).json.customData.wcRemind.max, '');
      assert.equal((await hook({ update_type: 'bot_started', user: { user_id: 5 } })).status, 403);
    } finally {
      process.env.MAX_BOT_TOKEN = 'max-fixture-token';
    }
  });
});
