const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
};

const { emailTypoFix, isMailRuAddress } = require('../src/lib/email-typo.ts');
const { freeLosses } = require('../src/lib/free-losses.ts');

test('подсказка при опечатке в домене почты', () => {
  for (const [typed, fixed] of [
    ['anna@gmial.com', 'anna@gmail.com'], ['anna@gmail.con', 'anna@gmail.com'], ['anna@gmailcom', 'anna@gmail.com'],
    ['Anna@Gmail.ru', 'anna@gmail.com'], ['anna@mail.ry', 'anna@mail.ru'], ['anna@yandex.ri', 'anna@yandex.ru'],
    ['anna@yandeks.ru', 'anna@yandex.ru'], ['anna@ya.ry', 'anna@ya.ru'], ['anna@inbox.rj', 'anna@inbox.ru'],
  ]) assert.equal(emailTypoFix(typed), fixed, typed);
  // Настоящие адреса не трогаем, в том числе похожие на популярные
  for (const ok of ['anna@gmail.com', 'anna@mail.ru', 'anna@mail.com', 'anna@live.ru', 'anna@ukr.net',
    'anna@company.ru', 'anna@weddingcraft.ru', 'не почта', 'anna@', '']) assert.equal(emailTypoFix(ok), null, ok);
});

test('адреса Mail.ru распознаются для подсказки «укажите другую почту»', () => {
  for (const email of ['anna@mail.ru', ' Anna@BK.ru ', 'anna@inbox.ru', 'anna@list.ru']) assert.equal(isMailRuAddress(email), true, email);
  for (const email of ['anna@gmail.com', 'anna@yandex.ru', 'mail.ru', '']) assert.equal(isMailRuAddress(email), false, email);
});

test('на бесплатном тарифе — что гости не увидят, словами пары', () => {
  const invite = {
    templateId: 'forest', venue: 'Белый сад', venueAddress: 'Москва, ул. Садовая, 12',
    schedule: [{ time: '15:00', title: 'Сбор гостей' }, { time: '16:00', title: 'Церемония' }, { time: '17:00', title: ' ' }],
    enabledSections: {}, customData: {},
  };
  const losses = freeLosses(invite);
  assert.equal(losses[0], 'место — «Белый сад» — и карту проезда');
  assert.ok(losses.includes('программу дня (2 пункта)'), JSON.stringify(losses));
  assert.ok(losses.some(item => item.startsWith('анкету')), JSON.stringify(losses));
  // Пример из шаблона за место пары не выдаём; выключенный парой блок не упоминаем
  const sample = freeLosses({ ...invite, venue: 'Усадьба Кусково', venueAddress: 'Москва, ул. Юности, 2', enabledSections: { rsvp: false, schedule: false } });
  assert.equal(sample[0], 'место и карту проезда');
  assert.ok(!sample.some(item => item.startsWith('анкету') || item.startsWith('программу')), JSON.stringify(sample));
  // Шаблон без схемы блоков — сказать нечего
  assert.deepEqual(freeLosses({ templateId: 'no-such-template' }), []);
});
