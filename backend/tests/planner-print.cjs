// Печатные материалы планировщика: вёрстка (кириллица, длинные имена, перенос, многостраничность,
// никакого питания в материалах для гостей) и сами PDF через HTTP на отдельной временной базе.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const jwt = require('jsonwebtoken');

const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, '.test-tmp'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(root, '.test-tmp/planner-print-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'planner-print-suite-secret-at-least-32-chars';
process.env.DATABASE_URL = `file:${path.join(tmp, 'test.db').replace(/\\/g, '/')}`;
for (const key of ['BREVO_API_KEY', 'SMTP_USER', 'SMTP_PASS', 'TELEGRAM_BOT_TOKEN', 'YOOKASSA_SHOP_ID', 'YOOKASSA_SECRET_KEY', 'PLANNER_PUBLIC']) process.env[key] = '';
process.env.FREE_ACCOUNTS = 'print-owner@example.test';
const db = new DatabaseSync(path.join(tmp, 'test.db'));
for (const dir of fs.readdirSync(path.join(root, 'prisma/migrations')).sort()) {
  const file = path.join(root, 'prisma/migrations', dir, 'migration.sql');
  if (fs.existsSync(file)) db.exec(fs.readFileSync(file, 'utf8'));
}
db.close();

const prisma = require('../dist/lib/prisma').default;
const docs = require('../dist/lib/planner/print/docs');
const { measure, printable, runs } = require('../dist/lib/planner/print/fonts');
const { THEMES, themeFor } = require('../dist/lib/planner/print/themes');
const { russianDate, tableTitle } = require('../dist/lib/planner/print/data');
const app = require('../dist/index').default;
let server;
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await prisma.$disconnect();
  fs.rmSync(tmp, { recursive: true });
});

/* ── Данные для вёрстки ─────────────────────────────────────────────────── */
const LONG = 'Константин Александрович Римский-Корсаков-Новосёлов-Щербатов из старинного рода';
function makeData(people, over = {}) {
  const tables = [
    { id: 't1', name: '1', title: 'Стол 1', capacity: 10 },
    { id: 't2', name: '2', title: 'Стол 2', capacity: 10 },
    { id: 't3', name: 'Молодожёны', title: 'Молодожёны', capacity: 4 },
  ];
  return {
    couple: 'Андрей & Екатерина', date: '19 июня 2027', theme: THEMES[0], tables,
    tableById: new Map(tables.map((t) => [t.id, t])),
    options: [{ id: 'm', label: 'Мясное', note: 'Говядина' }, { id: 'f', label: 'Рыбное', note: '' }],
    people, ...over,
  };
}
const person = (i, over = {}) => ({
  id: `p${i}`, name: `Гость Номер ${i}`, partyLabel: `Семья ${i}`, tableId: 't1', isChild: false, status: 'yes',
  menu: 'Мясное', menuReview: false, diet: '', order: i, ...over,
});

/** Все строки документа, включая перевёрнутые половинки «домиков». */
function texts(doc) {
  const out = [];
  const walk = (items) => { for (const it of items) { if (it.kind === 'text') out.push(it); if (it.kind === 'flip') walk(it.items); } };
  for (const p of doc.pages) walk(p.items);
  return out;
}
/** Ни одна строка не шире своей рамки и не выходит за страницу — значит, ничего не обрезано. */
function assertFits(doc) {
  const [w, h] = doc.size;
  for (const t of texts(doc)) {
    const width = measure(t.text, t.family, t.size) + (t.spacing || 0) * Math.max(0, [...t.text].length - 1);
    assert.ok(width <= t.width + 0.5, `«${t.text}» (${width.toFixed(1)}) шире рамки ${t.width.toFixed(1)}`);
    assert.ok(t.x >= -0.5 && t.x + t.width <= w + 0.5, `«${t.text}» за краем страницы по ширине`);
    assert.ok(t.y > 0 && t.y <= h, `«${t.text}» за краем страницы по высоте (y=${t.y.toFixed(1)})`);
  }
}
const joined = (doc) => texts(doc).map((t) => t.text).join('\n');

