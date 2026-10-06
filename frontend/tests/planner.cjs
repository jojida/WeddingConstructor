// Меню и рассадка: чистая логика кабинета (подписи столов, склонения, фильтры списка гостей).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
};
const {
  DEFAULT_FILTERS, filterPool, indexSnapshot, looksSingle, nextTableName, norm, peopleText, plural, seatsText, tableTitle, tablesNeeded, errorText,
} = require('../src/lib/planner.ts');

test('подпись стола: номера и короткие названия — «Стол …», слова — как есть', () => {
  assert.equal(tableTitle('1'), 'Стол 1');
  assert.equal(tableTitle('12'), 'Стол 12');
  assert.equal(tableTitle('Д1'), 'Стол Д1');
  assert.equal(tableTitle('A3'), 'Стол A3');
  assert.equal(tableTitle('12б'), 'Стол 12б');
  assert.equal(tableTitle('ДР'), 'Стол ДР');
  assert.equal(tableTitle('Молодожёны'), 'Молодожёны');
  assert.equal(tableTitle('Президиум'), 'Президиум');
});

test('склонения: человек, место', () => {
  assert.deepEqual([1, 2, 5, 11, 21, 22, 25].map(peopleText), ['1 человек', '2 человека', '5 человек', '11 человек', '21 человек', '22 человека', '25 человек']);
  assert.deepEqual([1, 2, 5, 11, 21].map(seatsText), ['1 место', '2 места', '5 мест', '11 мест', '21 место']);
  assert.equal(plural(3, 'стол', 'стола', 'столов'), 'стола');
});

test('новый стол получает наименьший свободный номер, столов нужно с запасом', () => {
  assert.equal(nextTableName([{ name: '1' }, { name: '2' }, { name: '4' }]), '3');
  assert.equal(nextTableName([]), '1');
  assert.equal(tablesNeeded(62, 10), 7);
  assert.equal(tablesNeeded(0, 10), 0);
  assert.equal(tablesNeeded(5, 0), 0);
});

test('одно имя или несколько', () => {
  assert.equal(looksSingle('Анна Иванова'), true);
  for (const many of ['Денис и Мария', 'Анна, Пётр', 'Иван + 1', 'Семья с детьми']) assert.equal(looksSingle(many), false, many);
});

test('поиск не зависит от регистра и «ё»', () => {
  assert.equal(norm('  ПЁТР   Иванов '), 'петр иванов');
});

const party = (key, label, status, over = {}) => ({ key, kind: 'guest', guestId: key, label, status, want: 1, kids: 0, seatWish: '', note: '', answeredAt: null, createdAt: '2026-01-01', ...over });
const person = (id, partyKey, slot, name, status, over = {}) => ({
  id, partyKey, slot, name, isChild: false, excluded: false, menuOptionId: null, menuReview: false, diet: '', tag: '', tableId: null, status, ...over,
});
const snap = {
  parties: [party('g:a', 'Семья Кореловых', 'yes'), party('g:b', 'Анна', 'yes'), party('g:c', 'Павел и Ольга', 'no'), party('g:d', 'Игорь', 'maybe')],
  persons: [
    person('a1', 'g:a', 0, '', 'yes', { tag: 'Семья жениха' }), person('a2', 'g:a', 1, 'Пётр Корелов', 'yes', { tag: 'Семья жениха', tableId: 't1' }),
    person('b1', 'g:b', 0, 'Анна', 'yes'), person('c1', 'g:c', 0, 'Павел', 'no'), person('d1', 'g:d', 0, 'Игорь', 'maybe'),
    person('x1', 'g:b', 1, 'Убранный', 'yes', { excluded: true }),
  ],
  tables: [{ id: 't1', name: '10' }, { id: 't2', name: '2' }, { id: 't3', name: '1' }],
  options: [],
};

test('список гостей: по умолчанию без отказавшихся, убранных и уже посаженных', () => {
  const index = indexSnapshot(snap);
  const rows = filterPool(snap, index, DEFAULT_FILTERS);
  assert.deepEqual(rows.map((r) => r.party.key), ['g:a', 'g:b', 'g:d']);
  assert.deepEqual(rows[0].people.map((p) => p.id), ['a1']);           // второй уже за столом
  assert.equal(rows[0].total, 2);
  assert.ok(!rows.some((r) => r.people.some((p) => p.excluded)));
});

test('список гостей: фильтры по ответу, имени, метке и «без имени»', () => {
  const index = indexSnapshot(snap);
  const run = (f) => filterPool(snap, index, { ...DEFAULT_FILTERS, ...f }).map((r) => r.party.key);
  assert.deepEqual(run({ status: 'no' }), ['g:c']);
  assert.deepEqual(run({ status: 'maybe' }), ['g:d']);
  assert.deepEqual(run({ unseatedOnly: false, q: 'ПЁТР' }), ['g:a']);
  assert.deepEqual(run({ q: 'кореловых' }), ['g:a']);                   // по названию группы
  assert.deepEqual(run({ unseatedOnly: false, tag: 'Семья жениха' }), ['g:a']);
  assert.deepEqual(run({ unseatedOnly: false, unnamed: true }), ['g:a']);
  assert.deepEqual(run({ q: 'такого-нет' }), []);
});

test('столы идут по естественному порядку: 1, 2, 10', () => {
  assert.deepEqual(indexSnapshot(snap).tables.map((t) => t.name), ['1', '2', '10']);
});

test('текст ошибки берётся из ответа сервера', () => {
  assert.equal(errorText({ response: { data: { error: 'За столом «5» свободно 0 мест' } } }), 'За столом «5» свободно 0 мест');
  assert.equal(errorText(new Error('network')), 'Не получилось. Попробуйте ещё раз');
  assert.equal(errorText({ response: { data: { error: '' } } }, 'запасной'), 'запасной');
});
