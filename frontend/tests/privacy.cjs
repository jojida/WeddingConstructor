const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
};

function fresh(name) {
  const filename = require.resolve(name);
  delete require.cache[filename];
  return require(filename);
}

function browser(t, blocked = false) {
  const previous = { window: global.window, document: global.document, localStorage: global.localStorage };
  const entries = new Map();
  const localStorage = {
    getItem(key) { if (blocked) throw new Error('Storage denied'); return entries.get(key) || null; },
    setItem(key, value) { if (blocked) throw new Error('Quota exceeded'); entries.set(key, value); },
    removeItem(key) { if (blocked) throw new Error('Storage denied'); entries.delete(key); },
  };
  global.window = { location: { href: 'https://weddingcraft.ru/', origin: 'https://weddingcraft.ru' }, localStorage, sessionStorage: localStorage };
  global.localStorage = localStorage;
  const scripts = [];
  global.document = { scripts, referrer: '', createElement: () => ({}), head: { appendChild: script => scripts.push(script) } };
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete global[name]; else global[name] = value;
    }
  });
  return { entries, scripts };
}

test('analytics excludes private routes, guest tokens, custom domains and local development', () => {
  const { analyticsPageUrl } = fresh('../src/lib/metrika.ts');
  for (const url of [
    '/couple?g=guest-secret', '/invite/couple?g=guest-secret', '/editor?id=private-id',
    '/dashboard/private-id', '/payment/success?id=private-id&token=return-secret',
    '/auth', '/print/editor?id=private-id', '/studio', '/?g=guest-secret',
    'https://couple.example/', 'http://localhost:3000/',
  ]) assert.equal(analyticsPageUrl(url), null, url);
  assert.equal(analyticsPageUrl('/templates?email=private@example.com#secret'), 'https://weddingcraft.ru/templates');
  assert.equal(analyticsPageUrl('/demo/calla?token=secret'), 'https://weddingcraft.ru/demo/calla');
});

test('private landing does not load analytics; leaving marketing stops it and strips sensitive referrers', t => {
  const { scripts } = browser(t);
  const { trackPageView, reachGoal } = fresh('../src/lib/metrika.ts');
  window.location.href = 'https://weddingcraft.ru/payment/success?token=secret';
  document.referrer = 'https://weddingcraft.ru/couple?g=guest-secret';
  trackPageView(window.location.href);
  assert.equal(scripts.length, 0);
  const calls = [];
  window.ym = (...args) => calls.push(args);
  window.location.href = 'https://weddingcraft.ru/templates';
  trackPageView('/templates?token=secret');
  assert.equal(scripts.length, 1);
  const init = calls.find(call => call[1] === 'init')[2];
  assert.equal(init.defer, true);
  assert.equal(init.webvisor, false);
  assert.equal(init.clickmap, false);
  assert.equal(init.trackLinks, false);
  assert.equal(init.referrer, '');
  assert.equal(calls.find(call => call[1] === 'hit')[3].title, 'WeddingCraft');
  window.location.href = 'https://weddingcraft.ru/dashboard/private-id';
  trackPageView(window.location.href);
  reachGoal('signup', { secret: 'do-not-send' });
  assert.equal(calls.at(-1)[1], 'destruct');
  assert.equal(JSON.stringify(calls).includes('secret'), false);
  assert.equal(JSON.stringify(calls).includes('private-id'), false);
});

test('blocked storage keeps login usable in memory and logout clears the token', t => {
  browser(t, true);
  const storage = fresh('../src/lib/browser-storage.ts');
  storage.writeAuthToken('session-token');
  assert.equal(storage.readAuthToken(), 'session-token');
  storage.writeStorage('localStorage', 'draft', 'draft-json');
  assert.equal(storage.readStorage('sessionStorage', 'draft'), null);
  storage.writeAuthToken(null);
  assert.equal(storage.readAuthToken(), null);
});

test('API never attaches the login token to an external URL or baseURL override', async t => {
  browser(t);
  fresh('../src/lib/browser-storage.ts').writeAuthToken('session-token');
  const api = fresh('../src/lib/api.ts').default;
  const observed = [];
  const adapter = async config => {
    observed.push(config.headers.get('Authorization'));
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  await api.get('/api/auth/me', { adapter });
  await api.get('https://external.example/collect', { adapter });
  await api.get('/collect', { baseURL: 'https://external.example', adapter });
  assert.deepEqual(observed, ['Bearer session-token', undefined, undefined]);
});

test('a delayed identity request cannot log the user back in after logout', async t => {
  browser(t);
  const storage = fresh('../src/lib/browser-storage.ts');
  let resolveRequest;
  const request = new Promise(resolve => { resolveRequest = resolve; });
  const source = fs.readFileSync(require.resolve('../src/store/auth.ts'), 'utf8');
  const context = {
    exports: {}, window,
    require(name) {
      if (name === 'zustand') return { create: initializer => {
        let state;
        state = initializer(patch => { state = { ...state, ...patch }; });
        return { getState: () => state };
      } };
      if (name === '@/lib/api') return { default: { get: () => request }, __esModule: true };
      if (name === '@/lib/metrika') return { reachGoal() {}, muteGoals() {}, GOAL: {} };
      if (name === '@/lib/browser-storage') return storage;
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, context);
  const store = context.exports.useAuthStore;
  storage.writeAuthToken('previous-session');
  const pending = store.getState().fetchMe();
  store.getState().logout();
  resolveRequest({ data: { id: 'previous-owner' } });
  await pending;
  assert.equal(store.getState().user, null);
  assert.equal(store.getState().token, null);
});
