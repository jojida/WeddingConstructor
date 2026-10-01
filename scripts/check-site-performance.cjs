// Production smoke/performance checks. All third-party traffic is isolated;
// baseline invitation HTML/assets come from HEAD, not from a live customer site.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const base = process.env.PERF_BASE_URL || 'http://localhost:3210';
const output = path.join(root, '.checks/performance');
fs.mkdirSync(output, { recursive: true });
const oldCache = new Map();
function original(file) {
  if (!oldCache.has(file)) {
    try { oldCache.set(file, execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, maxBuffer: 30 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })); }
    catch { oldCache.set(file, null); }
  }
  return oldCache.get(file);
}
const fontUrls = new Map();
const fontDir = path.join(root, 'frontend/public/invite/assets/fonts/google');
for (const file of fs.readdirSync(fontDir).filter(f => f.endsWith('.css'))) {
  const source = fs.readFileSync(path.join(fontDir, file), 'utf8').match(/Source: (\S+)/)?.[1];
  if (source) fontUrls.set(source, `/invite/assets/fonts/google/${file}`);
}
async function setup(browser, baseline, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) {
      // Keep external analytics/maps/API from changing repeatability or writing data.
      return route.fulfill({ status: url.pathname.includes('/api/') ? 401 : 200, contentType: 'text/plain', body: '' });
    }
    if (baseline && url.pathname.startsWith('/invite/') && /\.(html|css|js|svg|png)$/.test(url.pathname) && !url.pathname.includes('/fonts/google/')) {
      const relative = `frontend/public${decodeURIComponent(url.pathname)}`;
      let body = original(relative);
      if (body) {
        if (url.pathname.endsWith('.html')) {
          let html = body.toString('utf8');
          // Same local fonts in both passes: isolate image scheduling/size changes.
          for (const [source, local] of fontUrls) html = html.replaceAll(source, local);
          body = Buffer.from(html);
        }
        const types = { html: 'text/html', css: 'text/css', js: 'application/javascript', svg: 'image/svg+xml', png: 'image/png' };
        return route.fulfill({ contentType: types[url.pathname.split('.').pop()], body });
      }
    }
    return route.continue();
  });
  return context;
}
async function checkTemplate(browser, name, baseline) {
  const context = await setup(browser, baseline, { width: Number(process.env.PERF_WIDTH || 390), height: 844 });
  const page = await context.newPage(); const errors = []; const failures = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
  const url = name === 'mediterranean' ? '/invite/index.html' : `/invite/${name}/index.html`;
  await page.goto(`${base}${url}?editing=1`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' });
  await page.waitForTimeout(800);
  const first = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource').filter(r => r.name.startsWith(location.origin));
    return { requests: resources.length, bytes: resources.reduce((n, r) => n + r.decodedBodySize, 0), images: [...document.images].filter(i => i.complete && i.naturalWidth).length };
  });
  // Native lazy loading must still fetch every image when it comes into view.
  for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += 400) {
    await page.evaluate(y => scrollTo(0, y), y); await page.waitForTimeout(80);
  }
  // Horizontal carousels intentionally defer slides beyond their clipped area.
  // Visit those slides too, then restore the original position for comparison.
  for (const track of await page.locator('.carousel__track').all()) {
    await track.scrollIntoViewIfNeeded();
    for (const slide of await track.locator('img').all()) {
      if (await slide.isVisible()) { await slide.scrollIntoViewIfNeeded(); await page.waitForTimeout(150); }
    }
    await track.evaluate(el => { el.scrollLeft = 0; });
  }
  await page.waitForTimeout(1000);
  const broken = await page.evaluate(() => [...document.images].filter(i => i.getAttribute('src') && !i.getAttribute('src').startsWith('data:') && (!i.complete || !i.naturalWidth) && i.getBoundingClientRect().width > 0 && i.getBoundingClientRect().height > 0).map(i => i.getAttribute('src')));
  const geometry = await page.evaluate(() => [...document.images].filter(i => !i.hasAttribute('data-edit')).map(i => {
    const r = i.getBoundingClientRect(); return { src: i.getAttribute('src').replace('.lossless.webp', '.png'), x: r.x, y: r.y + scrollY, width: r.width, height: r.height };
  }));
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, `${name}-${process.env.PERF_WIDTH || 390}-${baseline ? 'before' : 'after'}.png`) });
  await context.close();
  return { first, broken, errors, failures, geometry };
}
async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const results = {};
    if (!process.argv.includes('--pages-only')) {
      const names = process.env.PERF_TEMPLATES ? process.env.PERF_TEMPLATES.split(',') : ['mediterranean', 'calla', 'sketch', 'floral', 'garden-arch', 'vadimdarya', 'ivory', 'garden-evening', 'forest'];
      for (const name of names) {
        const before = await checkTemplate(browser, name, true);
        const after = await checkTemplate(browser, name, false);
        const geometryChanges = after.geometry.flatMap((img, i) => {
          const old = before.geometry[i];
          return old && ['x', 'y', 'width', 'height'].some(k => Math.abs(img[k] - old[k]) > 2) ? [{ before: old, after: img }] : [];
        });
        results[name] = { before: before.first, after: after.first, broken: after.broken, errors: after.errors, failures: after.failures, geometryChanges, baselineErrors: before.errors, baselineFailures: before.failures };
        console.log(name, JSON.stringify({ before: before.first, after: after.first, broken: after.broken, errors: after.errors, newFailures: after.failures.filter(f => !before.failures.includes(f)), geometryChanges: geometryChanges.length }));
      }
      const resultFile = path.join(output, `templates-${process.env.PERF_WIDTH || 390}.json`);
      const previous = process.env.PERF_TEMPLATES && fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, 'utf8')) : {};
      fs.writeFileSync(resultFile, JSON.stringify({ ...previous, ...results }, null, 2));
      assert.ok(Object.values(results).every(r => r.broken.length === 0 && r.failures.every(f => r.baselineFailures.includes(f))), 'New broken invitation resources');
      assert.ok(Object.values(results).every(r => r.errors.length === 0), 'Invitation JavaScript errors');
      assert.ok(Object.values(results).every(r => r.geometryChanges.length === 0), 'Invitation layout changed');
    }
    if (process.argv.includes('--pages-only')) {
      for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
        const context = await setup(browser, false, viewport);
        const page = await context.newPage();
        for (const route of ['/', '/templates', '/print', '/editor?template=calla', '/print/editor?template=floral-gold', '/auth', '/dashboard', '/payment', '/payment/success', '/print/orders', '/oferta', '/privacy', '/demo/forest', '/demo/garden-evening']) {
          const errors = []; const listener = e => errors.push(e.message); page.on('pageerror', listener);
          const response = await page.goto(base + route, { waitUntil: 'load' });
          await page.waitForTimeout(750);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
          assert.equal(response.status(), 200, route);
          assert.deepEqual(errors, [], `${route}: JS errors`);
          assert.equal(overflow, false, `${route}: horizontal overflow`);
          console.log(viewport.width, route, 'OK');
          page.off('pageerror', listener);
        }
        await context.close();
      }
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