test('шрифты: кириллица и латиница печатаются своими файлами, чужие буквы не превращаются в квадратики', () => {
  assert.deepEqual(runs('Стол 5 «Мясное»').map((r) => [r.text, r.cyr]), [['Стол ', true], ['5 «', false], ['Мясное', true], ['»', false]]);
  assert.equal(printable('Şeyma Öztürk', 'serif'), 'Seyma Öztürk');
  assert.equal(printable('Анна 🎉', 'serif'), 'Анна ?');
  assert.ok(measure('Анна', 'serif', 20) > measure('Анна', 'serif', 10));
  assert.equal(russianDate('2027-06-19'), '19 июня 2027');
  assert.equal(russianDate('мусор'), '');
  assert.equal(tableTitle('5'), 'Стол 5');
  assert.equal(tableTitle('Молодожёны'), 'Молодожёны');
  assert.equal(themeFor('tenderness').id, 'romance');
  assert.equal(themeFor('calla', 'modern').id, 'modern');
  assert.equal(themeFor('calla', 'нет-такой').id, 'classic');
});

test('перенос: по словам, двойную фамилию — по дефисам, слово без дефисов — по буквам, ничего не теряется', () => {
  const { wrap } = require('../dist/lib/planner/print/layout');
  const width = measure('Римский-Корсаков-', 'serif', 12) + 1;
  assert.deepEqual(wrap('Константин Римский-Корсаков-Новосёлов', 'serif', 12, width), ['Константин', 'Римский-Корсаков-', 'Новосёлов']);
  const word = 'Пааааааааааааааааааааааааааааавел';
  const lines = wrap(word, 'serif', 12, 40);
  assert.ok(lines.length > 1);
  assert.equal(lines.join(''), word);
  assert.ok(lines.every((l) => measure(l, 'serif', 12) <= 40));
});

test('карточки: имя и стол у каждого посаженного, без имени — строка для руки, питания нет', () => {
  const people = [
    ...Array.from({ length: 21 }, (_, i) => person(i, { diet: 'аллергия на орехи', tableId: i % 2 ? 't1' : 't2' })),
    person(30, { name: '', partyLabel: 'Ивановы', tableId: 't3' }),
    person(31, { name: LONG, tableId: 't3' }),
    person(32, { tableId: null }),                      // без стола — карточки нет
    person(33, { status: 'no', tableId: null }),        // отказался
  ];
  const doc = docs.cardsDoc(makeData(people), { menu: false });
  assert.equal(doc.pages.length, 3, '23 карточки — 3 листа по 10');
  const all = joined(doc);
  for (let i = 0; i < 21; i++) assert.ok(all.includes(`Гость Номер ${i}`), `нет карточки ${i}`);
  assert.ok(!all.includes('Гость Номер 32'), 'без стола карточка не нужна');
  assert.ok(all.includes('гость · Ивановы'));
  assert.ok(!/орех/.test(all), 'ограничения на карточках не печатаются');
  assert.ok(!all.includes('Мясное'), 'блюдо — только по галочке');
  assert.ok(texts(doc).some((t) => t.text.startsWith('Константин')), 'длинное имя напечатано');
  assertFits(doc);
  const withMenu = joined(docs.cardsDoc(makeData(people), { menu: true }));
  assert.ok(withMenu.includes('Мясное'));
  assert.throws(() => docs.cardsDoc(makeData([person(1, { tableId: null })]), { menu: false }), /никто не сидит/);
});

test('номера столов «домиком»: лист на стол, вторая половина перевёрнута, линия сгиба', () => {
  const doc = docs.tentsDoc(makeData([]));
  assert.equal(doc.pages.length, 3);
  for (const page of doc.pages) {
    assert.ok(page.items.some((it) => it.kind === 'flip'), 'перевёрнутая половина');
    assert.ok(page.items.some((it) => it.kind === 'line' && it.dash), 'линия сгиба');
  }
  const first = doc.pages[0].items.filter((it) => it.kind === 'text').map((t) => t.text);
  assert.ok(first.includes('СТОЛ') && first.includes('1'));
  assert.ok(joined(doc).includes('Молодожёны'));
  assertFits(doc);
  assert.throws(() => docs.tentsDoc(makeData([], { tables: [], tableById: new Map() })), /добавьте столы/);
});

test('план рассадки: все имена на месте при любом числе гостей, ничего не обрезано', () => {
  const few = docs.posterDoc(makeData([person(1), person(2, { tableId: 't3' }), person(3, { name: LONG, tableId: 't2' })]), 'a3');
  assert.equal(few.pages.length, 1);
  assertFits(few);
  // 220 человек за одним столом: стол продолжается в следующих клетках и страницах, никто не пропал
  const many = Array.from({ length: 220 }, (_, i) => person(i));
  const big = docs.posterDoc(makeData(many), 'a3');
  const all = joined(big);
  for (let i = 0; i < 220; i++) assert.ok(all.includes(`Гость Номер ${i}`), `пропал гость ${i}`);
  assert.ok(all.includes('Стол 1 (продолжение)'));
  assertFits(big);
  assertFits(docs.posterDoc(makeData(many), 'a1'));
  assert.ok(!joined(docs.posterDoc(makeData([person(1, { diet: 'целиакия' })]), 'a3')).includes('целиакия'));
});

