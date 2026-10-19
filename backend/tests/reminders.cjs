// Напоминание гостям перед свадьбой: галочка в анкете → Telegram или SMS за N дней →
// ответ кнопкой или на страничке /c/<token>. Отдельная временная база; Telegram подменён,
// SMS — в пробном режиме (NODE_ENV=test), в сеть ничего не уходит.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const jwt = require('jsonwebtoken');

const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, '.test-tmp'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(root, '.test-tmp/reminders-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'reminders-suite-secret-at-least-32-characters';
process.env.DATABASE_URL = `file:${path.join(tmp, 'test.db').replace(/\\/g, '/')}`;
for (const key of ['FREE_ACCOUNTS', 'BREVO_API_KEY', 'SMTP_USER', 'SMTP_PASS', 'TELEGRAM_WEBHOOK_SECRET', 'SMSAERO_EMAIL', 'SMSAERO_API_KEY', 'SMS_DRY_RUN', 'REMINDER_SMS_LIMIT', 'PLANNER_PUBLIC']) process.env[key] = '';
process.env.TELEGRAM_BOT_TOKEN = 'local-fixture-no-network';
process.env.TELEGRAM_BOT_USERNAME = 'WeddingCraftBot';
process.env.FRONTEND_URL = 'https://weddingcraft.ru';
const db = new DatabaseSync(path.join(tmp, 'test.db'));
for (const dir of fs.readdirSync(path.join(root, 'prisma/migrations')).sort()) {
  const file = path.join(root, 'prisma/migrations', dir, 'migration.sql');
  if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
}
db.close();

// Telegram — запись вызовов вместо сети; остальная внешняя сеть запрещена
const calls = [];
let tgFail = null;   // (body) => ответ-ошибка Telegram для этого вызова
const realFetch = global.fetch;
global.fetch = async (url, options) => {
  const u = String(url);
  if (u.startsWith('https://api.telegram.org/')) {
    const body = JSON.parse(options.body);
    calls.push({ method: u.split('/').pop(), body });
    const fail = tgFail && tgFail(body);
    return new Response(JSON.stringify(fail || { ok: true, result: { message_id: 42 } }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (!u.startsWith('http://127.0.0.1:')) throw new Error('External network disabled in reminders tests');
  return realFetch(url, options);
};

const prisma = require('../dist/lib/prisma').default;
const app = require('../dist/index').default;
const R = require('../dist/lib/reminders');
const { telegramWebhookSecret } = require('../dist/lib/security');
let server;
after(async () => {
  global.fetch = realFetch;
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect();
  fs.rmSync(tmp, { recursive: true });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(pred, what) {
  for (let i = 0; i < 100; i++) { const hit = calls.find(pred); if (hit) return hit; await sleep(20); }
  throw new Error(`не дождались: ${what}`);
}
const DAY = 864e5;
const mskToday = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
/** Момент «date, hour:00 по Москве». */
const at = (date, hour) => Date.parse(`${date}T00:00:00Z`) + (hour - 3) * 3600e3;
const token = (s) => s.padEnd(10, 'x').slice(0, 10);

test('чистые функции', () => {
  for (const raw of ['+7 (912) 345-67-89', '8 912 345 67 89', '9123456789', '79123456789']) assert.equal(R.normalizePhone(raw), '79123456789', raw);
  for (const raw of ['+7 495 123-45-67', '12345', '7912345678', 'позвоните мне', '+1 912 345 67 89', 7912345678]) assert.equal(R.normalizePhone(raw), null, String(raw));
  assert.equal(R.formatPhone('79123456789'), '+7 912 345-67-89');

  assert.equal(R.dueKind([7], 10), null);
  assert.equal(R.dueKind([7], 7), 7);
  assert.equal(R.dueKind([7], 5), 7, 'включили поздно — всё равно разошлём');
  assert.equal(R.dueKind([7], 0), null, 'в день свадьбы не пишем');
  assert.equal(R.dueKind([7, 1], 2), 7);
  assert.equal(R.dueKind([7, 1], 1), 1);
  assert.equal(R.dueKind([3], 4), null);

  const inv = { slug: 'denis-maria', groomName: 'Денис', brideName: 'Мария', weddingDate: '2027-06-12', weddingTime: '15:00', venue: 'Усадьба', venueAddress: 'Москва' };
  const sms = R.smsText(inv, 7, 'yes', 'Ab3dE7xK2q');
  assert.equal(sms, 'Денис и Мария ждут вас 12.06. Придёте? weddingcraft.ru/c/Ab3dE7xK2q');
  assert.ok([...sms].length <= 70, 'одна SMS');
  assert.ok([...R.smsText(inv, 7, 'maybe', 'Ab3dE7xK2q')].length <= 70);
  assert.ok([...R.smsText(inv, 1, 'yes', 'Ab3dE7xK2q')].length <= 70);
  const long = R.smsText({ ...inv, groomName: 'Александр-Константин', brideName: 'Анастасия-Василиса' }, 7, 'yes', 'Ab3dE7xK2q');
  assert.equal(long, 'Свадьба 12.06: вы придёте? weddingcraft.ru/c/Ab3dE7xK2q', 'длинные имена — без имён, но в одну SMS');

  const tg = R.telegramMessage(inv, 7, 'yes', 'Ab3dE7xK2q', 'Анна');
  assert.match(tg.text, /^Здравствуйте, Анна!/);
  assert.match(tg.text, /12 июня, в субботу, в 15:00/);
  assert.match(tg.text, /📍 Усадьба, Москва/);
  assert.deepEqual(tg.buttons[0].map((b) => b.callback_data), ['rm:y:Ab3dE7xK2q', 'rm:n:Ab3dE7xK2q']);
  assert.equal(tg.buttons[1][0].url, 'https://weddingcraft.ru/denis-maria');
  for (const row of tg.buttons) for (const b of row) if (b.callback_data) assert.ok(Buffer.byteLength(b.callback_data) <= 64);

  // Не ответившим — один раз, в первый срок, и пока есть время ответить
  assert.equal(R.noReplyKind([7], 8), null);
  assert.equal(R.noReplyKind([7], 7), 7);
  assert.equal(R.noReplyKind([7], 2), 7, 'включили поздно — всё равно разошлём');
  assert.equal(R.noReplyKind([7], 1), null, 'накануне ответить уже некогда');
  assert.equal(R.noReplyKind([7, 1], 3), 7);
  assert.equal(R.noReplyKind([7, 1], 1), null, '«7,1» — только за неделю');
  assert.equal(R.noReplyKind([3], 3), 3);
  assert.equal(R.answerBy('2027-06-12', at('2027-06-05', 11)), '2027-06-08');
  assert.equal(R.answerBy('2027-06-12', at('2027-06-10', 11)), '2027-06-11', 'не позже, чем накануне');
  const ask = R.noReplySms(inv, '2027-06-08', 'Ab3dE7xK2qLm9PzR4tWy8u');
  assert.equal(ask, 'Денис и Мария ждут вашего ответа до 08.06: weddingcraft.ru/denis-maria?g=Ab3dE7xK2qLm9PzR4tWy8u');
  assert.ok([...ask].length <= 134, 'не больше двух частей');
  const longAsk = R.noReplySms({ ...inv, groomName: 'А'.repeat(40), brideName: 'Б'.repeat(40) }, '2027-06-08', 'Ab3dE7xK2qLm9PzR4tWy8u');
  assert.equal(longAsk, 'Пожалуйста, ответьте на свадебное приглашение до 08.06: weddingcraft.ru/denis-maria?g=Ab3dE7xK2qLm9PzR4tWy8u');
  assert.doesNotMatch(ask + longAsk, /weddingcraft(?!\.ru\/)|скидк|тариф|акци/i, 'без рекламы');
});

test('напоминания гостям', async (t) => {
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
  const hook = (update) => call('/api/telegram/webhook', 'POST', { update_id: 1, ...update }, null, { 'X-Telegram-Bot-Api-Secret-Token': telegramWebhookSecret() });
  const start = (chat, text) => hook({ message: { message_id: 1, text, chat: { id: chat, type: 'private' }, from: { id: chat, is_bot: false } } });
  const press = (chat, data, text = 'напоминание', markup) => hook({
    callback_query: { id: `cb-${calls.length}`, data, from: { id: chat, is_bot: false }, message: { message_id: 77, chat: { id: chat, type: 'private' }, text, reply_markup: markup } },
  });

  const owner = await prisma.user.create({ data: { email: 'couple@example.test' } });
  const stranger = await prisma.user.create({ data: { email: 'stranger@example.test' } });
  const tok = jwt.sign({ userId: owner.id }, process.env.JWT_SECRET);
  const other = jwt.sign({ userId: stranger.id }, process.env.JWT_SECRET);
  const wedding = addDays(mskToday, 10);
  const inv = await prisma.invitation.create({ data: {
    userId: owner.id, slug: 'denis-maria', templateId: 'calla', status: 'published', plan: 'maximum',
    groomName: 'Денис', brideName: 'Мария', weddingDate: wedding, weddingTime: '15:00', venue: 'Усадьба', venueAddress: 'Москва',
    notifyChannel: 'telegram', notifyTelegramChatId: '9000',
  } });
  const premium = await prisma.invitation.create({ data: { userId: owner.id, slug: 'premium-site', templateId: 'calla', status: 'published', plan: 'premium', weddingDate: wedding } });
  const rsvp = (body) => call('/api/rsvp/denis-maria', 'POST', { attendance: 'yes', guestsCount: 2, ...body });
  const reminderOf = (t) => prisma.guestReminder.findUnique({ where: { token: t }, include: { response: true } });

  await t.test('включает только владелец «Максимума»', async () => {
    assert.equal((await call(`/api/reminders/${premium.id}`, 'PUT', { enabled: true, days: '7' }, tok)).status, 403);
    assert.equal((await call(`/api/reminders/${inv.id}`, 'PUT', { enabled: true, days: '7' }, other)).status, 404);
    assert.equal((await call(`/api/reminders/${inv.id}`, 'PUT', { enabled: true, days: '5' }, tok)).status, 400);
    assert.equal((await call('/api/invites/by-slug/denis-maria')).json.customData.wcRemind, undefined, 'выключено — галочки нет');
    const r = await call(`/api/reminders/${inv.id}`, 'PUT', { enabled: true, days: '7' }, tok);
    assert.equal(r.status, 200);
    assert.equal(r.json.enabled, true);
    assert.deepEqual(r.json.schedule, [{ kind: 7, date: addDays(wedding, -7), sent: 0 }]);
    assert.match(r.json.preview.sms, /^Денис и Мария ждут вас/);
    assert.deepEqual((await call('/api/invites/by-slug/denis-maria')).json.customData.wcRemind, { days: 7, sms: true, tg: 'WeddingCraftBot', max: '' });
    assert.equal((await call('/api/invites/by-slug/premium-site')).json.customData.wcRemind, undefined);
  });

  await t.test('анкета с телефоном; отказ и снятая галочка телефон не хранят', async () => {
    assert.equal((await rsvp({ guestName: 'Анна', remind: { token: token('anna'), phone: '8 (912) 345-67-89' } })).status, 200);
    const anna = await reminderOf(token('anna'));
    assert.equal(anna.phone, '79123456789');
    assert.equal(anna.invitationId, inv.id);
    assert.equal(anna.response.guestName, 'Анна');
    const note = await waitFor((c) => c.method === 'sendMessage' && c.body.chat_id === '9000' && c.body.text.includes('Анна'), 'уведомление паре');
    assert.match(note.body.text, /Напомнить о свадьбе — по SMS, \+7 912 345-67-89/);

    assert.equal((await rsvp({ guestName: 'Олег', attendance: 'no', remind: { token: token('oleg'), phone: '9123456780' } })).status, 200);
    assert.equal(await reminderOf(token('oleg')), null, 'отказался — напоминать незачем');
    assert.equal((await rsvp({ guestName: 'Ира', remind: false })).status, 200);
    assert.equal((await rsvp({ guestName: 'Кривой', remind: { token: '../../x', phone: 'abc' } })).status, 200, 'испорченное поле ответ не ломает');
    assert.equal(await prisma.guestReminder.count(), 1);
  });

  await t.test('Telegram до анкеты и после', async () => {
    calls.length = 0;
    await start(5001, `/start r_${token('boris')}`);
    const waiting = await waitFor((c) => c.method === 'sendMessage' && c.body.chat_id === 5001, 'ответ бота');
    assert.match(waiting.body.text, /отправьте анкету/);
    assert.equal(waiting.body.reply_markup, undefined, 'гостю — без меню сервиса');
    assert.equal((await reminderOf(token('boris'))).responseId, null);

    assert.equal((await rsvp({ guestName: 'Борис', attendance: 'maybe', remind: { token: token('boris'), phone: '' } })).status, 200);
    const got = await waitFor((c) => c.method === 'sendMessage' && c.body.chat_id === '5001', 'анкета получена');
    assert.match(got.body.text, new RegExp(`Анкета получена! Напомним о свадьбе за неделю — \\d+ \\S+\\. Денис и Мария ждут вас!`));
    const boris = await reminderOf(token('boris'));
    assert.equal(boris.telegramChatId, '5001');
    assert.equal(boris.response.guestName, 'Борис');

    // Сначала анкета, потом Telegram
    assert.equal((await rsvp({ guestName: 'Вера', remind: { token: token('vera') } })).status, 200);
    await start(5002, `/start r_${token('vera')}`);
    const ready = await waitFor((c) => c.method === 'sendMessage' && c.body.chat_id === 5002, 'готово');
    assert.match(ready.body.text, /^✅ Готово! Напомним о свадьбе за неделю/);
    assert.equal((await reminderOf(token('vera'))).telegramChatId, '5002');
  });

  await t.test('персональная ссылка: повторная анкета сохраняет Telegram, снятая галочка — удаляет', async () => {
    const guest = await prisma.guest.create({ data: { invitationId: inv.id, token: 'guest-token-1', names: 'Галина' } });
    assert.equal((await rsvp({ guestToken: guest.token, remind: { token: token('gal1') } })).status, 200);
    await start(5003, `/start r_${token('gal1')}`);
    await waitFor((c) => c.method === 'sendMessage' && c.body.chat_id === 5003, 'готово');
    // Старая страница шаблона (без поля remind): напоминание переезжает на новый ответ
    assert.equal((await rsvp({ guestToken: guest.token, guestsCount: 3 })).status, 200);
    const moved = await reminderOf(token('gal1'));
    assert.equal(moved.telegramChatId, '5003');
    assert.equal(moved.response.guestsCount, 3);
    // Новая страница — новый токен, Telegram остаётся
    assert.equal((await rsvp({ guestToken: guest.token, remind: { token: token('gal2') } })).status, 200);
    assert.equal(await reminderOf(token('gal1')), null);
    assert.equal((await reminderOf(token('gal2'))).telegramChatId, '5003');
    assert.equal((await rsvp({ guestToken: guest.token, remind: false })).status, 200);
    assert.equal(await prisma.guestReminder.count({ where: { telegramChatId: '5003' } }), 0);
  });

  await t.test('рассылка за неделю: Telegram с кнопками, SMS — в пробном режиме, без повторов', async () => {
    calls.length = 0;
    const day = addDays(wedding, -7);
    await R.runReminders(at(day, 8));
    assert.equal(await prisma.reminderSend.count(), 0, 'в 8 утра по Москве рано');
    await R.runReminders(at(addDays(wedding, -8), 11));
    assert.equal(await prisma.reminderSend.count(), 0, 'за 8 дней — рано');

    await R.runReminders(at(day, 11));
    const sends = await prisma.reminderSend.findMany({ include: { reminder: true } });
    const by = Object.fromEntries(sends.map((s) => [s.reminder.token, s]));
    assert.deepEqual(Object.keys(by).sort(), [token('anna'), token('boris'), token('vera')].sort());
    assert.equal(by[token('anna')].channel, 'sms');
    assert.equal(by[token('anna')].status, 'dry');
    assert.equal(by[token('vera')].channel, 'telegram');
    assert.equal(by[token('vera')].status, 'sent');

    const toVera = calls.find((c) => c.method === 'sendMessage' && c.body.chat_id === '5002');
    assert.match(toVera.body.text, /^Здравствуйте, Вера!\n\nНапоминаем: Денис и Мария ждут вас на свадьбе/);
    assert.deepEqual(toVera.body.reply_markup.inline_keyboard[0].map((b) => b.text), ['✅ Буду', '❌ Не смогу']);
    const toBoris = calls.find((c) => c.method === 'sendMessage' && c.body.chat_id === '5001');
    assert.match(toBoris.body.text, /ждут вашего ответа/, '«Пока не знаю» — просим ответить');
    const summary = await waitFor((c) => c.method === 'sendMessage' && c.body.chat_id === '9000' && /Напоминание о свадьбе отправлено 3 гостям/.test(c.body.text), 'сводка паре');
    assert.match(summary.body.text, /в Telegram — 2, по SMS — 1/);

    const n = calls.length;
    await R.runReminders(at(day, 13));
    await R.runReminders(at(addDays(wedding, -6), 11));
    assert.equal(await prisma.reminderSend.count(), 3, 'второй проход ничего не шлёт');
    assert.equal(calls.length, n);
  });

  await t.test('кнопки в Telegram: «Буду», «Не смогу» с переспросом, чужой чат не может', async () => {
    calls.length = 0;
    const markup = { inline_keyboard: [[{ text: '✅ Буду', callback_data: `rm:y:${token('vera')}` }], [{ text: 'Открыть приглашение', url: 'https://weddingcraft.ru/denis-maria' }]] };
    await press(5999, `rm:N:${token('vera')}`);
    assert.equal((await reminderOf(token('vera'))).answer, '', 'чужой чат');

    await press(5002, `rm:y:${token('vera')}`, 'Напоминаем…', markup);
    const yes = await waitFor((c) => c.method === 'editMessageText', 'итог в сообщении');
    assert.equal(yes.body.text, 'Напоминаем…\n\n✅ Вы ответили: буду. Ждём вас!');
    assert.deepEqual(yes.body.reply_markup.inline_keyboard, [[{ text: 'Открыть приглашение', url: 'https://weddingcraft.ru/denis-maria' }]], 'ссылка на сайт остаётся');
    assert.equal((await reminderOf(token('vera'))).answer, 'yes');

    calls.length = 0;
    await press(5001, `rm:n:${token('boris')}`);
    const ask = await waitFor((c) => c.method === 'editMessageReplyMarkup', 'переспрос');
    assert.deepEqual(ask.body.reply_markup.inline_keyboard[0].map((b) => b.callback_data), [`rm:N:${token('boris')}`, `rm:y:${token('boris')}`]);
    assert.equal((await reminderOf(token('boris'))).response.attendance, 'maybe', 'одно нажатие ничего не меняет');
    await press(5001, `rm:N:${token('boris')}`);
    const boris = await reminderOf(token('boris'));
    assert.equal(boris.answer, 'no');
    assert.equal(boris.response.attendance, 'no');
    assert.equal(boris.response.attending, false);
    await waitFor((c) => c.method === 'sendMessage' && c.body.chat_id === '9000' && c.body.text.includes('❌ Борис: планы изменились — не придёт (было 2 человека)'), 'паре об отказе');
  });

  await t.test('страничка /c/: подтверждение с числом гостей', async () => {
    assert.equal((await call('/api/reminders/c/../../x')).status, 404);
    assert.equal((await call(`/api/reminders/c/${token('nobody')}`)).status, 404);
    const page = await call(`/api/reminders/c/${token('anna')}`);
    assert.equal(page.status, 200);
    assert.equal(page.json.guestName, 'Анна');
    assert.equal(page.json.weddingDate, wedding);
    assert.equal(page.json.attendance, 'yes');
    assert.equal(page.json.guestsCount, 2);
    assert.equal(page.json.siteUrl, 'https://weddingcraft.ru/denis-maria');
    assert.equal(page.json.phone, undefined, 'телефон на страничку не отдаём');

    assert.equal((await call(`/api/reminders/c/${token('anna')}`, 'POST', { answer: 'maybe' })).status, 400);
    assert.equal((await call(`/api/reminders/c/${token('anna')}`, 'POST', { answer: 'yes', guestsCount: 0 })).status, 400);
    calls.length = 0;
    const r = await call(`/api/reminders/c/${token('anna')}`, 'POST', { answer: 'yes', guestsCount: 3 });
    assert.deepEqual(r.json, { ok: true, attendance: 'yes', guestsCount: 3 });
    assert.equal((await reminderOf(token('anna'))).response.guestsCount, 3);
    await waitFor((c) => c.method === 'sendMessage' && c.body.chat_id === '9000' && c.body.text.includes('✅ Анна: придут 3 человека (было 2 человека)'), 'паре о числе');
  });

  await t.test('сводка в кабинете и ответы с напоминанием', async () => {
    const o = (await call(`/api/reminders/${inv.id}`, 'GET', undefined, tok)).json;
    assert.deepEqual(o.stats, { total: 2, telegram: 1, max: 0, sms: 1, waiting: 0, confirmed: 2, declined: 1 });
    assert.deepEqual(o.schedule, [{ kind: 7, date: addDays(wedding, -7), sent: 3 }]);
    assert.deepEqual(o.sms, { limit: 150, spent: 1 });
    const list = (await call(`/api/rsvp/${inv.id}`, 'GET', undefined, tok)).json.responses;
    const anna = list.find((x) => x.guestName === 'Анна');
    assert.deepEqual({ ...anna.reminder, answeredAt: undefined }, { channel: 'sms', phone: '+7 912 345-67-89', answer: 'yes', answeredAt: undefined });
    assert.equal(list.find((x) => x.guestName === 'Вера').reminder.channel, 'telegram');
    assert.ok(list.every((x) => !x.reminder || Object.keys(x.reminder).sort().join() === 'answer,answeredAt,channel,phone'), 'chat id гостя паре не отдаём');
    assert.equal(list.find((x) => x.guestName === 'Ира').reminder, null);
  });

  await t.test('лимит SMS и заблокированный бот', async () => {
    await prisma.reminderSettings.update({ where: { invitationId: inv.id }, data: { days: '7,1' } });
    // Вера остановила бота — за день до свадьбы пишем по SMS, если есть телефон
    await prisma.guestReminder.update({ where: { token: token('vera') }, data: { phone: '79001112233' } });
    tgFail = (body) => (body.chat_id === '5002' ? { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' } : null);
    process.env.REMINDER_SMS_LIMIT = '1';
    await R.runReminders(at(addDays(wedding, -1), 10));
    tgFail = null;
    delete process.env.REMINDER_SMS_LIMIT;
    const d1 = await prisma.reminderSend.findMany({ where: { kind: 'd1' }, include: { reminder: true } });
    const by = Object.fromEntries(d1.map((s) => [s.reminder.token, s]));
    assert.equal(by[token('boris')], undefined, 'отказавшимся не пишем');
    assert.equal(by[token('vera')].channel, 'sms');
    assert.equal(by[token('anna')].channel, 'sms');
    assert.deepEqual([by[token('vera')].status, by[token('anna')].status].sort(), ['limit', 'limit'], 'лимит 1 уже потрачен за неделю');
    assert.equal((await reminderOf(token('vera'))).telegramChatId, '', 'заблокированный чат забыт');
  });

  await t.test('выключили — анкета не спрашивает, рассылки нет', async () => {
    await call(`/api/reminders/${inv.id}`, 'PUT', { enabled: false, days: '7' }, tok);
    assert.equal((await call('/api/invites/by-slug/denis-maria')).json.customData.wcRemind, undefined);
    assert.equal((await rsvp({ guestName: 'Поздний', remind: { token: token('late'), phone: '9123456781' } })).status, 200);
    assert.equal(await reminderOf(token('late')), null);
  });

  await t.test('брошенный Telegram без анкеты забывается через трое суток', async () => {
    await prisma.guestReminder.create({ data: { token: token('stale'), telegramChatId: '6000', createdAt: new Date(Date.now() - 4 * DAY) } });
    await R.runReminders(Date.now());
    assert.equal(await reminderOf(token('stale')), null);
  });

  await t.test('не ответившим: телефон во вкладке «Гости» → SMS со ссылкой на личное приглашение', async () => {
    const wedding2 = addDays(mskToday, 20);
    const day = addDays(wedding2, -7);
    const inv2 = await prisma.invitation.create({ data: {
      userId: owner.id, slug: 'oleg-olga', templateId: 'calla', status: 'published', plan: 'maximum',
      groomName: 'Олег', brideName: 'Ольга', weddingDate: wedding2, weddingTime: '16:00',
      notifyChannel: 'telegram', notifyTelegramChatId: '9100',
    } });
    const addGuest = async (body) => (await call(`/api/guests/${inv2.id}`, 'POST', body, tok)).json;
    const sendsOf2 = () => prisma.reminderSend.findMany({ where: { invitationId: inv2.id }, include: { reminder: true } });

    // Телефон: российский мобильный, только «Максимум», только владелец
    assert.equal((await call(`/api/guests/${inv2.id}`, 'POST', { names: 'Кривой', phone: '+7 495 123-45-67' }, tok)).status, 400);
    assert.equal((await call(`/api/guests/${premium.id}`, 'POST', { names: 'Гость', phone: '9120001122' }, tok)).status, 403);
    const petr = await addGuest({ names: 'Пётр', phone: '8 912 000-11-22' });
    assert.equal(petr.phone, '+7 912 000-11-22');
    const sveta = await addGuest({ names: 'Света' });
    assert.equal(sveta.phone, '');
    assert.equal((await call(`/api/guests/${sveta.id}`, 'PUT', { phone: '9120003344' }, other)).status, 404);
    assert.equal((await call(`/api/guests/${sveta.id}`, 'PUT', { phone: 'позвоните' }, tok)).status, 400);
    const put = await call(`/api/guests/${sveta.id}`, 'PUT', { phone: '+7 (912) 000-33-44' }, tok);
    assert.equal(put.status, 200);
    assert.equal(put.json.phone, '+7 912 000-33-44');
    assert.equal(put.json.names, 'Света', 'имя не тронуто');
    const timur = await addGuest({ names: 'Тимур', phone: '9120005566' });
    await addGuest({ names: 'Без телефона' });
    const list = (await call(`/api/guests/${inv2.id}`, 'GET', undefined, tok)).json;
    assert.equal(list.phones, true);
    assert.deepEqual(list.guests.map((g) => [g.names, g.phone]), [['Пётр', '+7 912 000-11-22'], ['Света', '+7 912 000-33-44'], ['Тимур', '+7 912 000-55-66'], ['Без телефона', '']]);
    assert.equal((await call(`/api/guests/${premium.id}`, 'GET', undefined, tok)).json.phones, false, '«Премиум» — без поля');

    // Тимур ответил по своей ссылке — ему не пишем
    assert.equal((await call('/api/rsvp/oleg-olga', 'POST', { attendance: 'yes', guestsCount: 1, guestToken: timur.token })).status, 200);

    // Флажок есть, а напоминания выключены — тишина; без поля noReply флажок не сбрасывается
    assert.equal((await call(`/api/reminders/${inv2.id}`, 'PUT', { enabled: true, days: '7', noReply: 'yes' }, tok)).status, 400);
    assert.equal((await call(`/api/reminders/${inv2.id}`, 'PUT', { enabled: false, days: '7', noReply: true }, tok)).json.noReply, true);
    await R.runReminders(at(day, 11));
    assert.equal((await sendsOf2()).length, 0, 'напоминания выключены');
    const on = (await call(`/api/reminders/${inv2.id}`, 'PUT', { enabled: true, days: '7,1' }, tok)).json;
    assert.equal(on.noReply, true);
    assert.deepEqual(on.unanswered, { kind: 7, date: day, guests: 3, withPhone: 2, sent: 0 });
    assert.match(on.preview.noReply, /^Олег и Ольга ждут вашего ответа до \d\d\.\d\d: weddingcraft\.ru\/oleg-olga\?g=/);

    // Добавлен уже в срок напоминания — приглашение ему только что отправили, не пишем
    const late = await addGuest({ names: 'Поздний', phone: '9120007788' });
    await prisma.guest.update({ where: { id: late.id }, data: { createdAt: new Date(at(day, 9)) } });

    await R.runReminders(at(addDays(wedding2, -8), 11));
    assert.equal((await sendsOf2()).length, 0, 'за 8 дней — рано');

    calls.length = 0;
    const logs = [];
    const log = console.log;
    console.log = (...a) => { logs.push(a.join(' ')); };
    try { await R.runReminders(at(day, 11)); } finally { console.log = log; }
    const sends = await sendsOf2();
    assert.deepEqual(sends.map((s) => [s.reminder.guestId, s.kind, s.channel, s.status]).sort(),
      [[petr.id, 'n7', 'sms', 'dry'], [sveta.id, 'n7', 'sms', 'dry']].sort());
    const by = addDays(day, 3);
    const sms = logs.filter((l) => l.includes('[SMS, пробный режим]'));
    assert.equal(sms.length, 2);
    assert.ok(sms.some((l) => l.endsWith(`: Олег и Ольга ждут вашего ответа до ${by.slice(8, 10)}.${by.slice(5, 7)}: weddingcraft.ru/oleg-olga?g=${petr.token}`)), sms.join('\n'));
    const summary = await waitFor((c) => c.method === 'sendMessage' && c.body.chat_id === '9100', 'сводка паре');
    assert.match(summary.body.text, /SMS со ссылкой на приглашение отправлено 2 гостям, которые ещё не ответили на анкету/);

    // Повторный проход и «накануне» — больше ничего
    await R.runReminders(at(day, 13));
    await R.runReminders(at(addDays(wedding2, -1), 11));
    assert.equal((await sendsOf2()).length, 2);
    const o = (await call(`/api/reminders/${inv2.id}`, 'GET', undefined, tok)).json;
    assert.equal(o.unanswered.sent, 2);
    assert.equal(o.sms.spent, 2, 'лимит SMS общий с обычными напоминаниями');

    // Стёртый и вписанный заново номер то же SMS второй раз не получает
    assert.equal((await call(`/api/guests/${sveta.id}`, 'PUT', { phone: '' }, tok)).json.phone, '');
    assert.equal((await prisma.guestReminder.findFirst({ where: { guestId: sveta.id } })).phone, '', 'номер стёрт');
    await call(`/api/guests/${sveta.id}`, 'PUT', { phone: '9120009900' }, tok);
    await R.runReminders(at(addDays(day, 1), 11));
    assert.equal((await sendsOf2()).length, 2);

    // Света ответила и сама попросила напомнить — это её отдельная строка, телефон от пары на месте
    assert.equal((await call('/api/rsvp/oleg-olga', 'POST', { attendance: 'yes', guestsCount: 1, guestToken: sveta.token, remind: { token: token('sveta') } })).status, 200);
    assert.equal((await reminderOf(token('sveta'))).response.guestId, sveta.id);
    assert.equal((await prisma.guestReminder.findFirst({ where: { guestId: sveta.id } })).phone, '79120009900');

    // Лимит SMS исчерпан — отметка «limit», SMS не уходит
    const lim = await addGuest({ names: 'Лимит', phone: '9120001010' });
    await prisma.guest.update({ where: { id: lim.id }, data: { createdAt: new Date(at(addDays(day, -1), 12)) } });
    process.env.REMINDER_SMS_LIMIT = '2';
    await R.runReminders(at(addDays(day, 1), 12));
    delete process.env.REMINDER_SMS_LIMIT;
    assert.equal((await prisma.reminderSend.findFirst({ where: { reminder: { guestId: lim.id } } })).status, 'limit');

    // Телефон от пары не «брошенная» строка — через трое суток не стирается; удалили гостя — удалён
    await prisma.guestReminder.updateMany({ where: { guestId: petr.id }, data: { createdAt: new Date(Date.now() - 5 * DAY) } });
    await R.runReminders(Date.now());
    assert.ok(await prisma.guestReminder.findFirst({ where: { guestId: petr.id } }));
    assert.equal((await call(`/api/guests/${petr.id}`, 'DELETE', undefined, tok)).status, 200);
    assert.equal(await prisma.guestReminder.count({ where: { guestId: petr.id } }), 0);
  });
});
