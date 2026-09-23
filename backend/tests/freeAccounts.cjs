const test = require('node:test');
const assert = require('node:assert');

const { isFreeAccount, emailHash } = require('../dist/lib/freeAccounts.js');

test('хеш не зависит от регистра и пробелов', () => {
  assert.strictEqual(emailHash('  Petr@Mail.RU '), emailHash('petr@mail.ru'));
});

test('список из env: регистр и пробелы не мешают', () => {
  process.env.FREE_ACCOUNTS = ' Owner@Mail.ru , second@mail.ru ';
  assert.ok(isFreeAccount('owner@mail.ru'));
  assert.ok(isFreeAccount('  OWNER@MAIL.RU  '));
  assert.ok(isFreeAccount('second@mail.ru'));
  assert.ok(!isFreeAccount('stranger@mail.ru'));
});

test('пустой env никого не пускает', () => {
  process.env.FREE_ACCOUNTS = '';
  assert.ok(!isFreeAccount('owner@mail.ru'));
  assert.ok(!isFreeAccount(''));
  assert.ok(!isFreeAccount(null));
  assert.ok(!isFreeAccount(undefined));
});
