const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { normalizeUploadImage, InvalidUploadImage } = require('../dist/lib/uploadImage');
const tmpRoot = path.resolve(__dirname, '../.test-tmp');
fs.mkdirSync(tmpRoot, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpRoot, 'image-validation-'));
after(() => { assert.equal(path.dirname(tmp), tmpRoot); fs.rmSync(tmp, { recursive: true }); });

test('published image drops private metadata and appended payload, applies orientation', async () => {
  const bytes = await sharp({ create: { width: 4, height: 2, channels: 3, background: '#aaccee' } })
    .jpeg().withMetadata({ orientation: 6 }).withExifMerge({ IFD0: { Artist: 'private-author' } }).toBuffer();
  const input = path.join(tmp, 'metadata.jpg');
  fs.writeFileSync(input, Buffer.concat([bytes, Buffer.from('<script>private-payload</script>')]));
  const output = await normalizeUploadImage(input, 'image/jpeg');
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
  const output = await normalizeUploadImage(input, 'image/gif');
  const meta = await sharp(output, { animated: true }).metadata();
  assert.equal(meta.pages, 2); assert.equal(meta.pageHeight, 1);
  assert.deepEqual(meta.delay, [100, 200]); assert.equal(meta.hasAlpha, true);
});
