// Шаблоны глазами гостя на телефоне (390×844): страница без ошибок скриптов, ничего не
// вылезает вбок, анкета после «Отправить» скрывается, а «Спасибо» видно на экране.
// Шаблон открывается сам по себе (/invite/<id>/index.html?intro=0): без адреса сайта пары
// анкета ничего не шлёт на сервер, а сразу показывает «Спасибо» — ровно то, что видит гость.
// Так 28.10.26 нашлась «Тёмная элегантность»: форма оставалась, «Спасибо» было на кнопке.
//   node scripts/check-guest-rsvp.cjs            (нужен next dev на localhost:3000)
//   GUEST_BASE_URL=http://localhost:3210 SHOTS_DIR=out node scripts/check-guest-rsvp.cjs
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.GUEST_BASE_URL || 'http://localhost:3000';
const shots = process.env.SHOTS_DIR || '';
const TEMPLATES = ['tenderness', 'ivory', 'calla', 'forest', 'garden-evening', 'sketch', 'vadimdarya',
  'mediterranean', 'garden-arch', 'vitrage', 'angels', 'floral'];
const routeFor = id => `/invite/${id === 'mediterranean' ? '' : `${id}/`}index.html?intro=0`;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  let failed = 0;
  for (const id of TEMPLATES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
    await ctx.route(/mc\.yandex|api-maps\.yandex|yandex\.ru\/map-widget/, r => r.abort());
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(`JS: ${String(e.message || e).slice(0, 140)}`));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errors.push(`console: ${m.text().slice(0, 140)}`); });
    const problems = [];
    try {
      await page.goto(base + routeFor(id), { waitUntil: 'load', timeout: 120000 });
      await page.waitForTimeout(2000);
      // Вся страница по экранам колесом, как у гостя: многое у шаблонов появляется при прокрутке,
      // и её ничто не должно держать (у «Цветущей арки» до 29.10.26 дальше сердца было не пролистать)
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < height; y += 600) { await page.mouse.wheel(0, 600); await page.waitForTimeout(100); }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) problems.push(`страница шире экрана на ${overflow}px`);

      const form = page.locator('form:has([name="guestName"])').first();
      if (await form.count()) {
        await form.scrollIntoViewIfNeeded();
        await form.locator('[name="guestName"]').fill('Тестовый Гость');
        const yes = form.locator('label:has(input[value="yes"])').first();
        if (await yes.count()) await yes.click({ force: true }).catch(() => {});
        await form.locator('button[type="submit"]').first().click({ force: true });
        await page.waitForTimeout(1500);
        const state = await page.evaluate(() => {
          const shown = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
          const f = [...document.querySelectorAll('form')].find(x => x.querySelector('[name="guestName"]'));
          const t = document.getElementById('rsvpThanks');
          const r = t && t.getBoundingClientRect();
          return { form: shown(f), thanks: shown(t), inView: !!r && r.bottom > 0 && r.top < innerHeight };
        });
        if (state.form) problems.push('анкета не скрылась после отправки');
        if (!state.thanks) problems.push('нет «Спасибо» после отправки');
        else if (!state.inView) problems.push('«Спасибо» за пределами экрана');
        if (shots) await page.screenshot({ path: path.join(shots, `guest-rsvp-${id}.png`) });
      } else problems.push('анкеты нет');
    } catch (e) { problems.push(`проверка упала: ${String(e.message || e).slice(0, 120)}`); }
    problems.push(...errors);
    if (problems.length) failed++;
    console.log(`${problems.length ? 'FAIL' : 'OK  '} ${id.padEnd(15)} ${problems.join('; ')}`);
    await ctx.close();
  }
  await browser.close();
  console.log(failed ? `Шаблонов с проблемами: ${failed}` : 'Все шаблоны в порядке');
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
