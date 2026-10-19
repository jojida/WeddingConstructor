const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
};

function storage(t, blocked = false) {
  const previous = global.localStorage;
  const entries = new Map();
  global.localStorage = {
    getItem(key) { if (blocked) throw new Error('Storage denied'); return entries.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw new Error('Quota exceeded'); entries.set(key, value); },
    removeItem(key) { if (blocked) throw new Error('Storage denied'); entries.delete(key); },
  };
  t.after(() => { if (previous === undefined) delete global.localStorage; else global.localStorage = previous; });
  return entries;
}

const promo = require('../src/lib/promo-link.ts');

test('partner link code is read from the address, uppercased; junk is ignored', () => {
  assert.equal(promo.promoFromSearch('?promo=anna10'), 'ANNA10');
  assert.equal(promo.promoFromSearch('?utm_source=vk&promo=%20Wed-2027%20'), 'WED-2027');
  assert.equal(promo.promoFromSearch('?promo=свадьба10'), 'СВАДЬБА10');
  for (const search of ['', '?promo=', '?promo=a', '?promo=<b>x</b>', '?promo=' + 'X'.repeat(33), '?code=ANNA10']) {
    assert.equal(promo.promoFromSearch(search), null, search);
  }
});

test('remembered code is offered at payment for 90 days, the latest link wins', t => {
  storage(t);
  const day = 24 * 60 * 60 * 1000;
  promo.rememberPromoFromUrl('?promo=anna10', 1000);
  assert.equal(promo.savedPromo(1000 + 89 * day), 'ANNA10');
  promo.rememberPromoFromUrl('?promo=oleg5', 2000);
  assert.equal(promo.savedPromo(2000), 'OLEG5');
  promo.rememberPromoFromUrl('?utm_source=vk', 3000); // ссылка без кода не стирает запомненный
  assert.equal(promo.savedPromo(3000), 'OLEG5');
  assert.equal(promo.savedPromo(2000 + 91 * day), null);
  assert.equal(promo.savedPromo(2000), null, 'expired code is removed');
});

test('forgotten or broken codes are not offered; blocked storage never throws', t => {
  const entries = storage(t);
  promo.rememberPromoFromUrl('?promo=anna10');
  promo.forgetPromo();
  assert.equal(promo.savedPromo(), null);
  entries.set('wc_promo', '{"code":"<b>","at":1}');
  assert.equal(promo.savedPromo(2), null);
  entries.set('wc_promo', 'not json');
  assert.equal(promo.savedPromo(), null);
});

test('private mode: storage errors are swallowed', t => {
  storage(t, true);
  assert.doesNotThrow(() => promo.rememberPromoFromUrl('?promo=anna10'));
  assert.equal(promo.savedPromo(), null);
  assert.doesNotThrow(() => promo.forgetPromo());
});
