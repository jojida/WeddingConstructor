const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.PERF_BASE_URL || 'http://localhost:3210';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('https://yandex.ru/**', r => r.fulfill({ contentType: 'text/html', body: '<p>Map fixture</p>' }));
    await page.setContent('<div style="height:4000px"></div><div data-wc-map hidden></div>');
    await page.addScriptTag({ content: fs.readFileSync('frontend/public/invite/assets/venue-map.js', 'utf8') });
    await page.evaluate(() => window.WCMap.set({ address: 'Москва', venue: 'Усадьба' }));
    await page.waitForTimeout(200);
    assert.equal(await page.locator('iframe').getAttribute('src'), null, 'Map fetched before approaching its section');
    await page.evaluate(() => { window.WCMap.set({ address: 'Казань' }); window.WCMap.set({ show: false }); });
    assert.equal(await page.locator('iframe').count(), 0, 'Hidden map remains mounted');
    await page.evaluate(() => window.WCMap.set({ address: 'Санкт-Петербург', show: true }));
    await page.locator('[data-wc-map]').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('iframe')?.src.includes(encodeURIComponent('Санкт-Петербург')));
    assert.equal(await page.locator('iframe').count(), 1);
    console.log('Map waits for visibility, uses the latest address, and remounts after hiding.');
    for (const route of ['/invite/index.html', '/invite/garden-evening/index.html']) {
      const videos = [];
      const listener = request => { if (/\/(intro|envelope-wave)\.mp4/.test(request.url())) videos.push(request.url()); };
      page.on('request', listener);
      await page.goto(`${base}${route}?editing=1`, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      assert.equal(videos.length, 0, `${route}: hidden intro fetched in editor`);
      await page.goto(`${base}${route}`, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      assert.ok(videos.length > 0, `${route}: guest intro is missing`);
      page.off('request', listener);
      console.log(`${route}: editor skips intro; guest retains original video.`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
