/* Бесплатные сайты: у скольких пара заполнила своим то, что на бесплатном тарифе гости
   не видят, — место, программу дня, дресс-код. Это самые тёплые кандидаты на оплату:
   пара «Айвори», оплатившая 04.11.26, заполнила всё это в первые полчаса и через 25 дней
   заплатила, чтобы гости увидели уже готовое.
   «Своё» — не пусто и не пример шаблона. Образцы берутся прямо из исходников фронтенда
   (TEMPLATE_DEFAULTS в frontend/src/lib/constants.ts, демо «Скетча» в sketch-*.ts),
   поэтому список не надо обновлять вместе с шаблонами. Подписи вроде «Место встречи»
   не считаются, значки в программе — тоже: важно само место, пункты и описание образа.
   Раздел, выключенный парой, не считается.
   Только чтение и только общие числа — без почт, имён и адресов. Тестовые аккаунты
   (FREE_ACCOUNTS) не считаются.

   На сервере (после сборки бэкенда):
     cd /var/www/wedding/backend && node scripts/free-filled.cjs   */
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Схема и образцы шаблонов — из исходников фронтенда, как в tests/templatePlaces.cjs
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const LIB = path.join(__dirname, '../../frontend/src/lib');
const { TEMPLATE_FIELDS, TEMPLATE_DEFAULTS } = require(path.join(LIB, 'constants.ts'));
const SAMPLE_SOURCES = [TEMPLATE_DEFAULTS, require(path.join(LIB, 'sketch-demo-photos.ts')), require(path.join(LIB, 'sketch-location.ts'))];

// Разделы, закрытые на бесплатном тарифе (lib/plans.ts FREE_LOCKED_SECTIONS), по смыслу
const GROUPS = { place: ['venue', 'map', 'hall'], schedule: ['schedule'], dress: ['dresscode', 'style'] };
const GROUP_NAMES = { place: 'место', schedule: 'программа', dress: 'дресс-код' };
const LABEL_FIELDS = new Set(['venueLabel', 'hallTitle', 'dateIntro', 'locationText']);   // подписи, а не содержание
const DATA_JSON = new Set(['schedule', 'dressCodeColors', 'galleryPhotos']);

const parse = (s, fallback) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };
// Пункты программы сравниваются без значков: свои значки на примере — это ещё не своя программа
const normList = list => JSON.stringify(list.map(x => (x && typeof x === 'object')
  ? [x.time, x.title, x.desc].map(s => String(s ?? '').trim())
  : String(x ?? '').trim().toLowerCase()));

// Все примеры всех шаблонов: пример чужого шаблона после смены дизайна — тоже не своё
const SAMPLE_TEXT = new Set();
const SAMPLE_LISTS = new Set();
(function walk(v) {
  if (typeof v === 'string') { if (v.trim()) SAMPLE_TEXT.add(v.trim()); return; }
  if (Array.isArray(v)) { SAMPLE_LISTS.add(normList(v)); v.forEach(walk); return; }
  if (v && typeof v === 'object') Object.values(v).forEach(walk);
})(SAMPLE_SOURCES);

function own(value) {
  if (typeof value === 'string') { const t = value.trim(); return !!t && !SAMPLE_TEXT.has(t); }
  if (Array.isArray(value)) return value.length > 0 && !SAMPLE_LISTS.has(normList(value));
  return false;   // точка на карте строится из адреса, флажки — настройки, а не содержание
}

/** Какие закрытые на Free разделы пара заполнила своим: ['place', 'dress'];
    null — шаблона нет в схеме (старые шаблоны). */
function ownSections(invite) {
  const sections = TEMPLATE_FIELDS[invite.templateId];
  if (!sections) return null;
  const cd = parse(invite.customData, {});
  const enabled = parse(invite.enabledSections, {});
  const found = [];
  for (const [group, ids] of Object.entries(GROUPS)) {
    const has = sections.some(s => ids.includes(s.id) && enabled[s.id] !== false && s.fields.some(f => {
      if (LABEL_FIELDS.has(f.id)) return false;
      const value = f.scope === 'custom' ? cd[f.id] : DATA_JSON.has(f.id) ? parse(invite[f.id], []) : invite[f.id];
      return own(value);
    }));
    if (has) found.push(group);
  }
  return found;
}

const msk = d => new Date(d.getTime() + 3 * 3600_000);
const shortDate = d => { const s = msk(d).toISOString(); return `${s.slice(8, 10)}.${s.slice(5, 7)}`; };
const ruDate = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : 'без даты');
const line = (label, value) => console.log(`${label.padEnd(56, '.')} ${value}`);
const count = (rows, key) => rows.reduce((m, r) => { const k = key(r); m[k] = (m[k] || 0) + 1; return m; }, {});

