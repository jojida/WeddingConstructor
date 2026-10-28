// Browser regression: editor previews must survive WebGL teardown and replay.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const base = (process.env.ENVELOPE_BASE_URL || 'http://127.0.0.1:3210').replace(/\/$/, '');
const route = '/invite/angels/index.html';
const mobile = { width: 360, height: 720 };

async function newPage(browser, viewport = mobile) {
  const page = await browser.newPage({ viewport, reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://yandex.ru/**', request => request.fulfill({ contentType: 'text/html', body: '<p>Map fixture</p>' }));
  return { page, errors };
}

async function editorReady(page) {
  await page.goto(`${base}${route}?editing=1`, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Посмотреть, как откроется' }).waitFor();
  assert.equal(await page.evaluate(() => window.WCIntroPreview.on), true);
}

async function readyCanvas(page, editor) {
  await page.waitForFunction(isEditor => {
    const envelope = document.querySelector('.wc-env3d');
    if (!envelope?.classList.contains('is-ready')) return false;
    if (isEditor && (!envelope.classList.contains('wc-ip-on') || !window.WCIntroPreview.isPlaying())) return false;
    const gl = envelope.querySelector('canvas')?.getContext('webgl2');
    return gl && !gl.isContextLost();
  }, editor, { timeout: 15000 });
}

async function finishEditorPlayback(page, label) {
  await readyCanvas(page, true);
  await page.waitForFunction(() => document.querySelector('.wc-env3d').classList.contains('is-opening'));
  await page.waitForFunction(() => !window.WCIntroPreview.isPlaying(), null, { timeout: 15000 });
  assert.equal(await page.locator('.wc-env3d').evaluate(el => el.classList.contains('wc-ip-on')), false, `${label}: preview remains visible`);
  assert.equal(await page.getByRole('button', { name: 'Посмотреть, как откроется' }).isEnabled(), true, `${label}: replay button stays disabled`);
}

async function playEditor(page, label) {
  await page.getByRole('button', { name: 'Посмотреть, как откроется' }).click();
  await finishEditorPlayback(page, label);
}

async function sendData(page, payload) {
  await page.evaluate(payload => window.postMessage({ type: 'wc:data', payload }, location.origin), payload);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const viewport of [mobile, { width: 500, height: 900 }]) {
      const { page, errors } = await newPage(browser, viewport);
      try {
        await editorReady(page);
        // The first message seeds the data bridge without starting a peek.
        await sendData(page, { groomName: 'Алексей', brideName: 'Ангелина', sealColor: 'beige' });
        await playEditor(page, 'first play');
        await playEditor(page, 'replay');
        await sendData(page, { groomName: 'Иван', brideName: 'Анна', sealColor: 'burgundy' });
        await page.waitForFunction(() => document.querySelector('.wc-env3d').classList.contains('wc-ip-on'));
        await page.waitForFunction(() => {
          const envelope = document.querySelector('.wc-env3d');
          const gl = envelope.querySelector('canvas').getContext('webgl2');
          return envelope.classList.contains('is-ready') && gl && !gl.isContextLost();
        });
        await page.waitForFunction(() => !document.querySelector('.wc-env3d').classList.contains('wc-ip-on'), null, { timeout: 10000 });
        await playEditor(page, 'play after name/color peek');
        assert.deepEqual(errors, [], `Editor runtime exceptions @${viewport.width}`);
        console.log(`Angels @${viewport.width}: first play, replay, and replay after editing names/color passed.`);
      } finally { await page.close(); }
    }

    // A peek can expire while its images are loading. Its late teardown must
    // leave the next preview's canvas and WebGL context intact.
    {
      const { page, errors } = await newPage(browser);
      let releaseAsset;
      const assetGate = new Promise(resolve => { releaseAsset = resolve; });
      let held = false;
      // Paper is also a CSS background loaded before playback. Hold the sprig,
      // which is requested only after mountEnvelope has started loading assets.
      await page.route('**/invite/assets/envelope3d/sprig.webp', async request => {
        if (!held) { held = true; await assetGate; }
        await request.continue();
      });
      try {
        await editorReady(page);
        const assetRequested = page.waitForRequest('**/invite/assets/envelope3d/sprig.webp');
        await page.evaluate(() => window.WCIntroPreview.peek(1000));
        await assetRequested;
        await page.waitForFunction(() => !document.querySelector('.wc-env3d').classList.contains('wc-ip-on'));
        await page.getByRole('button', { name: 'Посмотреть, как откроется' }).click();
        releaseAsset();
        await finishEditorPlayback(page, 'play after delayed peek');
        await playEditor(page, 'replay after delayed peek');
        assert.deepEqual(errors, [], 'Delayed mount runtime exceptions');
        console.log('Angels: a late mount after a hidden peek does not break the next playback.');
      } finally { releaseAsset(); await page.close(); }
    }

    {
      const { page, errors } = await newPage(browser);
      try {
        await page.goto(`${base}${route}`, { waitUntil: 'load' });
        await readyCanvas(page, false);
        await page.getByRole('button', { name: 'Открыть приглашение', exact: true }).click();
        await page.waitForFunction(() => !window.WCEnvelope.active, null, { timeout: 15000 });
        await page.waitForFunction(() => document.documentElement.classList.contains('hero-go'));
        await page.locator('.wc-env3d').waitFor({ state: 'detached' });
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('env-lock')), false);
        await page.reload({ waitUntil: 'load' });
        await readyCanvas(page, false);
        const envelope = page.getByRole('button', { name: 'Открыть приглашение', exact: true });
        await envelope.click();
        await page.waitForFunction(() => document.querySelector('.wc-env3d').classList.contains('is-opening'));
        await envelope.click();
        assert.equal(await page.evaluate(() => window.WCEnvelope.active), false, 'Second guest click did not skip opening');
        await page.locator('.wc-env3d').waitFor({ state: 'detached' });
        assert.deepEqual(errors, [], 'Guest runtime exceptions');
        console.log('Angels: guest opening completes, and a second click skips it.');
      } finally { await page.close(); }
    }

    for (const fallback of ['intro=0', 'no-webgl']) {
      const { page, errors } = await newPage(browser);
      try {
        if (fallback === 'no-webgl') {
          await page.addInitScript(() => {
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (type, ...args) {
              return type === 'webgl2' ? null : original.call(this, type, ...args);
            };
          });
        }
        await page.goto(`${base}${route}${fallback === 'intro=0' ? '?intro=0' : ''}`, { waitUntil: 'load' });
        await page.waitForFunction(() => document.documentElement.classList.contains('hero-go'));
        assert.equal(await page.locator('.wc-env3d').count(), 0, `${fallback}: envelope blocks invitation`);
        assert.equal(await page.evaluate(() => window.WCEnvelope.active), false);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('env-lock')), false);
        assert.deepEqual(errors, [], `${fallback}: runtime exceptions`);
        console.log(`Angels: ${fallback} opens the invitation directly.`);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
