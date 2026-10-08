const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('a slow WebGL mount is destroyed when its editor preview has already ended', async () => {
  const filename = path.join(__dirname, '../public/invite/assets/envelope3d.js');
  const source = fs.readFileSync(filename, 'utf8');
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const functions = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && ['ensure', 'release', 'mount'].includes(node.name?.text)) functions.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  let resolveEngine;
  const loading = new Promise(resolve => { resolveEngine = resolve; });
  let destroyed = 0;
  const engine = { destroy() { destroyed += 1; }, setInitials() {}, setNames() {}, setWax() {} };
  const context = {
    mounting: null, engine: null, mountVersion: 0, EDITING: true, phase: 'closed',
    BASE: '/invite/assets/envelope3d/', stage: {}, SERIF: 'serif', D: { wax: 'ivory' },
    letters: () => ['A', 'B'], namesLine: () => 'A & B', dateLine: () => '2027-01-01',
    previewReveal() {}, reveal() {}, wantOpen: false,
    el: { classList: { add() {}, remove() {} } },
    loadEngine: async () => ({ mountEnvelope: () => loading }),
  };
  // The production dynamic import is the only dependency substituted; no WebGL,
  // DOM, browser or network is involved in this lifecycle regression test.
  vm.createContext(context);
  vm.runInContext(functions.join('\n').replace("import(BASE + 'engine.js')", 'loadEngine()'), context);
  const pending = context.ensure();
  await Promise.resolve();
  context.release();
  resolveEngine(engine);
  await pending;
  assert.equal(destroyed, 1);
  assert.equal(context.engine, null);
  assert.equal(context.mounting, null);
});

test('brand messages accept only the same-origin parent frame', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/invite/assets/brand.js'), 'utf8');
  const listeners = {}, signature = [];
  const parent = {};
  const context = {
    URL, setTimeout() {}, requestAnimationFrame(fn) { fn(); },
    document: { currentScript: { src: 'https://weddingcraft.ru/invite/assets/brand.js' }, readyState: 'complete' },
    window: {
      parent, location: { search: '', origin: 'https://weddingcraft.ru' },
      addEventListener(name, callback) { listeners[name] = callback; },
      WCSignature: { set(value) { signature.push(value.hidden); } },
    },
  };
  vm.runInNewContext(source, context);
  const data = { type: 'wc:data', payload: { wcBrand: false, wcWatermark: false } };
  listeners.message({ origin: 'https://evil.example', source: parent, data });
  listeners.message({ origin: 'https://weddingcraft.ru', source: {}, data });
  assert.deepEqual(signature, []);
  listeners.message({ origin: 'https://weddingcraft.ru', source: parent, data });
  assert.deepEqual(signature, [true]);
});
