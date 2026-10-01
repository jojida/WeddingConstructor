const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const sharp = require('../frontend/node_modules/sharp');
const root = path.resolve(__dirname, '..');
async function samePixels(a, b) {
  const before = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const after = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(before.info.width, after.info.width);
  assert.equal(before.info.height, after.info.height);
  assert.ok(before.data.equals(after.data), 'Decoded pixels differ');
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
async function main() {
  const records = [];
  for (const file of walk(path.join(root, 'frontend/public/invite')).filter(f => f.endsWith('.lossless.webp'))) {
    const before = fs.readFileSync(file.replace('.lossless.webp', '.png'));
    const after = fs.readFileSync(file);
    await samePixels(before, after);
    records.push({ file: path.relative(root, file), before: before.length, after: after.length });
  }
  const files = execFileSync('git', ['-c', 'core.quotePath=false', 'diff', '--name-only', '--', 'frontend/public/invite'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').filter(f => f.endsWith('.svg'));
  for (const file of files) {
    const before = execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, maxBuffer: 30 * 1024 * 1024 }).toString('utf8');
    const after = fs.readFileSync(path.join(root, file), 'utf8');
    const pattern = /data:image\/(?:png|webp);base64,[A-Za-z0-9+/=]+/g;
    assert.equal(before.replace(pattern, 'RASTER'), after.replace(pattern, 'RASTER'), `${file}: vector content changed`);
    const a = [...before.matchAll(pattern)], b = [...after.matchAll(pattern)];
    assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; i++) {
      if (a[i][0] !== b[i][0]) await samePixels(Buffer.from(a[i][0].split(',')[1], 'base64'), Buffer.from(b[i][0].split(',')[1], 'base64'));
    }
    records.push({ file, before: Buffer.byteLength(before), after: Buffer.byteLength(after) });
  }
  const summary = { files: records.length, before: records.reduce((sum, r) => sum + r.before, 0), after: records.reduce((sum, r) => sum + r.after, 0), records };
  fs.mkdirSync(path.join(root, '.checks/performance'), { recursive: true });
  fs.writeFileSync(path.join(root, '.checks/performance/lossless.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, records: undefined }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
