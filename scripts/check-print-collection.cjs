const { chromium } = require('C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const { renderPrintSvg, PRINT_SAMPLE } = require('../backend/dist/lib/printDesign');
(async () => {
  fs.mkdirSync('output/print', { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 2750, height: 800 } });
  const ids = ['floral-gold', 'newspaper', 'petals', 'editorial', 'boarding'];
  await page.setContent('<body style="margin:0;display:flex;gap:20px;padding:20px;background:#ddd">' + ids.map(id => renderPrintSvg(id, PRINT_SAMPLE, false).replace(/width="105mm" height="148mm"/, 'width="525" height="740"')).join('') + '</body>');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'output/print/collection.png' });
  const overflow = await page.locator('svg').evaluateAll(svgs => svgs.flatMap((svg, index) => [...svg.querySelectorAll('text')].filter(t => { const b = t.getBBox(); return b.x < 20 || b.x + b.width > 508 || b.y < 0 || b.y + b.height > 730; }).map(t => ({ index, text: t.textContent }))));
  if (overflow.length) throw new Error(JSON.stringify(overflow));
  console.log('All illustrated layouts remain inside the print area.');
  const longData = { ...PRINT_SAMPLE, groom: 'Александра-Константиновна', bride: 'Анастасия-Александровна', message: 'ШИРОКИЕ СЛОВА ПРИГЛАШЕНИЯ '.repeat(10).slice(0, 220), venue: 'Место проведения свадьбы с очень длинным названием и описанием', address: 'Московская область, городской округ Красногорск, посёлок Архангельское, Центральная, 12' };
  await page.setContent('<body style="margin:0;display:flex;gap:20px;padding:20px">' + ids.map(id => renderPrintSvg(id, longData, false).replace(/width="105mm" height="148mm"/, 'width="525" height="740"')).join('') + '</body>');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'output/print/long-text.png' });
  if (process.argv.includes('--ui')) {
    await page.route('**/api/**', route => {
      if (route.request().url().endsWith('/api/print/preview')) {
        const data = route.request().postDataJSON();
        return route.fulfill({ contentType: 'image/svg+xml', body: renderPrintSvg(data.templateId, data.data) });
      }
      return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('http://localhost:3010/print');
    await page.getByRole('button', { name: 'Путешествия', exact: true }).click();
    if (await page.locator('a[href="/print/editor?template=boarding"]').count() !== 1) throw new Error('Travel filter failed');
    await page.getByRole('button', { name: 'Редакционный', exact: true }).click();
    if (await page.locator('a[href^="/print/editor?template="]').count() !== 2) throw new Error('Editorial filter failed');
    await page.getByRole('button', { name: 'Все дизайны', exact: true }).click();
    if (await page.locator('a[href^="/print/editor?template="]').count() !== 12) throw new Error('Catalog missing designs');
    await page.locator('#collection').screenshot({ path: 'output/print/catalog-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#collection').screenshot({ path: 'output/print/catalog-mobile.png' });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile overflow');
    await page.goto('http://localhost:3010/print/editor?template=floral-gold');
    if (await page.getByLabel('Имя жениха').inputValue() !== 'Даниил') throw new Error('Template sample missing');
    await page.getByLabel('Имя жениха').fill('Михаил');
    await page.waitForFunction(() => [...document.images].some(img => img.src.startsWith('blob:') && img.complete && img.naturalWidth > 0));
    console.log('Catalog filters, mobile width and editable preview passed (local preview API fixture).');
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
