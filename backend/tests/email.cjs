const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

// Модуль читает отправителя при загрузке — окружение задаём до require
process.env.BREVO_API_KEY = 'brevo-test-key';
process.env.RESEND_API_KEY = '';
process.env.MAIL_FROM = 'noreply@weddingcraft.ru';
delete process.env.RUSENDER_FROM;
const { sendEmail } = require('../dist/lib/email');

const BREVO = 'https://api.brevo.com/v3/smtp/email';
const RUSENDER = 'https://api.rusender.ru/api/v1/external-mails/send/42';
const realFetch = global.fetch;
let calls = [];
let rusenderStatus = 200;
global.fetch = async (url, init) => {
  calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
  return new Response('{}', { status: String(url).includes('rusender') ? rusenderStatus : 201 });
};
after(() => { global.fetch = realFetch; });
beforeEach(() => {
  calls = [];
  rusenderStatus = 200;
  process.env.RUSENDER_API_KEY = 'rs_ck_v1_test';
  process.env.RUSENDER_KEY_ID = '42';
});

test('код входа на Яндекс и Mail.ru уходит через RuSender', async () => {
  for (const to of ['anna@yandex.ru', 'anna@mail.ru', 'Anna@BK.ru', 'anna@list.ru']) {
    calls = [];
    await sendEmail({ to, subject: 'Код для входа', text: 'Ваш код: 123456', critical: true });
    assert.equal(calls.length, 1, to);
    assert.equal(calls[0].url, RUSENDER);
    assert.equal(calls[0].headers.Authorization, 'Bearer rs_ck_v1_test');
    assert.equal(calls[0].body.mail.to.email, to);
    assert.equal(calls[0].body.mail.from.email, 'noreply@weddingcraft.ru');
    assert.equal(calls[0].body.mail.text, 'Ваш код: 123456');
    assert.ok(calls[0].body.idempotencyKey);
  }
});

test('Gmail, письма серии и ненастроенный RuSender — как раньше, через Brevo', async () => {
  await sendEmail({ to: 'anna@gmail.com', subject: 'Код', text: '1', critical: true });
  await sendEmail({ to: 'anna@yandex.ru', subject: 'Письмо серии', text: '2' });
  delete process.env.RUSENDER_KEY_ID;
  await sendEmail({ to: 'anna@mail.ru', subject: 'Код', text: '3', critical: true });
  assert.deepEqual(calls.map(c => c.url), [BREVO, BREVO, BREVO]);
});

test('личное письмо владельца: отправитель support@, ответ туда же; Яндекс — через RuSender', async () => {
  const from = { email: 'support@weddingcraft.ru', name: 'Анна из WeddingCraft' };
  await sendEmail({ to: 'pair@yandex.ru', subject: 'Как вам приглашение?', text: 'Здравствуйте!', from, replyTo: from.email, critical: true });
  assert.equal(calls[0].url, RUSENDER);
  assert.deepEqual(calls[0].body.mail.from, from);
  calls = [];
  await sendEmail({ to: 'pair@gmail.com', subject: 'Как вам приглашение?', text: 'Здравствуйте!', from, replyTo: from.email, critical: true });
  assert.equal(calls[0].url, BREVO);
  assert.deepEqual(calls[0].body.sender, from);
  assert.deepEqual(calls[0].body.replyTo, { email: from.email });
  // Без from — прежний отправитель
  calls = [];
  await sendEmail({ to: 'pair@gmail.com', subject: 'Код', text: '1' });
  assert.deepEqual(calls[0].body.sender, { name: 'WeddingCraft', email: 'noreply@weddingcraft.ru' });
});

test('ошибка RuSender (кончился лимит тарифа) — код всё равно уходит через Brevo', async () => {
  rusenderStatus = 402;
  await sendEmail({ to: 'anna@yandex.ru', subject: 'Код', text: '4', critical: true });
  assert.deepEqual(calls.map(c => c.url), [RUSENDER, BREVO]);
});