function untilWedding(date, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'дата не указана';
  const days = Math.round((new Date(`${date}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400_000);
  if (days < 0) return 'свадьба уже прошла';
  if (days <= 31) return 'до свадьбы ≤ 1 месяца';
  if (days <= 92) return 'до свадьбы 1–3 месяца';
  if (days <= 183) return 'до свадьбы 3–6 месяцев';
  return 'до свадьбы больше 6 месяцев';
}
const BUCKETS = ['свадьба уже прошла', 'до свадьбы ≤ 1 месяца', 'до свадьбы 1–3 месяца', 'до свадьбы 3–6 месяцев', 'до свадьбы больше 6 месяцев', 'дата не указана'];

async function main() {
  const prisma = require('../dist/lib/prisma').default;
  const { isFreeAccount } = require('../dist/lib/freeAccounts');
  const TEMPLATE_NAMES = require('./template-names.cjs');
  const tplName = id => TEMPLATE_NAMES[id] || id;
  const today = msk(new Date()).toISOString().slice(0, 10);

  const sites = (await prisma.invitation.findMany({
    where: { status: 'published', plan: 'free' },
    include: { user: { select: { email: true } }, _count: { select: { guestResponses: true } } },
    orderBy: { createdAt: 'asc' },
  })).filter(i => i.user && !isFreeAccount(i.user.email));
  const mails = await prisma.emailEvent.findMany({
    where: { invitationId: { in: sites.map(s => s.id) }, kind: { in: ['free_4d', 'free_hidden'] } },
    select: { invitationId: true, kind: true },
  });
  const mailed = kind => new Set(mails.filter(m => m.kind === kind).map(m => m.invitationId));
  const placeMail = mailed('free_4d');
  const hiddenMail = mailed('free_hidden');

  const rows = sites.map(s => ({ s, own: ownSections(s) }));
  const known = rows.filter(r => r.own);
  const warm = known.filter(r => r.own.length);
  const has = g => known.filter(r => r.own.includes(g)).length;

  console.log(`\nБесплатные сайты на ${ruDate(today)} (без тестовых аккаунтов)\n`);
  line('Опубликовано бесплатно', sites.length);
  if (known.length < rows.length) line('   из них старых шаблонов без схемы (не разбирались)', rows.length - known.length);
  console.log('\nЗаполнили своим то, что на бесплатном гости не видят:');
  line('   место (название, адрес, карта, фото места)', has('place'));
  line('   программа дня', has('schedule'));
  line('   дресс-код', has('dress'));
  line('   хотя бы одно из трёх', `${warm.length} из ${known.length}`);
  line('   все три', known.filter(r => r.own.length === 3).length);
  line('   ничего своего (только примеры шаблона)', known.length - warm.length);

  if (warm.length) {
    console.log('\nТе, кто заполнил хотя бы одно:');
    const byWhen = count(warm, r => untilWedding(r.s.weddingDate, today));
    for (const b of BUCKETS) if (byWhen[b]) line(`   ${b}`, byWhen[b]);
    const answered = warm.filter(r => r.s._count.guestResponses > 0);
    line('   гости уже отвечали (ссылку рассылали)', `${answered.length} (ответов всего: ${answered.reduce((n, r) => n + r.s._count.guestResponses, 0)})`);
    line('   получили письмо про место и программу (free_4d)', warm.filter(r => placeMail.has(r.s.id)).length);
    line('   получили письмо «ответы скрыты» (free_hidden)', warm.filter(r => hiddenMail.has(r.s.id)).length);
    line('   по шаблонам', JSON.stringify(count(warm, r => tplName(r.s.templateId))));

    console.log('\nСписок по дате свадьбы (без имён и почт): шаблон | вход | свадьба | своё | ответов гостей');
    const sorted = [...warm].sort((a, b) => (a.s.weddingDate || '9999').localeCompare(b.s.weddingDate || '9999'));
    for (const r of sorted) {
      console.log(`   ${tplName(r.s.templateId)} | ${shortDate(r.s.createdAt)} | ${ruDate(r.s.weddingDate)} | ` +
        `${r.own.map(g => GROUP_NAMES[g]).join(' + ')} | ${r.s._count.guestResponses}`);
    }
  }
  await prisma.$disconnect();
}

module.exports = { ownSections };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
