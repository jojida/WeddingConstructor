// Картинка превью ссылки (og:image): карточка с именами или своё фото пары, 1200×630 JPEG.
// Отдельная временная база и папка загрузок.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');

const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, '.test-tmp'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(root, '.test-tmp/og-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'og-suite-secret-at-least-32-characters-long';
process.env.DATABASE_URL = `file:${path.join(tmp, 'test.db').replace(/\\/g, '/')}`;
process.env.UPLOADS_DIR = path.join(tmp, 'uploads');
fs.mkdirSync(process.env.UPLOADS_DIR);
const db = new DatabaseSync(path.join(tmp, 'test.db'));
for (const dir of fs.readdirSync(path.join(root, 'prisma/migrations')).sort()) {
  const file = path.join(root, 'prisma/migrations', dir, 'migration.sql');
  if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
}
db.close();

const sharp = require('sharp');
const prisma = require('../dist/lib/prisma').default;
const { cardSvg, ownCoverFile } = require('../dist/lib/ogImage');
const app = express();
app.use('/api/og', require('../dist/routes/og').default);
let server;
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect();
  fs.rmSync(tmp, { recursive: true });
});

test('картинка превью ссылки', async (t) => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (slug) => {
    const res = await fetch(`${base}/api/og/${slug}`);
    return { status: res.status, type: res.headers.get('content-type'), cache: res.headers.get('cache-control'), body: Buffer.from(await res.arrayBuffer()) };
  };
  const user = await prisma.user.create({ data: { email: 'og@example.test' } });
  const mk = (slug, data = {}) => prisma.invitation.create({ data: { userId: user.id, slug, templateId: 'vitrage', status: 'paid', groomName: 'Григорий', brideName: 'Александра', weddingDate: '2027-01-23', ...data } });

  await t.test('опубликованный сайт — карточка 1200×630, черновик и чужой адрес — нет', async () => {
    await mk('og-card');
    await mk('og-draft', { status: 'draft' });
    const r = await get('og-card');
    assert.equal(r.status, 200);
    assert.equal(r.type, 'image/jpeg');
    assert.match(r.cache, /public/);
    const meta = await sharp(r.body).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 1200, 630]);
    assert.equal((await get('og-draft')).status, 404);
    assert.equal((await get('nobody')).status, 404);
  });

  await t.test('своё фото пары на обложке — оно, обрезанное до 1200×630; пример шаблона своим не считается', async () => {
    const file = '0b5a3f3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b.webp';
    await sharp({ create: { width: 800, height: 1200, channels: 3, background: { r: 200, g: 40, b: 40 } } }).webp().toFile(path.join(process.env.UPLOADS_DIR, file));
    await mk('og-photo', { coverPhoto: `/uploads/${file}` });
    const r = await get('og-photo');
    const meta = await sharp(r.body).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 1200, 630]);
    const { dominant } = await sharp(r.body).stats();
    assert.ok(dominant.r > 150 && dominant.g < 90, 'это фото пары, а не карточка');
    assert.equal(ownCoverFile('/invite/vitrage/assets/couple.jpg'), null);
    assert.equal(ownCoverFile('/uploads/../../etc/passwd'), null);
    assert.equal(ownCoverFile('/uploads/0b5a3f3e-1c2d-4e5f-8a9b-000000000000.webp'), null, 'файла нет — карточка');
  });

  await t.test('эмодзи в имени выбрасывается, а не рисуется знаком «?»', () => {
    const plain = cardSvg({ groomName: 'Иван', brideName: 'Мария', weddingDate: '', templateId: 'forest', coverPhoto: '' });
    const emoji = cardSvg({ groomName: 'Иван 💍', brideName: '🎉 Мария', weddingDate: '', templateId: 'forest', coverPhoto: '' });
    assert.equal(emoji, plain);
  });
});
