const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const sharp = require('sharp');
const { removeBackground } = require('../dist/lib/backgroundRemoval');
const uploadRouter = require('../dist/routes/upload').default;

const root = path.resolve(__dirname, '..');
const photoPath = path.resolve(root, '../frontend/public/invite/sketch/assets/couple.lossless.webp');
const tmpRoot = path.join(root, '.test-tmp');
fs.mkdirSync(tmpRoot, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpRoot, 'cutout-'));
const outputs = [];
let server;
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const file of outputs) fs.unlinkSync(file);
  assert.equal(path.dirname(tmp), tmpRoot);
  fs.rmSync(tmp, { recursive: true });
});

test('real portrait model keeps both people, RGB and existing transparency', async () => {
  const pending = removeBackground(photoPath);
  await assert.rejects(removeBackground(photoPath), error => error.status === 503);
  const output = await pending;
  const original = await sharp(photoPath).ensureAlpha().raw().toBuffer();
  const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  assert.equal(info.width, 728);
  assert.equal(info.height, 840);
  const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
  assert.ok(alpha(5, 5) < 10, 'background corner must be transparent');
  assert.ok(alpha(320, 500) > 245, 'groom must stay opaque');
  assert.ok(alpha(510, 300) > 245, 'bride must stay opaque');
  // Colour is WebP q95 — visually lossless: on the visible pixels it stays within a few
  // levels of the original (PSNR well above 40 dB); only alpha is computed by the model.
  let squared = 0, counted = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) continue;
    for (let c = 0; c < 3; c++) { const d = data[i + c] - original[i + c]; squared += d * d; counted++; }
  }
  const psnr = 10 * Math.log10(255 * 255 / (squared / counted));
  assert.ok(psnr > 40, `colour must stay visually lossless, PSNR ${psnr.toFixed(1)} dB`);
  const half = Buffer.from(original);
  for (let i = 3; i < half.length; i += 4) half[i] = 128;
  const transparentPath = path.join(tmp, 'transparent.png');
  await sharp(half, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(transparentPath);
  const second = await sharp(await removeBackground(transparentPath)).raw().toBuffer();
  assert.ok(second[(500 * info.width + 320) * 4 + 3] <= 128, 'existing alpha must not be replaced');
});

test('grayscale and EXIF orientation work; large output is bounded', async () => {
  const input = path.join(tmp, 'oriented.jpg');
  await sharp(photoPath).greyscale().resize({ width: 2000 }).jpeg().withMetadata({ orientation: 6 }).toFile(input);
  const output = await removeBackground(input);
  const meta = await sharp(output).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.hasAlpha, true);
  assert.equal(meta.width, 1800);
  assert.ok(meta.height < meta.width, 'EXIF orientation must be applied before matting');
});

test('multipart API produces a WebP cutout and rejects invalid/oversized decoded photos', async () => {
  const app = express();
  app.use('/api/upload', uploadRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = async (bytes, type = 'image/png') => {
    const form = new FormData();
    form.append('image', new Blob([bytes], { type }), 'photo');
    const response = await fetch(base + '/api/upload/remove-background', { method: 'POST', body: form });
    return { status: response.status, body: await response.json() };
  };
  const original = fs.readFileSync(photoPath);
  const success = await send(original, 'image/webp');
  assert.equal(success.status, 200);
  assert.match(success.body.url, /^\/uploads\/[\da-f-]{36}\.webp$/);
  const saved = path.join(root, success.body.url);
  outputs.push(saved);
  assert.equal((await sharp(saved).metadata()).hasAlpha, true);
  assert.deepEqual(fs.readFileSync(photoPath), original, 'the original must remain untouched');
  assert.equal((await send(Buffer.from('not an image'))).status, 400);
  assert.equal((await send(Buffer.from('89504e470d0a1a0a', 'hex'))).status, 400);
  const large = await sharp({ create: { width: 5000, height: 4000, channels: 3, background: '#ccc' } }).png().toBuffer();
  assert.equal((await send(large)).status, 400);
  const retry = await send(original, 'image/webp');
  assert.equal(retry.status, 200, 'input errors must release the worker slot');
  outputs.push(path.join(root, retry.body.url));
});

test('existing upload is cut out by its address; other paths are refused', async () => {
  const app = express();
  app.use('/api/upload', uploadRouter);
  const local = app.listen(0, '127.0.0.1');
  await new Promise(resolve => local.once('listening', resolve));
  const base = `http://127.0.0.1:${local.address().port}`;
  const { uploadsDir } = require('../dist/lib/storage');
  const name = '0b5c3a52-1f6e-4c1e-9d3a-6f1e2b3c4d5e.webp';
  const source = path.join(uploadsDir, name);
  fs.copyFileSync(photoPath, source);
  outputs.push(source);
  const send = (body) => fetch(base + '/api/upload/remove-background/existing', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(async r => ({ status: r.status, body: await r.json() }));
  try {
    const ok = await send({ source: `/uploads/${name}` });
    assert.equal(ok.status, 200);
    assert.match(ok.body.url, /^\/uploads\/[\da-f-]{36}\.webp$/);
    const saved = path.join(uploadsDir, path.basename(ok.body.url));
    outputs.push(saved);
    const meta = await sharp(saved).metadata();
    assert.equal(meta.hasAlpha, true);
    assert.equal(meta.width, 728);
    assert.deepEqual(fs.readFileSync(source), fs.readFileSync(photoPath), 'the original must remain untouched');
    for (const bad of ['/uploads/../package.json', '/uploads/legacy-name.jpg', `/invite/${name}`, 42]) {
      assert.equal((await send({ source: bad })).status, 400, String(bad));
    }
    assert.equal((await send({ source: '/uploads/0b5c3a52-1f6e-4c1e-9d3a-000000000000.jpg' })).status, 404);
    const warm = await fetch(base + '/api/upload/remove-background/warm', { method: 'POST' });
    assert.equal(warm.status, 204);
  } finally {
    await new Promise(resolve => local.close(resolve));
  }
});
