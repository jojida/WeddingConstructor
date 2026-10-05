// End-to-end regression: section boundaries, protected content, restoration,
// editor persistence and the published invitation's data bridge.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { TEMPLATE_FIELDS, TEMPLATE_DEFAULTS, templateCustomDefaults } = require('../frontend/src/lib/constants.ts');
const base = process.env.SECTIONS_BASE_URL || 'http://localhost:3210';
const required = ['cover', 'date', 'venue', 'closing'];
const optional = ['greeting', 'photos', 'schedule', 'dresscode', 'wishes', 'rsvp', 'organizer', 'countdown', 'music', 'map', 'envelope', 'forecast', 'menu'];
const allOff = Object.fromEntries([...required, ...optional].map(id => [id, false]));
const draft = id => ({
  templateId: id, groomName: 'Иван', brideName: 'Анна', weddingDate: '2027-07-17', weddingTime: '15:00', status: 'draft',
  ...TEMPLATE_DEFAULTS[id], enabledSections: {},
  venue: 'Усадьба', venueAddress: 'Москва, ул. Дольская, 1',
  customData: { ...templateCustomDefaults(id, '2027-07-17'), __seededTemplate: id, __musicSeeded: true },
  musicUrl: '/invite/assets/music/air-bach.mp3', galleryPhotos: [],
});
const routeFor = id => `/invite/${id === 'mediterranean' ? '' : `${id}/`}index.html`;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://yandex.ru/**', r => r.fulfill({ contentType: 'text/html', body: '<p>Map fixture</p>' }));
      for (const id of Object.keys(TEMPLATE_FIELDS)) {
        await page.goto(`${base}${routeFor(id)}?editing=1`, { waitUntil: 'load' });
        await page.waitForFunction(() => !!window.WCSections);
        const payload = draft(id);
        await page.evaluate(payload => window.postMessage({ type: 'wc:data', payload: { ...payload.customData, ...payload } }, location.origin), payload);
        await page.waitForFunction(() => !!document.querySelector('.wc-music-btn'));
        const textBefore = await page.locator('[data-edit="inviteText"]').first().textContent().catch(() => null);
        if (id === 'garden-arch') {
          await page.evaluate(() => window.postMessage({ type: 'wc:data', payload: { enabledSections: { greeting: false } } }, location.origin));
          await page.locator('[data-wc-section="greeting"]').first().waitFor({ state: 'hidden' });
          assert.equal(await page.locator('[data-wc-section="photos"]').isVisible(), true, 'Garden Arch greeting hides its photos');
          await page.evaluate(() => window.postMessage({ type: 'wc:data', payload: { enabledSections: { photos: false } } }, location.origin));
          await page.locator('[data-wc-section="photos"]').waitFor({ state: 'hidden' });
          assert.equal(await page.locator('[data-wc-section="greeting"]').first().isVisible(), true, 'Garden Arch photos hide its greeting');
        }
        await page.evaluate(flags => window.postMessage({ type: 'wc:data', payload: { enabledSections: flags, musicUrl: '/invite/assets/music/air-bach.mp3' } }, location.origin), allOff);
        await page.waitForFunction(() => document.querySelector('[data-wc-section="schedule"]').classList.contains('wc-section-hidden'));
        const result = await page.evaluate(required => ({
          core: required.map(id => ({ id, preserved: Array.from(document.querySelectorAll(`[data-wc-section="${id}"]`)).some(el => !el.closest('.wc-section-hidden') && el.getBoundingClientRect().height > 0) })),
          optionalVisible: Array.from(document.querySelectorAll('[data-wc-section]')).filter(el => !required.includes(el.dataset.wcSection) && getComputedStyle(el).display !== 'none').map(el => el.dataset.wcSection),
          musicHidden: getComputedStyle(document.querySelector('.wc-music-btn')).display === 'none',
          mapHidden: document.querySelector('[data-wc-map]').hidden,
          panelGaps: Array.from(document.querySelectorAll('.panel.wc-section-hidden')).some(el => el.getBoundingClientRect().height !== 0),
        }), required);
        assert.ok(result.core.every(item => item.preserved), `${id} @${width}: lost core ${JSON.stringify(result.core)}`);
        assert.deepEqual(result.optionalVisible, [], `${id} @${width}: optional content remains`);
        assert.ok(result.musicHidden && result.mapHidden && !result.panelGaps, `${id} @${width}: player/map/panel gap`);
        if (id === 'floral') assert.equal(await page.locator('.polaroids').evaluate(el => !!el.getClientRects().length), true, 'Floral RSVP removed its final photos');
        await page.evaluate(() => window.postMessage({ type: 'wc:data', payload: { enabledSections: {}, musicUrl: '/invite/assets/music/air-bach.mp3' } }, location.origin));
        await page.waitForFunction(() => !document.querySelector('[data-wc-section="schedule"]').classList.contains('wc-section-hidden'));
        await page.waitForFunction(() => !document.querySelector('[data-wc-map]').hidden);
        assert.equal(await page.locator('.wc-section-hidden').count(), 0, `${id} @${width}: sections did not restore`);
        if (textBefore !== null) assert.equal(await page.locator('[data-edit="inviteText"]').first().textContent(), textBefore, `${id}: hidden content was lost`);
        assert.equal(await page.locator('.wc-music-btn').evaluate(el => getComputedStyle(el).display), 'flex');
        await page.evaluate(() => { window.WCMusic.set(''); window.WCMusic.set('/invite/assets/music/air-bach.mp3'); });
        assert.equal(await page.locator('.wc-music-btn').count(), 1, `${id}: music player did not return after clearing the track`);
        console.log(`${id} @${width}: all optional blocks hide and restore; core preserved.`);
      }
      assert.deepEqual(errors, [], `Template runtime exceptions @${width}`);
      await page.close();
    }

    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('https://nominatim.openstreetmap.org/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
    await context.route('https://yandex.ru/**', r => r.fulfill({ contentType: 'text/html', body: '<p>Map fixture</p>' }));
    const page = await context.newPage();
    await page.addInitScript(d => { if (!localStorage.getItem('wc_guest_draft')) localStorage.setItem('wc_guest_draft', JSON.stringify(d)); }, draft('ivory'));
    await page.goto(`${base}/editor?template=ivory`, { waitUntil: 'load' });
    const scheduleSwitch = page.getByRole('switch', { name: 'Программа дня: показывать на сайте' });
    await scheduleSwitch.waitFor();
    const frame = page.frameLocator('iframe').first();
    await frame.locator('[data-wc-section="schedule"]').waitFor({ state: 'visible' });
    for (const section of TEMPLATE_FIELDS.ivory.filter(s => s.required)) {
      const control = page.getByRole('switch', { name: `${section.title}: показывать на сайте` });
      assert.equal(await control.isDisabled(), true);
      assert.equal(await control.getAttribute('aria-checked'), 'true');
    }
    await scheduleSwitch.focus();
    await page.keyboard.press('Space');
    await frame.locator('[data-wc-section="schedule"]').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('wc_guest_draft')).enabledSections.schedule === false);
    await page.reload({ waitUntil: 'load' });
    assert.equal(await scheduleSwitch.getAttribute('aria-checked'), 'false');
    await frame.locator('[data-wc-section="schedule"]').waitFor({ state: 'hidden' });
    await scheduleSwitch.click();
    await frame.locator('[data-wc-section="schedule"]').waitFor({ state: 'visible' });
    const greetingSwitch = page.getByRole('switch', { name: 'Приветствие: показывать на сайте' });
    await greetingSwitch.click();
    await frame.locator('[data-edit="inviteText"]').waitFor({ state: 'hidden' });
    assert.equal(await frame.locator('.cal').isVisible(), true);
    assert.equal(await frame.locator('[data-edit="venue"]').isVisible(), true);
    await page.screenshot({ path: path.join(__dirname, '../.checks/sections-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(__dirname, '../.checks/sections-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Editor overflows mobile viewport');

    // Full-page preview uses the same data bridge as published invitations.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await scheduleSwitch.click();
    await page.getByRole('button', { name: 'Предпросмотр', exact: true }).click();
    const fullFrame = page.frameLocator('iframe').first();
    await fullFrame.locator('[data-wc-section="schedule"]').waitFor({ state: 'hidden' });
    assert.equal(await fullFrame.locator('.cal').isVisible(), true);
    console.log('Editor: keyboard switches, protected rows, live preview, draft reload, mobile layout, and full-page bridge passed.');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
