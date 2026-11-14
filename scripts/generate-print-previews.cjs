// Run after npm --prefix backend run build. Previews and paid PDFs share a renderer.
//
// Пишет две версии каждого превью в frontend/public/print:
//   <id>.svg  — точный макет (его показывает редактор, пока не пришло своё превью);
//   <id>.webp — лёгкая картинка для витрины: /print, блок на главной, список заказов.
// В SVG встроены шрифты и фото, файл весит 0,3–3,5 МБ, а на витрине их двенадцать.
// Встроенные в SVG шрифты рисует только браузер, поэтому растр делает Chrome через canvas.
//
//   node scripts/generate-print-previews.cjs              — SVG из рендерера и WebP
//   node scripts/generate-print-previews.cjs --webp-only  — только WebP из готовых SVG
const fs = require('node:fs');
const path = require('node:path');

const destination = path.join(__dirname, '../frontend/public/print');
const WEBP_WIDTH = 560;    // на странице карточка не шире 255 px; вдвое — для плотных экранов
const WEBP_QUALITY = 0.86; // как у остальных картинок проекта (src/studio/assets/ingest.ts)

function writeSvgs() {
  const { PRINT_TEMPLATES, getPrintSample, renderPrintSvg } = require('../backend/dist/lib/printDesign');
  fs.mkdirSync(destination, { recursive: true });
  for (const template of PRINT_TEMPLATES) fs.writeFileSync(path.join(destination, `${template.id}.svg`), renderPrintSvg(template.id, getPrintSample(template.id), true));
}

async function writeWebps() {
  const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    for (const file of fs.readdirSync(destination).filter(name => name.endsWith('.svg')).sort()) {
      const svg = fs.readFileSync(path.join(destination, file), 'utf8');
      const result = await page.evaluate(async ({ svg, width, quality }) => {
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = Math.round(width * image.naturalHeight / image.naturalWidth);
        const context = canvas.getContext('2d');
        // Встроенные шрифты могут подгрузиться чуть позже картинки — рисуем повторно после паузы
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        await new Promise(resolve => setTimeout(resolve, 400));
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        return { data: canvas.toDataURL('image/webp', quality), width: canvas.width, height: canvas.height };
      }, { svg, width: WEBP_WIDTH, quality: WEBP_QUALITY });
      const output = file.replace(/\.svg$/, '.webp');
      const bytes = Buffer.from(result.data.split(',')[1], 'base64');
      fs.writeFileSync(path.join(destination, output), bytes);
      console.log(`${output}: ${result.width}×${result.height}, ${Math.round(bytes.length / 1024)} КБ (SVG ${Math.round(svg.length / 1024)} КБ)`);
    }
  } finally { await browser.close(); }
}

(async () => {
  if (!process.argv.includes('--webp-only')) writeSvgs();
  await writeWebps();
})().catch(error => { console.error(error); process.exitCode = 1; });
