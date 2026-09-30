// Long screenshots for gallery hover scrolling: the card slides a ready image
// instead of booting a live invitation, so there is no intro, flash or loading.
// Run with the frontend dev server up: node scripts/generate-gallery-scrolls.cjs [baseUrl] [id...]
const { chromium } = require('C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp = require('../frontend/node_modules/sharp');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.argv[2] || 'http://localhost:3000';
const ONLY = process.argv.slice(3);
const WIDTH = 480;          // PreviewScale BASE_WIDTH
const HEIGHT = 650;         // one screen of the card
const MAX_HEIGHT = 16000;   // WebP limit is 16383
const OUT = path.join(__dirname, '../frontend/public/gallery-scroll');

const STILL_CSS = `
  *, *::before, *::after {
    animation-duration: .001ms !important; animation-delay: 0s !important;
    animation-iteration-count: 1 !important; transition: none !important;
    scroll-behavior: auto !important; caret-color: transparent !important;
  }
  .rv, .rv-soft, .rv-write, .rv-brush, .reveal, .anim, .fu,
  .fade-up, .fade-soft, .hero-in, .hero__photo {
    opacity: 1 !important; transform: none !important; filter: none !important;
    mask-image: none !important; -webkit-mask-image: none !important;
  }
  html.env-lock, html.env-lock body { overflow: visible !important; height: auto !important; }
  #envelope, #envelope-screen, .env, .hero__live, .wc-music-btn, .music-btn, .wc-music, [data-music-toggle] { display: none !important; }
  ::-webkit-scrollbar { display: none; }
`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/templates`, { waitUntil: 'networkidle' });
  let ids = await page.$$eval('a[href^="/demo/"]', as => [...new Set(as.map(a => a.getAttribute('href').slice(6)))]);
  if (ONLY.length) ids = ids.filter(id => ONLY.includes(id));

  for (const id of ids) {
    await page.goto(`${BASE}/demo/${id}`, { waitUntil: 'load', timeout: 90000 });
    // Demo buttons are part of the page, not of the invitation.
    await page.evaluate(() => document.querySelector('a[href="/templates"]')?.closest('div[style*="fixed"]')?.remove());
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    // Invitations live in a same-origin iframe; some sit behind an envelope in the page.
    let handle = await page.waitForSelector('iframe', { state: 'attached', timeout: 5000 }).catch(() => null);
    if (!handle) {
      await page.mouse.click(WIDTH / 2, HEIGHT / 2);
      handle = await page.waitForSelector('iframe', { state: 'attached', timeout: 20000 });
      await page.waitForTimeout(4000);
    }
    const frame = await handle.contentFrame();
    await frame.waitForLoadState('load');
    await frame.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await frame.addStyleTag({ content: STILL_CSS });
    // Interactive canvases (garden-arch: brush the flower heart to open the date
    // and unlock scrolling) are played through like a guest would.
    const canvases = await frame.$$('canvas');
    for (const canvas of canvases) {
      const size = await canvas.boundingBox();
      if (!size || size.width < 200 || size.height < 200) continue;
      await canvas.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      const box = await canvas.boundingBox();
      for (let pass = 0; pass < 3; pass++) {
        for (let y = box.y + 5; y < box.y + box.height; y += 14) {
          await page.mouse.move(box.x + 2, y);
          await page.mouse.move(box.x + box.width - 2, y, { steps: 12 });
        }
      }
      await page.mouse.move(0, 0);
      await page.waitForTimeout(2500);
    }
    // Walk the page once so scroll-triggered reveals and lazy images fire.
    const total = await frame.evaluate(async ({ max }) => {
      const body = document.body;
      const el = /(auto|scroll)/.test(getComputedStyle(body).overflowY) && body.scrollHeight > body.clientHeight + 10
        ? body : document.scrollingElement;
      window.__scroller = el;
      for (let y = 0; y < Math.min(el.scrollHeight, max); y += 300) {
        el.scrollTo(0, y); await new Promise(r => setTimeout(r, 60));
      }
      await Promise.race([Promise.all([...document.images].map(i => i.decode().catch(() => {}))), new Promise(r => setTimeout(r, 4000))]);
      el.scrollTo(0, 0);
      return Math.min(el.scrollHeight, max);
    }, { max: MAX_HEIGHT });
    await page.waitForTimeout(800);

    const tiles = [];
    for (let y = 0; y < total; y += HEIGHT) {
      const top = Math.min(y, total - HEIGHT);
      await frame.evaluate(t => window.__scroller.scrollTo(0, t), top);
      await page.waitForTimeout(250);
      if (process.env.DEBUG) console.log(top, await frame.evaluate(() => window.__scroller.tagName + " " + window.__scroller.scrollTop));
      tiles.push({ input: await handle.screenshot(), top, left: 0 });
    }
    await sharp({ create: { width: WIDTH, height: total, channels: 3, background: '#ffffff' } })
      .composite(tiles)
      .webp({ quality: 78 })
      .toFile(path.join(OUT, `${id}.webp`));
    console.log(id, total, 'px', Math.round(fs.statSync(path.join(OUT, `${id}.webp`)).size / 1024), 'KB');
  }
  await browser.close();
})();
