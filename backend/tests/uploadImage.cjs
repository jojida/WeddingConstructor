const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { normalizeUploadImage, InvalidUploadImage } = require('../dist/lib/uploadImage');
const { compressStoredUploads } = require('../dist/lib/compressUploads');
const tmpRoot = path.resolve(__dirname, '../.test-tmp');
fs.mkdirSync(tmpRoot, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpRoot, 'image-validation-'));
after(() => { assert.equal(path.dirname(tmp), tmpRoot); fs.rmSync(tmp, { recursive: true }); });

// A photo-like picture (smooth gradient + noise) — flat colour would compress to nothing.
async function photo(width, height, { alpha = false } = {}) {
  const channels = alpha ? 4 : 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let y = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i += channels) {
      raw[i] = (x * 255 / width + Math.random() * 40) | 0;
      raw[i + 1] = (y * 255 / height + Math.random() * 40) | 0;
      raw[i + 2] = ((x + y) % 256 + Math.random() * 40) & 255;
      if (alpha) raw[i + 3] = x < width / 2 ? 255 : 0;
    }
  }
  return sharp(raw, { raw: { width, height, channels } });
}

test('published image drops private metadata and appended payload, applies orientation', async () => {
  const bytes = await sharp({ create: { width: 4, height: 2, channels: 3, background: '#aaccee' } })
    .jpeg().withMetadata({ orientation: 6 }).withExifMerge({ IFD0: { Artist: 'private-author' } }).toBuffer();
  const input = path.join(tmp, 'metadata.jpg');
  fs.writeFileSync(input, Buffer.concat([bytes, Buffer.from('<script>private-payload</script>')]));
  const { data: output, ext } = await normalizeUploadImage(input, 'image/jpeg');
  assert.equal(ext, '.jpg');
  const meta = await sharp(output).metadata();
  assert.equal(meta.width, 2); assert.equal(meta.height, 4);
  assert.equal(meta.exif, undefined); assert.equal(meta.icc, undefined); assert.equal(meta.xmp, undefined);
  assert.equal(output.includes(Buffer.from('private-author')), false);
  assert.equal(output.includes(Buffer.from('private-payload')), false);
});

test('signature-only, wrong format and excessive decoded dimensions are rejected', async () => {
  const input = path.join(tmp, 'invalid.png');
  fs.writeFileSync(input, Buffer.from('89504e470d0a1a0a', 'hex'));
  await assert.rejects(normalizeUploadImage(input, 'image/png'), InvalidUploadImage);
  await sharp({ create: { width: 10, height: 10, channels: 3, background: '#ccc' } }).png().toFile(input);
  await assert.rejects(normalizeUploadImage(input, 'image/jpeg'), InvalidUploadImage);
  await sharp({ create: { width: 5001, height: 5000, channels: 3, background: '#ccc' } }).png().toFile(input);
  await assert.rejects(normalizeUploadImage(input, 'image/png'), InvalidUploadImage);
});

test('animated images keep frames, timing and transparency', async () => {
  const input = path.join(tmp, 'animated.gif');
  await sharp(Buffer.from([
    255, 0, 0, 255, 0, 0, 0, 0,
    0, 255, 0, 255, 0, 0, 0, 0,
  ]), { raw: { width: 2, height: 2, channels: 4, pageHeight: 1 } })
    .gif({ loop: 0, delay: [100, 200] }).toFile(input);
  const { data: output, ext } = await normalizeUploadImage(input, 'image/gif');
  assert.equal(ext, '.gif');
  const meta = await sharp(output, { animated: true }).metadata();
  assert.equal(meta.pages, 2); assert.equal(meta.pageHeight, 1);
  assert.deepEqual(meta.delay, [100, 200]); assert.equal(meta.hasAlpha, true);
});

