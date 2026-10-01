// Lossless transport optimization. Originals, dimensions and alpha are retained.
// A replacement is used only if its decoded RGBA pixels match exactly.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('../frontend/node_modules/sharp');
const root = path.resolve(__dirname, '../frontend');
const publicRoot = path.join(root, 'public');
async function write(file, data) {
  for (let attempt = 0; ; attempt++) {
    try { await fs.writeFile(file, data); return; }
    catch (error) {
      if (attempt >= 6 || !['UNKNOWN', 'EPERM', 'EBUSY'].includes(error.code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
}
async function walk(dir) {
  const result = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(file));
    else if (/\.(?:html|css|js|tsx?|svg)$/.test(file)) result.push(file);
  }
  return result;
}
async function lossless(input) {
  const bytes = await sharp(input).webp({ lossless: true, effort: 6 }).toBuffer();
  if (bytes.length >= input.length * .95) return null;
  const a = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (a.info.width !== b.info.width || a.info.height !== b.info.height || !a.data.equals(b.data)) return null;
  return bytes;
}
async function main() {
  const files = [...await walk(path.join(root, 'src')), ...await walk(path.join(publicRoot, 'invite')), ...await walk(path.join(publicRoot, 'print'))];
  const cache = new Map(); const report = [];
  for (const file of files) {
    let text = await fs.readFile(file, 'utf8'); const initial = text;
    // Only literal local asset references; no user uploads or original artwork.
    for (const match of [...text.matchAll(/(?:\/invite\/|(?:\.\.\/)?assets\/|images\/)[^'"()\s<>`]+\.png/g)]) {
      const url = match[0];
      const asset = url.startsWith('/') ? path.join(publicRoot, url) : path.resolve(path.dirname(file), url);
      if (!asset.startsWith(publicRoot + path.sep)) continue;
      if (!cache.has(asset)) {
        try {
          const original = await fs.readFile(asset); const output = await lossless(original);
          if (output) {
            await write(asset.replace(/\.png$/, '.lossless.webp'), output);
            report.push({ asset: path.relative(root, asset), before: original.length, after: output.length });
          }
          cache.set(asset, !!output);
        } catch (error) { if (error.code === 'ENOENT') cache.set(asset, false); else throw error; }
      }
      if (cache.get(asset)) text = text.replaceAll(url, url.replace(/\.png$/, '.lossless.webp'));
    }
    // Keep vector shapes/text intact, optimize only embedded PNG payloads in SVG.
    if (file.endsWith('.svg')) {
      for (const match of [...text.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)]) {
        const original = Buffer.from(match[1], 'base64');
        if (original.length < 20000) continue;
        const output = await lossless(original);
        if (output) {
          text = text.replaceAll(match[0], `data:image/webp;base64,${output.toString('base64')}`);
        }
      }
      if (text.length < initial.length) report.push({ asset: path.relative(root, file), before: Buffer.byteLength(initial), after: Buffer.byteLength(text) });
    }
    if (text !== initial) await write(file, text);
  }
  await fs.mkdir(path.resolve(__dirname, '../.checks'), { recursive: true });
  await fs.writeFile(path.resolve(__dirname, '../.checks/lossless-images.json'), JSON.stringify(report, null, 2));
  const before = report.reduce((sum, x) => sum + x.before, 0), after = report.reduce((sum, x) => sum + x.after, 0);
  console.log(JSON.stringify({ assets: report.length, before, after, saved: before - after }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
