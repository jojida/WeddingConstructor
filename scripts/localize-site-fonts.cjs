// Run explicitly when adding/changing a Google Fonts stylesheet; never at build time.
// Retains the original faces, weights, styles and unicode ranges, shared across templates.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../frontend');
const dir = path.join(root, 'public/invite/assets/fonts/google');
const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const digest = value => createHash('sha256').update(value).digest('hex').slice(0, 20);
async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': ua }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}
async function main() {
  await fs.mkdir(dir, { recursive: true });
  const invite = path.join(root, 'public/invite');
  const files = [path.join(root, 'src/app/layout.tsx'), path.join(invite, 'index.html')];
  for (const entry of await fs.readdir(invite, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const file = path.join(invite, entry.name, 'index.html');
      try { await fs.access(file); files.push(file); } catch { /* Shared asset directories. */ }
    }
  }
  const downloaded = new Map();
  for (const file of files) {
    let text = await fs.readFile(file, 'utf8');
    // Unused icon font: all current application icons are SVGs.
    text = text.replace(/^.*<link[^>]+fonts\.googleapis\.com\/css2\?family=Material\+Symbols[^>]+\/>\r?\n/gm, '');
    for (const match of [...text.matchAll(/https:\/\/fonts\.googleapis\.com\/css2\?[^"<>]+/g)]) {
      const url = match[0].replace(/&amp;/g, '&');
      let css = (await get(url)).toString('utf8');
      for (const font of new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)\s]+/g))) {
        let filename = downloaded.get(font);
        if (!filename) {
          const bytes = await get(font);
          filename = `${digest(bytes)}${path.extname(new URL(font).pathname)}`;
          await fs.writeFile(path.join(dir, filename), bytes);
          downloaded.set(font, filename);
        }
        css = css.replaceAll(font, `./${filename}`);
      }
      css = `/* Source: ${url} — locally served without changing font faces. */\n${css}`;
      const name = `${digest(css)}.css`;
      await fs.writeFile(path.join(dir, name), css);
      text = text.replaceAll(match[0], `/invite/assets/fonts/google/${name}`);
    }
    text = text.replace(/^.*<link[^>]+rel="preconnect"[^>]+https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>\r?\n/gm, '');
    await fs.writeFile(file, text);
  }
  console.log(`Localized fonts in ${files.length} documents; ${downloaded.size} shared font files.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