test('large photos shrink to 2000 px (print uploads to 2400 px), small ones keep their size', async () => {
  const input = path.join(tmp, 'large.jpg');
  await (await photo(3000, 2000)).jpeg({ quality: 95 }).toFile(input);
  const web = await normalizeUploadImage(input, 'image/jpeg');
  const webMeta = await sharp(web.data).metadata();
  assert.equal(web.ext, '.jpg');
  assert.deepEqual([webMeta.width, webMeta.height], [2000, 1333]);
  assert.ok(web.data.length < fs.statSync(input).size / 2);
  const print = await normalizeUploadImage(input, 'image/jpeg', { maxSide: 2400, quality: 90 });
  const printMeta = await sharp(print.data).metadata();
  assert.deepEqual([printMeta.width, printMeta.height], [2400, 1600]);
  const small = path.join(tmp, 'small.jpg');
  await (await photo(640, 480)).jpeg().toFile(small);
  const smallMeta = await sharp((await normalizeUploadImage(small, 'image/jpeg')).data).metadata();
  assert.deepEqual([smallMeta.width, smallMeta.height], [640, 480]);
});

test('opaque PNG becomes JPEG, transparent PNG and WebP keep format and alpha', async () => {
  const opaque = path.join(tmp, 'opaque.png');
  await (await photo(2600, 1300)).png().toFile(opaque);
  const fromOpaque = await normalizeUploadImage(opaque, 'image/png');
  assert.equal(fromOpaque.ext, '.jpg');
  const opaqueMeta = await sharp(fromOpaque.data).metadata();
  assert.equal(opaqueMeta.format, 'jpeg'); assert.equal(opaqueMeta.width, 2000);

  const icon = path.join(tmp, 'icon.png');
  await sharp({ create: { width: 256, height: 256, channels: 3, background: '#335577' } }).png().toFile(icon);
  assert.equal((await normalizeUploadImage(icon, 'image/png')).ext, '.png');

  const cutout = path.join(tmp, 'cutout.png');
  await (await photo(600, 400, { alpha: true })).png().toFile(cutout);
  const fromCutout = await normalizeUploadImage(cutout, 'image/png');
  assert.equal(fromCutout.ext, '.png');
  assert.equal((await sharp(fromCutout.data).metadata()).hasAlpha, true);

  const webp = path.join(tmp, 'cutout.webp');
  await (await photo(2400, 1200, { alpha: true })).webp().toFile(webp);
  const fromWebp = await normalizeUploadImage(webp, 'image/webp');
  const webpMeta = await sharp(fromWebp.data).metadata();
  assert.equal(fromWebp.ext, '.webp');
  assert.equal(webpMeta.hasAlpha, true); assert.equal(webpMeta.width, 2000);
});

test('stored uploads above 2400 px are shrunk in place once, originals kept aside', async () => {
  const dir = fs.mkdtempSync(path.join(tmp, 'stored-'));
  const big = '0b6f1c2e-1111-4a2b-8c3d-123456789abc.jpg';
  const print = '0b6f1c2e-2222-4a2b-8c3d-123456789abc.jpg';
  const small = '0b6f1c2e-3333-4a2b-8c3d-123456789abc.webp';
  const mislabeled = '0b6f1c2e-4444-4a2b-8c3d-123456789abc.png';
  await (await photo(3200, 2400)).jpeg({ quality: 90 }).toFile(path.join(dir, big));
  await (await photo(2400, 1800)).jpeg({ quality: 90 }).toFile(path.join(dir, print));
  await (await photo(800, 600)).webp().toFile(path.join(dir, small));
  await (await photo(3000, 2000)).jpeg().toFile(path.join(dir, mislabeled));
  const before = Object.fromEntries([big, print, small, mislabeled].map(n => [n, fs.readFileSync(path.join(dir, n))]));

  const result = await compressStoredUploads(dir, { pauseMs: 0 });
  assert.equal(result.checked, 4); assert.equal(result.compressed, 1);
  const bigMeta = await sharp(fs.readFileSync(path.join(dir, big))).metadata();
  assert.equal(bigMeta.format, 'jpeg'); assert.deepEqual([bigMeta.width, bigMeta.height], [2000, 1500]);
  assert.ok(fs.statSync(path.join(dir, big)).size < before[big].length / 2);
  assert.deepEqual(fs.readFileSync(path.join(dir, '.originals', big)), before[big]);
  for (const name of [print, small, mislabeled]) assert.deepEqual(fs.readFileSync(path.join(dir, name)), before[name]);
  assert.deepEqual(fs.readdirSync(dir).filter(n => n.endsWith('.tmp')), []);
  assert.ok(fs.existsSync(path.join(dir, '.compressed-v1')));
  assert.equal(await compressStoredUploads(dir, { pauseMs: 0 }), null);
});
