const fs = require('node:fs/promises');
const path = require('node:path');
const dir = path.resolve(__dirname, '../frontend/public/invite/assets/fonts/google');
async function main() {
  const families = new Set();
  for (const file of (await fs.readdir(dir)).filter(f => f.endsWith('.css'))) {
    const css = await fs.readFile(path.join(dir, file), 'utf8');
    for (const match of css.matchAll(/font-family: '([^']+)'/g)) families.add(match[1]);
  }
  await fs.mkdir(path.join(dir, 'licenses'), { recursive: true });
  for (const family of families) {
    const slug = family.toLowerCase().replace(/[^a-z0-9]/g, '');
    let found = false;
    const urls = [`ofl/${slug}/OFL.txt`, `apache/${slug}/LICENSE.txt`].map(relative => `https://raw.githubusercontent.com/google/fonts/main/${relative}`);
    // Tinos metadata names its upstream, but the Google Fonts copy omits OFL.txt.
    if (slug === 'tinos') urls.push('https://raw.githubusercontent.com/googlefonts/tinos/main/OFL.txt');
    for (const url of urls) {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (response.status === 404) continue;
      if (!response.ok) throw new Error(`${response.status}: ${url}`);
      await fs.writeFile(path.join(dir, 'licenses', `${slug}.txt`), await response.text());
      found = true; break;
    }
    if (!found) throw new Error(`License not found: ${family}`);
  }
  await fs.writeFile(path.join(dir, 'README.md'), '# Local Google Fonts\n\nUnmodified font files from the Google Fonts CSS API. Original stylesheet URLs are recorded at the top of each CSS file. Files are named by content hash and shared between pages. Only the original subset needed by the rendered text is requested (unicode-range).\n\nCopyright and license notices from the [Google Fonts repository](https://github.com/google/fonts) are included in `licenses/`.\n\nTo localize additional stylesheet links, run `node scripts/localize-site-fonts.cjs`, then `node scripts/license-site-fonts.cjs`. Neither script runs during builds.\n');
  console.log(`Included licenses for ${families.size} font families.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