test('кто где сидит: по алфавиту, только с именами, номер стола справа', () => {
  const doc = docs.alphaDoc(makeData([person(1, { name: 'Яна' }), person(2, { name: 'Анна', tableId: 't3' }), person(3, { name: '' }), person(4, { name: 'Борис', tableId: 't2' })]), 'a3');
  const names = texts(doc).filter((t) => t.align === 'left').map((t) => t.text);
  assert.deepEqual(names.filter((n) => ['Анна', 'Борис', 'Яна'].includes(n)), ['Анна', 'Борис', 'Яна']);
  const right = texts(doc).filter((t) => t.align === 'right').map((t) => t.text);
  assert.deepEqual(right, ['Молодожёны', '2', '1']);
  assertFits(doc);
  const crowd = docs.alphaDoc(makeData(Array.from({ length: 600 }, (_, i) => person(i, { name: `${LONG} ${i}` }))), 'a3');
  assert.ok(crowd.pages.length > 1, 'много длинных имён — несколько страниц');
  assertFits(crowd);
  // Длинное название стола не рвёт имя и не вылезает из колонки
  const wide = makeData([person(1, { name: 'Анастасия Кирилловна Воронцова-Дашкова', tableId: 't4' }), person(2, { name: 'Ян', tableId: 't4' })]);
  const t4 = { id: 't4', name: 'Друзья и коллеги невесты из Петербурга', title: 'Друзья и коллеги невесты из Петербурга', capacity: 10 };
  wide.tables.push(t4);
  wide.tableById.set('t4', t4);
  for (const paper of ['a3', 'a2', 'a1']) {
    const d = docs.alphaDoc(wide, paper);
    assertFits(d);
    assert.ok(texts(d).some((t) => t.text === 'Ян'), 'короткое имя целиком');
  }
});

test('список для организатора и сводка ресторану: ограничения только по запросу, счёт верный', () => {
  const people = [
    person(1, { diet: 'без глютена' }), person(2, { menu: 'Рыбное', isChild: true }), person(3, { status: 'maybe', menu: '' }),
    person(4, { tableId: null, menu: '' }), person(5, { status: 'no', tableId: null }),
  ];
  const list = joined(docs.listDoc(makeData(people), { diet: false }));
  assert.ok(list.includes('Стол 1') && list.includes('Без стола'));
  assert.ok(!list.includes('Гость Номер 5'), 'отказавшихся в списке нет');
  assert.ok(!list.includes('глютен'));
  assert.ok(joined(docs.listDoc(makeData(people), { diet: true })).includes('ограничения: без глютена'));
  const long = docs.listDoc(makeData(Array.from({ length: 300 }, (_, i) => person(i, { name: `${LONG} ${i}` }))), { diet: false });
  assert.ok(long.pages.length > 3);
  for (let i = 0; i < 300; i += 37) assert.ok(joined(long).includes(`${i}`));
  assertFits(long);

  const summary = docs.summaryDoc(makeData(people), { diet: false });
  const s = joined(summary);
  assert.ok(s.includes('Придут: 3 (взрослых 2, детей 1)'));
  assert.ok(s.includes('Пока не знают: 1'));
  assert.ok(!s.includes('глютен'));
  assert.ok(joined(docs.summaryDoc(makeData(people), { diet: true })).includes('без глютена'));
  assertFits(summary);
});

test('меню на стол: разделы, перенос, вторая страница при длинном тексте', () => {
  assert.deepEqual(docs.parseMenu('Горячее:\nСибас\n\nДесерт:'), [
    { kind: 'head', text: 'Горячее' }, { kind: 'item', text: 'Сибас' }, { kind: 'space', text: '' }, { kind: 'head', text: 'Десерт' },
  ]);
  const short = docs.menuDoc(makeData([]), 'Горячее на выбор:\nМясное — говядина\nРыбное — сибас', 'dl');
  assert.equal(short.pages.length, 1);
  assertFits(short);
  const text = Array.from({ length: 40 }, (_, i) => `Раздел ${i}:\n${LONG}\nСалат с тёплой уткой и соусом из лесных ягод ${i}`).join('\n\n');
  const longDoc = docs.menuDoc(makeData([]), text, 'a5');
  assert.ok(longDoc.pages.length > 1);
  assert.ok(joined(longDoc).includes('ягод 39'));
  assertFits(longDoc);
  assert.throws(() => docs.menuDoc(makeData([]), '\n  \n', 'a5'), /что будет в меню/);
  assert.equal(docs.defaultMenuText(makeData([])), 'Горячее на выбор:\nМясное — Говядина\nРыбное');
});

