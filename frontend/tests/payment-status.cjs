const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/payment/success/page.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;

function harness(query, response) {
  const effects = [], state = [], timers = new Map(), requests = [];
  const context = {
    exports: {}, AbortController, Date, URLSearchParams,
    window: { location: { origin: 'https://weddingcraft.ru' } },
    setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    require(name) {
      if (name === 'react') return {
        useCallback: callback => callback, useRef: value => ({ current: value }),
        useState(value) { const index = state.length; state.push(value); return [value, next => { state[index] = next; }]; },
        useEffect(callback) { effects.push(callback); },
      };
      if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
      if (name === 'next/navigation') return { useSearchParams: () => new URLSearchParams(query) };
      if (name === 'next/link' || name.endsWith('.css')) return { default: () => null, __esModule: true };
      if (name === 'react-hot-toast') return { default: { error() {} }, __esModule: true };
      if (name === '@/lib/api') return { default: { get: (url, options) => {
        requests.push({ url, options }); return response();
      } }, __esModule: true };
      if (name === '@/store/auth') return { useAuthStore: selector => selector({ user: null }) };
      if (name === '@/lib/constants') return { isAdvancedPlan: () => false, LEGAL: {} };
      if (name === '@/lib/metrika') return { reachGoal() {}, GOAL: {} };
      throw new Error(`Unexpected import ${name}`);
    },
  };
  vm.runInNewContext(source + '\nexports.runContent = SuccessContent;', context);
  context.exports.runContent();
  const dispose = effects[0]();
  return { state, timers, requests, dispose };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('payment status sends the return capability and never reports success before confirmation', async () => {
  const h = harness('id=private/id&plan=maximum&token=return-secret', async () => ({ data: { paid: false, paymentStatus: 'pending' } }));
  await flush();
  assert.equal(h.requests[0].url, '/api/payment/public-status/private%2Fid');
  assert.equal(h.requests[0].options.params.token, 'return-secret');
  assert.equal(h.state[1], 'checking');
  assert.equal(h.state[0], null);
  assert.equal(h.timers.size, 1);
  h.dispose();
});

test('slow payment requests never overlap and a disposed page ignores late confirmation', async () => {
  let resolve;
  const request = new Promise(done => { resolve = done; });
  const h = harness('id=invite&plan=premium&token=capability', () => request);
  assert.equal(h.requests.length, 1);
  assert.equal(h.timers.size, 0);
  h.dispose();
  assert.equal(h.requests[0].options.signal.aborted, true);
  resolve({ data: { paid: true, plan: 'premium', slug: 'couple' } });
  await flush();
  assert.equal(h.state[1], 'checking');
  assert.equal(h.state[0], null);
  assert.equal(h.timers.size, 0);
});

test('confirmed payment stops polling and exposes only the guest link', async () => {
  const h = harness('id=invite&plan=maximum&token=capability', async () => ({ data: { paid: true, plan: 'maximum', slug: 'couple' } }));
  await flush();
  assert.equal(h.state[1], 'paid');
  assert.equal(h.state[0].slug, 'couple');
  assert.equal(h.timers.size, 0);
  h.dispose();
});

test('expired payment capability stops polling and asks the owner to log in', async () => {
  const h = harness('id=invite&token=expired', async () => { throw { response: { status: 401 } }; });
  await flush();
  assert.equal(h.state[1], 'stalled');
  assert.equal(h.state[2], 'auth-required');
  assert.equal(h.timers.size, 0);
  h.dispose();
});
