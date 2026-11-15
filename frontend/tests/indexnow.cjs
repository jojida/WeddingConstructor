const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { INDEXNOW_KEY, parseSitemap, changedUrls, pingIndexNow } = require('../src/lib/indexnow.ts');

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<url>
<loc>https://weddingcraft.ru</loc>
<lastmod>2026-11-14T00:28:06.000Z</lastmod>
</url>
<url>
<loc>https://weddingcraft.ru/demo/calla</loc>
<image:image>
<image:loc>https://weddingcraft.ru/invite/calla/assets/couple-photo.jpg</image:loc>
</image:image>
<lastmod>2026-11-11T18:23:27.000Z</lastmod>
</url>
<url>
<loc>https://weddingcraft.ru/blog</loc>
<lastmod>2026-11-06T15:28:35.000Z</lastmod>
</url>
</urlset>`;

const PROD = { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://api.weddingcraft.ru' };

function site(sitemap = SITEMAP) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-indexnow-'));
  fs.mkdirSync(path.join(dir, '.next', 'server', 'app'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.next', 'server', 'app', 'sitemap.xml.body'), sitemap);
  return dir;
}

function recorder(status = 200) {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: status >= 200 && status < 300, status }; };
  return { calls, fetchImpl };
}

const quiet = () => {};

test('the key file served to search engines contains the key', () => {
  assert.match(INDEXNOW_KEY, /^[a-f0-9]{8,128}$/);
  assert.equal(fs.readFileSync(path.join(__dirname, '..', 'public', `${INDEXNOW_KEY}.txt`), 'utf8').trim(), INDEXNOW_KEY);
});

test('sitemap is read page by page; image addresses are not pages', () => {
  assert.deepEqual(parseSitemap(SITEMAP), [
    { url: 'https://weddingcraft.ru', lastmod: '2026-11-14T00:28:06.000Z' },
    { url: 'https://weddingcraft.ru/demo/calla', lastmod: '2026-11-11T18:23:27.000Z' },
    { url: 'https://weddingcraft.ru/blog', lastmod: '2026-11-06T15:28:35.000Z' },
  ]);
});

test('only new and changed pages of our own site are reported', () => {
  const entries = [...parseSitemap(SITEMAP), { url: 'https://weddingcraft.ru.example.com/x', lastmod: '1' }];
  const sent = { 'https://weddingcraft.ru': '2026-11-14T00:28:06.000Z', 'https://weddingcraft.ru/blog': '2026-10-19T00:00:00.000Z' };
  assert.deepEqual(changedUrls(entries, sent), ['https://weddingcraft.ru/demo/calla', 'https://weddingcraft.ru/blog']);
});

test('nothing leaves a local build, a build in progress or a switched-off server', async () => {
  const dir = site();
  for (const env of [
    { ...PROD, NODE_ENV: 'development' },
    { ...PROD, NEXT_PUBLIC_API_URL: 'http://localhost:4000' },
    { ...PROD, NEXT_PHASE: 'phase-production-build' },
    { ...PROD, INDEXNOW: 'off' },
  ]) {
    const { calls, fetchImpl } = recorder();
    assert.equal(await pingIndexNow({ dir, env, fetchImpl, log: quiet }), 'off');
    assert.equal(calls.length, 0);
  }
});

test('first start reports every page, the next one only what changed', async () => {
  const dir = site();
  const first = recorder();
  assert.equal(await pingIndexNow({ dir, env: PROD, fetchImpl: first.fetchImpl, log: quiet }), 'sent');
  assert.equal(first.calls[0].url, 'https://yandex.com/indexnow');
  assert.deepEqual(first.calls[0].body, {
    host: 'weddingcraft.ru',
    key: INDEXNOW_KEY,
    keyLocation: `https://weddingcraft.ru/${INDEXNOW_KEY}.txt`,
    urlList: ['https://weddingcraft.ru', 'https://weddingcraft.ru/demo/calla', 'https://weddingcraft.ru/blog'],
  });

  const idle = recorder();
  assert.equal(await pingIndexNow({ dir, env: PROD, fetchImpl: idle.fetchImpl, log: quiet }), 'nothing');
  assert.equal(idle.calls.length, 0);

  fs.writeFileSync(path.join(dir, '.next', 'server', 'app', 'sitemap.xml.body'), SITEMAP.replace('2026-11-06T15:28:35.000Z', '2026-11-20T10:00:00.000Z'));
  const changed = recorder();
  assert.equal(await pingIndexNow({ dir, env: PROD, fetchImpl: changed.fetchImpl, log: quiet }), 'sent');
  assert.deepEqual(changed.calls[0].body.urlList, ['https://weddingcraft.ru/blog']);
});

test('a refused or failed request is retried on the next start', async () => {
  const dir = site();
  const refused = recorder(403);
  assert.equal(await pingIndexNow({ dir, env: PROD, fetchImpl: refused.fetchImpl, log: quiet }), 'failed');
  const offline = async () => { throw new Error('network down'); };
  assert.equal(await pingIndexNow({ dir, env: PROD, fetchImpl: offline, log: quiet }), 'failed');
  assert.equal(fs.existsSync(path.join(dir, '.indexnow-sent.json')), false);

  const retry = recorder(202);
  assert.equal(await pingIndexNow({ dir, env: PROD, fetchImpl: retry.fetchImpl, log: quiet }), 'sent');
  assert.equal(retry.calls[0].body.urlList.length, 3);
});

test('a server without a built sitemap stays silent', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-indexnow-'));
  const { calls, fetchImpl } = recorder();
  assert.equal(await pingIndexNow({ dir, env: PROD, fetchImpl, log: quiet }), 'no-sitemap');
  assert.equal(calls.length, 0);
});