test('бланки пожеланий: 4 открытки на листе', () => {
  const doc = docs.wishesDoc(makeData([]));
  assert.equal(doc.pages.length, 1);
  assert.equal(texts(doc).filter((t) => t.text === 'Пожелания' || t.text.startsWith('Пожелания')).length >= 4, true);
  assertFits(doc);
});

/* ── PDF по HTTP ────────────────────────────────────────────────────────── */
test('PDF: владелец получает файлы, чужой и тариф без печати — нет', async (t) => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const owner = await prisma.user.create({ data: { email: 'print-owner@example.test' } });
  const stranger = await prisma.user.create({ data: { email: 'print-stranger@example.test' } });
  const tok = jwt.sign({ userId: owner.id }, process.env.JWT_SECRET);
  const other = jwt.sign({ userId: stranger.id }, process.env.JWT_SECRET);
  const inv = await prisma.invitation.create({ data: { userId: owner.id, slug: 'print-wedding', templateId: 'tenderness', status: 'paid', plan: 'premium', groomName: 'Андрей', brideName: 'Екатерина', weddingDate: '2027-06-19' } });
  const call = async (route, method = 'GET', body, token = tok) => {
    const res = await fetch(`${base}/api/planner/${inv.id}${route}`, {
      method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, type: res.headers.get('content-type') || '', buf, json: (res.headers.get('content-type') || '').includes('json') ? JSON.parse(buf.toString('utf8')) : null };
  };

  await t.test('пустые столы и гости — понятная ошибка, а не пустой PDF', async () => {
    const r = await call('/print/cards', 'POST', {});
    assert.equal(r.status, 400);
    assert.match(r.json.error, /никто не сидит/);
  });

  await t.test('все документы собираются, шрифты встроены', async () => {
    const t1 = (await call('/tables', 'POST', { name: '1', capacity: 8 })).json.result;
    await call('/tables', 'POST', { name: 'Молодожёны', capacity: 4, shape: 'long' });
    await call('/menu', 'POST', { label: 'Мясное', note: 'Говядина' });
    const party = (await call('/parties', 'POST', { names: 'Римских-Корсаковых', salutation: 'семья', people: [{ name: LONG }, { name: 'Анна' }, { name: '' }] })).json;
    const ids = party.snapshot.persons.map((p) => p.id);
    await call('/seat', 'POST', { personIds: ids, tableId: t1.id });

    const info = await call('/print');
    assert.equal(info.status, 200);
    assert.equal(info.json.theme, 'romance', 'тема по шаблону «Нежность»');
    assert.deepEqual(info.json.themes.map((x) => x.id), ['classic', 'romance', 'garden', 'modern']);
    assert.equal(info.json.menuText, 'Горячее на выбор:\nМясное — Говядина');

    const kinds = [
      ['cards', { menu: true }], ['tents', {}], ['poster', { size: 'a2' }], ['alpha', { size: 'a3' }],
      ['list', { diet: true }], ['summary', { diet: false }], ['wishes', {}], ['menu', { text: info.json.menuText, size: 'dl' }],
    ];
    for (const [kind, body] of kinds) {
      const r = await call(`/print/${kind}`, 'POST', { theme: 'garden', ...body });
      assert.equal(r.status, 200, `${kind}: ${r.json && r.json.error}`);
      assert.match(r.type, /application\/pdf/);
      assert.equal(r.buf.subarray(0, 5).toString(), '%PDF-', kind);
      const pdf = r.buf.toString('latin1');
      assert.ok(/\/FontFile[23]?/.test(pdf), `${kind}: шрифт встроен`);
      assert.ok(/\/Type\s*\/Page\b/.test(pdf), `${kind}: есть страницы`);
    }
  });

  await t.test('чужое приглашение, неизвестный документ, тариф без печати, слишком длинное меню', async () => {
    assert.equal((await call('/print/cards', 'POST', {}, other)).status, 404);
    assert.equal((await call('/print/nothing', 'POST', {})).status, 404);
    assert.equal((await call('/print/menu', 'POST', { text: 'x'.repeat(3001) })).status, 400);
    await prisma.invitation.update({ where: { id: inv.id }, data: { plan: 'basic' } });
    try { assert.equal((await call('/print/cards', 'POST', {})).status, 403); }
    finally { await prisma.invitation.update({ where: { id: inv.id }, data: { plan: 'premium' } }); }
  });
});
