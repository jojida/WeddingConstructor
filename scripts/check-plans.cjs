const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { TEMPLATE_FIELDS, TEMPLATE_DEFAULTS, templateCustomDefaults } = require('../frontend/src/lib/constants.ts');
const { FREE_LOCKED_SECTIONS } = require('../frontend/src/lib/plans.ts');
const base = process.env.PLANS_BASE_URL || 'http://localhost:3000';
const out = path.resolve(__dirname, '../.checks/plans');
fs.mkdirSync(out, { recursive: true });
const draft = (templateId, plan = 'free', status = 'draft') => ({
  id: 'plans-fixture', slug: 'plans-fixture', templateId, plan, status,
  ...TEMPLATE_DEFAULTS[templateId], groomName: 'Иван', brideName: 'Анна', weddingDate: '2027-07-17', weddingTime: '15:00',
  enabledSections: {}, galleryPhotos: [],
  customData: { ...templateCustomDefaults(templateId, '2027-07-17'), __seededTemplate: templateId, __musicSeeded: true },
});

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 960 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));
      await page.route('https://yandex.ru/**', r => r.fulfill({ contentType: 'text/html', body: '<p>Карта</p>' }));
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.querySelector('#pricing').scrollIntoView({ behavior: 'instant', block: 'start' }));
      await page.waitForFunction(() => Array.from(document.querySelectorAll('#pricing [data-animate]')).filter(el => el.getBoundingClientRect().top < innerHeight).every(el => getComputedStyle(el).opacity === '1'));
      for (const name of ['Бесплатный', 'Премиум', 'Максимум']) assert.equal(await page.locator('#pricing').getByText(name, { exact: true }).count(), 1);
      assert.equal(await page.locator('#pricing').getByText('3 990', { exact: true }).count(), 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'лендинг выходит за экран');
      await page.screenshot({ path: path.join(out, `pricing-${width}.png`) });

      for (const id of Object.keys(TEMPLATE_FIELDS)) {
        const dir = id === 'mediterranean' ? '' : `${id}/`;
        await page.goto(`${base}/invite/${dir}index.html?editing=1`, { waitUntil: 'load' });
        await page.waitForFunction(() => !!window.WCSections);
        const data = draft(id);
        await page.evaluate(data => window.postMessage({ type: 'wc:data', payload: { ...data.customData, ...data } }, location.origin), data);
        await page.waitForFunction(() => !window.WCSections.enabled('venue'));
        for (const section of FREE_LOCKED_SECTIONS) {
          const visible = await page.locator(`[data-wc-section="${section}"]:visible`).count();
          assert.equal(visible, 0, `${id}@${width}: бесплатный показывает ${section}`);
        }
        for (const section of ['cover', 'date', 'closing']) assert.ok(await page.locator(`[data-wc-section="${section}"]:visible`).count(), `${id}: скрыт ${section}`);
        await page.evaluate(() => window.postMessage({ type: 'wc:data', payload: { plan: 'premium', enabledSections: {} } }, location.origin));
        await page.waitForFunction(() => window.WCSections.enabled('venue'));
        assert.equal(await page.locator('[data-wc-section="menu"]:visible').count(), 0, 'Премиум показывает меню');
        await page.evaluate(() => window.postMessage({ type: 'wc:data', payload: { plan: 'maximum', enabledSections: {} } }, location.origin));
        await page.waitForFunction(() => window.WCSections.enabled('menu'));
        assert.equal(await page.locator('.wc-section-hidden').count(), 0, `${id}: Максимум не восстановил блоки`);
      }
      assert.deepEqual(errors, [], `ошибки шаблонов @${width}`);
      console.log(`Тарифы и ${Object.keys(TEMPLATE_FIELDS).length} шаблонов @${width}: доступ и восстановление проверены.`);
      await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    let invite = draft('calla', 'free', 'published');
    let submittedPlan = '';
    let confirmedPlan = 'premium';
    await context.addInitScript(() => localStorage.setItem('wc_token', 'plans-fixture-token'));
    await context.route('**/api/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      let body = {};
      if (pathname === '/api/auth/me') body = { id: 'plans-owner', email: 'plans@example.test', free: false, planner: true };
      else if (pathname.startsWith('/api/invites/')) body = invite;
      else if (pathname === '/api/payment/create') {
        submittedPlan = route.request().postDataJSON().plan;
        body = { free: true, redirectUrl: `${base}/payment/success?id=plans-fixture&plan=${submittedPlan}` };
      } else if (pathname.startsWith('/api/payment/public-status/')) body = { paid: true, plan: confirmedPlan, slug: invite.slug, paymentStatus: confirmedPlan === 'maximum' ? 'succeeded' : 'pending' };
      await route.fulfill({ json: body, headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    await page.goto(`${base}/editor?id=plans-fixture`, { waitUntil: 'networkidle' });
    for (const title of ['Место проведения', 'Карта', 'Программа дня', 'Дресс-код', 'Анкета гостя']) {
      const control = page.getByRole('switch', { name: `${title}: показывать на сайте`, exact: true });
      assert.equal(await control.isDisabled(), true, title);
      assert.equal(await control.getAttribute('aria-checked'), 'false', title);
    }
    await page.frameLocator('iframe').first().locator('[data-wc-section="venue"]').waitFor({ state: 'hidden' });
    invite = draft('calla', 'premium', 'paid');
    await page.goto(`${base}/payment?id=plans-fixture`, { waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('button', { name: 'Доплатить 1 500 ₽' }).count(), 1);
    await page.screenshot({ path: path.join(out, 'payment-upgrade.png') });
    await page.goto(`${base}/payment/success?id=plans-fixture&plan=maximum`, { waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('heading', { name: 'Оплата прошла!' }).count(), 0, 'улучшение подтверждено до оплаты');
    confirmedPlan = 'maximum';
    await page.getByRole('heading', { name: 'Оплата прошла!' }).waitFor();
    invite = { ...draft('calla'), venue: '', venueAddress: '' };
    await page.goto(`${base}/payment?id=plans-fixture`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Оплатить 2 490 ₽' }).click();
    await page.getByText('Укажите место и адрес свадьбы в редакторе перед подключением платного тарифа', { exact: true }).waitFor();
    assert.equal(submittedPlan, '', 'платный тариф оплатился без места');
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${base}/payment?id=plans-fixture`, { waitUntil: 'networkidle' });
      await page.locator('#plan-free').click();
      assert.equal(await page.getByRole('button', { name: 'Опубликовать бесплатно' }).count(), 1);
      await page.screenshot({ path: path.join(out, `payment-${width}.png`), fullPage: true });
      const overflow = await page.evaluate(() => Array.from(document.querySelectorAll('body *')).filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, cls: el.className, right: el.getBoundingClientRect().right, text: el.textContent.slice(0, 50) })));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `оплата выходит за экран @${width}: ${JSON.stringify(overflow.slice(-8))}`);
    }
    confirmedPlan = 'free';
    await page.getByRole('button', { name: 'Опубликовать бесплатно' }).click();
    await page.getByRole('heading', { name: 'Сайт опубликован!' }).waitFor();
    assert.equal(submittedPlan, 'free');
    console.log('Редактор, доплата, ожидание подтверждения и бесплатная публикация: проверены.');
    await context.close();
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
