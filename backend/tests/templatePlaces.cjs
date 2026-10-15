const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'template-places-test-secret-at-least-32-bytes';
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const frontend = require('../../frontend/src/lib/constants.ts');
const places = require('../dist/lib/templatePlaces');
const { letterFor } = require('../dist/lib/lifecycleEmails');

test('примеры мест на сервере совпадают с шаблонами фронтенда', () => {
  const pick = key => [...new Set(Object.values(frontend.TEMPLATE_DEFAULTS).map(d => (d[key] || '').trim()).filter(Boolean))].sort();
  assert.deepEqual([...places.SAMPLE_VENUES].sort(), pick('venue'), 'добавьте пример места нового шаблона в backend/src/lib/templatePlaces.ts');
  assert.deepEqual([...places.SAMPLE_ADDRESSES].sort(), pick('venueAddress'), 'добавьте пример адреса нового шаблона в backend/src/lib/templatePlaces.ts');
});

test('своё место пары: пустое и пример шаблона не считаются', () => {
  assert.equal(places.ownPlace('Усадьба Кусково', 'Москва, ул. Юности, 2'), null);
  assert.equal(places.ownPlace('', '  '), null);
  assert.deepEqual(places.ownPlace(' Ресторан «Белый сад» ', ''), { kind: 'venue', text: 'Ресторан «Белый сад»' });
  // Пример места чужого шаблона — тоже пример; тогда берём свой адрес
  assert.deepEqual(places.ownPlace('СПА Отель', 'Тверь, ул. Новая, 3'), { kind: 'address', text: 'Тверь, ул. Новая, 3' });
  assert.equal(places.quotePlace('Белый сад'), '«Белый сад»');
  assert.equal(places.quotePlace('Ресторан «Белый сад»'), 'Ресторан «Белый сад»');
});

test('письмо free_4d называет место пары, а без своего места — общее', () => {
  const invite = { id: 'inv1', userId: 'u1', slug: 'anna-ivan', plan: 'free', groomName: 'Иван', brideName: 'Анна' };
  const own = letterFor('free_4d', { ...invite, venue: 'Белый сад', venueAddress: 'Москва, ул. Садовая, 12' });
  assert.equal(own.title, 'Вы указали место — «Белый сад», но гости его не видят');
  assert.match(own.url, /utm_campaign=free_4d&utm_content=place$/);
  const byAddress = letterFor('free_4d', { ...invite, venue: '', venueAddress: 'Тверь, ул. Новая, 3' });
  assert.equal(byAddress.title, 'Вы указали адрес — «Тверь, ул. Новая, 3», но гости его не видят');
  const sample = letterFor('free_4d', { ...invite, venue: 'Усадьба Кусково', venueAddress: 'Москва, ул. Юности, 2' });
  assert.equal(sample.title, '«Где это? Во сколько? Что надеть?»');
  assert.doesNotMatch(sample.url, /utm_content/);
});
