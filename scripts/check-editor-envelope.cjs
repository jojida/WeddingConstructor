// Actual editor regression: the selected envelope stays available for editing.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../frontend/node_modules/typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { TEMPLATE_DEFAULTS, templateCustomDefaults } = require('../frontend/src/lib/constants.ts');
const base = (process.env.ENVELOPE_BASE_URL || 'http://127.0.0.1:3210').replace(/\/$/, '');

async function closedEnvelope(frame) {
  await frame.waitForFunction(() => {
    const el = document.querySelector('.wc-env3d');
    const gl = el?.querySelector('canvas').getContext('webgl2');
    return el && el.classList.contains('wc-ip-on') && el.classList.contains('is-ready') &&
      !el.classList.contains('is-opening') && !el.classList.contains('is-out') &&
      getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility === 'visible' &&
      !window.WCIntroPreview.isPlaying() && gl && !gl.isContextLost();
  });
}

async function fullscreenEnvelope(frame, label) {
  await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const geometry = await frame.evaluate(() => ({
    viewport: { left: 0, top: 0, width: innerWidth, height: innerHeight },
    boxes: ['.wc-env3d', '.wc-env3d__stage', '.wc-env3d canvas'].map(selector => {
      const { left, top, width, height } = document.querySelector(selector).getBoundingClientRect();
      return { selector, left, top, width, height };
    }),
  }));
  for (const box of geometry.boxes) {
    for (const axis of ['left', 'top', 'width', 'height']) {
      assert.ok(Math.abs(box[axis] - geometry.viewport[axis]) <= 1,
        `${label}: ${box.selector} ${axis}=${box[axis]}, expected ${geometry.viewport[axis]}`);
    }
  }
}

async function rememberCanvas(frame) {
  await frame.evaluate(() => { window.__previousEnvelopeCanvas = document.querySelector('.wc-env3d canvas'); });
}

async function releasedEnvelope(frame) {
  await frame.waitForFunction(() => {
    const el = document.querySelector('.wc-env3d');
    return !el.classList.contains('wc-ip-on') && !el.classList.contains('is-ready') &&
      window.__previousEnvelopeCanvas.getContext('webgl2').isContextLost();
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1884, height: 878 }, reducedMotion: 'no-preference' });
    await context.route('https://yandex.ru/**', request => request.fulfill({ contentType: 'text/html', body: '' }));
    await context.route('https://nominatim.openstreetmap.org/**', request => request.fulfill({ contentType: 'application/json', body: '[]' }));
    const draft = {
      templateId: 'angels', groomName: 'Даниил', brideName: 'Вадим', weddingDate: '2027-07-17', weddingTime: '15:00', status: 'draft',
      ...TEMPLATE_DEFAULTS.angels, enabledSections: {}, coverPhoto: '', galleryPhotos: [],
      customData: { ...templateCustomDefaults('angels', '2027-07-17'), __seededTemplate: 'angels', __musicSeeded: true },
    };
    await context.addInitScript(data => {
      if (window === window.top && !localStorage.getItem('wc_guest_draft')) localStorage.setItem('wc_guest_draft', JSON.stringify(data));
    }, draft);
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/editor?template=angels`);
    await page.getByRole('switch').first().waitFor();
    const frame = page.frames().find(candidate => candidate.url().includes('/invite/angels/'));
    assert.ok(frame, 'Angels iframe is missing');
    const envelopeSection = page.getByRole('button', { name: 'Конверт', exact: true });
    await envelopeSection.click();
    await closedEnvelope(frame);
    await fullscreenEnvelope(frame, 'selected envelope');
    for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 1884, height: 878 }]) {
      await page.setViewportSize(viewport);
      await fullscreenEnvelope(frame, `editor @${viewport.width}×${viewport.height}`);
    }
    console.log('Envelope layer, WebGL stage, and canvas fill the preview across desktop, tablet, and mobile layouts.');
    await page.waitForTimeout(6000);
    await closedEnvelope(frame);
    console.log('Selected envelope stays closed and visible beyond six seconds.');

    await page.getByRole('radio', { name: 'Бордо', exact: true }).click();
    await page.waitForTimeout(5000);
    await closedEnvelope(frame);
    assert.equal(await page.getByRole('radio', { name: 'Бордо', exact: true }).getAttribute('aria-checked'), 'true');
    await rememberCanvas(frame);
    await page.getByRole('button', { name: /^Обложка/ }).click();
    await releasedEnvelope(frame);
    await envelopeSection.click();
    await closedEnvelope(frame);
    assert.equal(await frame.evaluate(() => document.querySelector('.wc-env3d canvas') === window.__previousEnvelopeCanvas), false);
    console.log('Color edits persist; leaving releases WebGL and returning restores the envelope.');

    await frame.getByRole('button', { name: 'Посмотреть, как откроется' }).click();
    await frame.waitForFunction(() => document.querySelector('.wc-env3d').classList.contains('is-opening'));
    await closedEnvelope(frame);
    await fullscreenEnvelope(frame, 'restored after playback');
    await rememberCanvas(frame);
    const enabled = page.getByRole('switch', { name: 'Конверт: показывать на сайте', exact: true }).first();
    await enabled.click();
    await releasedEnvelope(frame);
    await enabled.click();
    await closedEnvelope(frame);
    console.log('Playback returns to the selected closed envelope; disabling releases it and enabling restores it.');

    await frame.goto(frame.url(), { waitUntil: 'load' });
    await closedEnvelope(frame);
    assert.deepEqual(errors, [], 'Editor runtime exceptions');
    console.log('Iframe reload restores the selected envelope through wc:ready; no runtime exceptions.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
