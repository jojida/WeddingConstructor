// Отзывы пар: форма в кабинете, модерация кнопками в Telegram-чате поддержки, показ на главной
// и письмо после свадьбы. Отдельная временная база; Telegram и почта подменены — в сеть ничего не уходит.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const jwt = require('jsonwebtoken');
const express = require('express');

const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, '.test-tmp'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(root, '.test-tmp/reviews-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'reviews-suite-secret-at-least-32-characters';
process.env.DATABASE_URL = `file:${path.join(tmp, 'test.db').replace(/\\/g, '/')}`;
for (const key of ['FREE_ACCOUNTS', 'RESEND_API_KEY', 'BREVO_API_KEY', 'SMTP_USER', 'SMTP_PASS', 'TELEGRAM_WEBHOOK_SECRET']) process.env[key] = '';
process.env.TELEGRAM_BOT_TOKEN = 'local-fixture-no-network';
process.env.TELEGRAM_SUPPORT_CHAT_ID = '777000';
const SUPPORT = 777000;
const db = new DatabaseSync(path.join(tmp, 'test.db'));
for (const dir of fs.readdirSync(path.join(root, 'prisma/migrations')).sort()) {
  const file = path.join(root, 'prisma/migrations', dir, 'migration.sql');
  if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
}
db.close();

// Telegram — запись вызовов вместо сети; остальная внешняя сеть запрещена
const calls = [];
const realFetch = global.fetch;
global.fetch = async (url, options) => {
  const u = String(url);
  if (u.startsWith('https://api.telegram.org/')) {
    calls.push({ method: u.split('/').pop(), body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (!u.startsWith('http://127.0.0.1:')) throw new Error('External network disabled in reviews tests');
  return realFetch(url, options);
};

const prisma = require('../dist/lib/prisma').default;
const { telegramWebhookSecret } = require('../dist/lib/security');
const { letterFor, render, runLifecycleEmails } = require('../dist/lib/lifecycleEmails');
const app = express();
app.use(express.json());
app.use('/api/reviews', require('../dist/routes/reviews').default);
app.use('/api/telegram', require('../dist/routes/telegram').default);
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
const sent = (method, test) => (c) => c.method === method && test(c.body);

test('отзывы пар', async (t) => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (url, method = 'GET', body, token, extra = {}) => {
    const res = await realFetch(base + url, {
      method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const isJson = (res.headers.get('content-type') || '').includes('json');
    return { status: res.status, json: isJson && text ? JSON.parse(text) : null, text };
  };
  const sign = (u) => jwt.sign({ userId: u.id }, process.env.JWT_SECRET);
  const owner = await prisma.user.create({ data: { email: 'couple@example.test' } });
  const stranger = await prisma.user.create({ data: { email: 'stranger@example.test' } });
  const tok = sign(owner), other = sign(stranger);
  const mk = (data) => prisma.invitation.create({ data: { userId: owner.id, templateId: 'calla', plan: 'free', status: 'published', groomName: 'Андрей', brideName: 'Екатерина', ...data } });
  const inv = await mk({ slug: 'andrey-ekaterina' });
  const draft = await mk({ slug: 'draft-site', status: 'draft' });
  const R = (id = inv.id) => `/api/reviews/invite/${id}`;
  const press = (data, from = SUPPORT, secret = telegramWebhookSecret(), text = 'отзыв') => call('/api/telegram/webhook', 'POST', {
    update_id: 1,
    callback_query: { id: `cb-${calls.length}`, data, from: { id: from, is_bot: false }, message: { message_id: 42, chat: { id: from, type: 'private' }, text } },
  }, null, { 'X-Telegram-Bot-Api-Secret-Token': secret });
  const pub = async () => (await call('/api/reviews/public')).json.reviews;
  const status = async (invitationId = inv.id) => (await prisma.review.findUnique({ where: { invitationId } })).status;

  await t.test('форма и доступ', async () => {
    const empty = await call(R(), 'GET', undefined, tok);
    assert.deepEqual(empty.json, { review: null, canReview: true, names: 'Андрей и Екатерина' });
    assert.equal((await call(R(draft.id), 'GET', undefined, tok)).json.canReview, false);
    assert.equal((await call(R(draft.id), 'PUT', { rating: 5 }, tok)).status, 403, 'черновик — рано');
    assert.equal((await call(R(), 'PUT', { rating: 5 }, other)).status, 404, 'чужой сайт');
    assert.equal((await call(R(), 'PUT', { rating: 5 })).status, 401);
    for (const rating of [0, 6, 4.5, '5', null]) assert.equal((await call(R(), 'PUT', { rating }, tok)).status, 400, `оценка ${rating}`);
    assert.equal((await call(R(), 'PUT', { rating: 5, text: 'я'.repeat(1001) }, tok)).status, 400);
    assert.equal((await call(R(), 'PUT', { rating: 5, names: 'я'.repeat(81) }, tok)).status, 400);
    assert.equal((await call(R(), 'PUT', { rating: 5, publish: 'да' }, tok)).status, 400);
    assert.equal(calls.length, 0, 'ошибки формы владельцу не приходят');
  });

  let first;
  await t.test('новый отзыв — владельцу с кнопками, на главной пока нет', async () => {
    const r = await call(R(), 'PUT', { rating: 5, text: '  Всё прекрасно!\n\n\n\nСпасибо  ', publish: true }, tok);
    assert.equal(r.status, 200);
    assert.equal(r.json.review.names, 'Андрей и Екатерина', 'подпись по умолчанию — имена пары');
    assert.equal(r.json.review.text, 'Всё прекрасно!\n\nСпасибо');
    assert.equal(r.json.review.status, 'pending');
    first = await waitFor(sent('sendMessage', (b) => b.text.includes('Новый отзыв')), 'сообщение о новом отзыве');
    assert.equal(String(first.body.chat_id), String(SUPPORT));
    assert.match(first.body.text, /★★★★★ 5\/5/);
    assert.match(first.body.text, /\/andrey-ekaterina/);
    assert.ok(!first.body.text.includes('couple@example.test'), 'почту пары при хорошей оценке не шлём');
    const [pubBtn, hideBtn] = first.body.reply_markup.inline_keyboard[0];
    assert.match(pubBtn.callback_data, /^rv:p:[0-9a-f-]{36}:[0-9a-z]+$/);
    assert.ok(Buffer.byteLength(pubBtn.callback_data) <= 64, 'Telegram ограничивает callback_data 64 байтами');
    assert.match(hideBtn.callback_data, /^rv:h:/);
    assert.deepEqual(await pub(), []);
  });

  await t.test('кнопка работает только из чата поддержки и с верным секретом', async () => {
    const data = first.body.reply_markup.inline_keyboard[0][0].callback_data;
    assert.equal((await press(data, SUPPORT, 'forged')).status, 403);
    assert.equal((await press(data, 555)).status, 200);
    assert.equal(await status(), 'pending', 'чужой чат ничего не меняет');
    assert.equal((await press('rv:p:../../etc:1')).status, 200);
    assert.equal(await status(), 'pending');

    await press(data, SUPPORT, undefined, first.body.text);
    assert.equal(await status(), 'published');
    const edited = await waitFor(sent('editMessageText', (b) => b.text.includes('✅ Опубликован')), 'итог в сообщении');
    assert.ok(edited.body.text.startsWith(first.body.text), 'итог дописан к исходному тексту');
    assert.equal(edited.body.reply_markup, undefined, 'кнопки убраны');
    assert.deepEqual(await pub(), [{ names: 'Андрей и Екатерина', text: 'Всё прекрасно!\n\nСпасибо', rating: 5, templateId: 'calla' }]);
  });

  await t.test('правка после одобрения — снова на проверку; старая кнопка не срабатывает', async () => {
    const oldData = first.body.reply_markup.inline_keyboard[0][0].callback_data;
    await call(R(), 'PUT', { rating: 4, text: 'Хорошо, но хотелось больше шрифтов', names: 'Катя и Андрей', publish: true }, tok);
    assert.equal(await status(), 'pending');
    assert.deepEqual(await pub(), []);
    const changed = await waitFor(sent('sendMessage', (b) => b.text.includes('Отзыв изменён')), 'сообщение о правке');
    await press(oldData);
    assert.equal(await status(), 'pending', 'кнопка от прошлой версии не публикует новый текст');
    assert.ok(calls.some(sent('answerCallbackQuery', (b) => /изменили/.test(b.text))));

    await press(changed.body.reply_markup.inline_keyboard[0][0].callback_data, SUPPORT, undefined, changed.body.text);
    assert.equal(await status(), 'published');
    assert.equal((await pub())[0].names, 'Катя и Андрей');

    // Пара забрала согласие — с главной пропадает сразу, без модерации; вернула — снова видно
    const before = calls.length;
    await call(R(), 'PUT', { rating: 4, text: 'Хорошо, но хотелось больше шрифтов', names: 'Катя и Андрей', publish: false }, tok);
    assert.deepEqual(await pub(), []);
    await call(R(), 'PUT', { rating: 4, text: 'Хорошо, но хотелось больше шрифтов', names: 'Катя и Андрей', publish: true }, tok);
    assert.equal((await pub()).length, 1, 'тот же одобренный текст');
    await sleep(60);
    assert.equal(calls.slice(before).filter((c) => c.method === 'sendMessage').length, 0, 'без новых текстов владельца не дёргаем');
  });

  await t.test('низкая оценка: без кнопок, с почтой пары; опубликовать нельзя даже вручную', async () => {
    const low = await mk({ slug: 'low-site' });
    await call(R(low.id), 'PUT', { rating: 2, text: 'Не разобрались с анкетой', publish: true }, tok);
    const msg = await waitFor(sent('sendMessage', (b) => b.text.includes('Низкая оценка')), 'сообщение о низкой оценке');
    assert.ok(msg.body.text.includes('couple@example.test'), 'чтобы написать паре');
    assert.equal(msg.body.reply_markup, undefined);
    const review = await prisma.review.findUnique({ where: { invitationId: low.id } });
    await press(`rv:p:${review.id}:${review.updatedAt.getTime().toString(36)}`);
    assert.equal(await status(low.id), 'pending');
    assert.ok(calls.some(sent('answerCallbackQuery', (b) => /нельзя/.test(b.text))));
  });

  await t.test('«Скрыть» убирает с главной; удаление сайта удаляет отзыв', async () => {
    const review = await prisma.review.findUnique({ where: { invitationId: inv.id } });
    await press(`rv:h:${review.id}:${review.updatedAt.getTime().toString(36)}`);
    assert.equal(await status(), 'hidden');
    assert.deepEqual(await pub(), []);
    await prisma.invitation.delete({ where: { id: inv.id } });
    assert.equal(await prisma.review.count({ where: { id: review.id } }), 0);
  });

  await t.test('письмо после свадьбы: через 2–10 дней и только тем, кто ещё не написал отзыв', async () => {
    const DAY = 86_400_000, now = Date.now();
    const day = (offset) => new Date(now + offset * DAY).toISOString().slice(0, 10);
    const people = await Promise.all(['a', 'b', 'c'].map((s) => prisma.user.create({ data: { email: `after-${s}@example.test` } })));
    const site = (user, slug, weddingDate) => prisma.invitation.create({ data: { userId: user.id, slug, templateId: 'calla', plan: 'premium', status: 'paid', weddingDate } });
    const fresh = await site(people[0], 'after-fresh', day(-3));
    const reviewed = await site(people[1], 'after-reviewed', day(-3));
    const old = await site(people[2], 'after-old', day(-20));
    await prisma.review.create({ data: { invitationId: reviewed.id, userId: people[1].id, rating: 5, names: 'Пара' } });
    await runLifecycleEmails(now);
    const kinds = async (invitationId) => (await prisma.emailEvent.findMany({ where: { invitationId } })).map((e) => e.kind);
    assert.deepEqual(await kinds(fresh.id), ['after_wedding']);
    assert.deepEqual(await kinds(reviewed.id), []);
    assert.deepEqual(await kinds(old.id), []);

    const letter = letterFor('after_wedding', { ...fresh, groomName: 'Иван', brideName: 'Мария', venue: '', venueAddress: '' });
    assert.equal(letter.subject, 'Как прошла свадьба?');
    assert.equal(letter.title, 'Иван и Мария, поздравляем!');
    assert.equal(letter.url, 'https://yandex.ru/profile/162112565078', 'главная кнопка — отзыв в Яндексе');
    assert.match(letter.secondary.url, new RegExp(`/dashboard/${fresh.id}\\?review=1&utm_source=email`));
    assert.ok(!/скидк|бонус|₽/.test(letter.paragraphs.join(' ')), 'просьба об отзыве — без рекламы');
    const { text, html } = render(letter, fresh.userId);
    assert.ok(text.includes(`${letter.secondary.label}: ${letter.secondary.url}`), 'в текстовой версии обе ссылки');
    assert.ok(html.includes(`/dashboard/${fresh.id}?review=1&amp;utm_source=email`), 'в HTML ссылка на кабинет под кнопкой');
  });
});
