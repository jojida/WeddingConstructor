/* Брошенные черновики для личного письма владельца: кто начал приглашение, но не
   опубликовал. Только чтение, ничего не отправляет. Печатает почты и имена — это
   данные клиентов: только для личной переписки владельца, никуда не пересылать.
   Не показывает: тестовые аккаунты (FREE_ACCOUNTS), отписавшихся от писем
   (emailOptOut — их просьбу уважаем), тех, у кого уже есть опубликованный сайт.
   Сортировка — по дате свадьбы: первыми те, кому приглашение нужно раньше.

   На сервере (после сборки бэкенда):
     cd /var/www/wedding/backend && node scripts/hot-drafts.cjs [с какой даты, по умолчанию 7 дней назад]   */
require('dotenv').config({ quiet: true });
const prisma = require('../dist/lib/prisma').default;
const { isFreeAccount } = require('../dist/lib/freeAccounts');

const TEMPLATE_NAMES = {
  vitrage: 'Витраж', forest: 'Туманный лес', tenderness: 'Нежность', angels: 'Ангелы', calla: 'Каллы',
  'garden-evening': 'Вечер в саду', floral: 'Флоральный', ivory: 'Айвори', sketch: 'Скетч',
  mediterranean: 'Средиземноморье', 'garden-arch': 'Цветущая арка', vadimdarya: 'Тёмная элегантность',
};
const SOON_DAYS = 45; // приглашения рассылают за 6–8 недель — ближе уже горит

const msk = d => new Date(d.getTime() + 3 * 3600_000);
const fmt = d => msk(d).toISOString().slice(0, 16).replace('T', ' ');
const defaultFrom = msk(new Date(Date.now() - 7 * 86400_000)).toISOString().slice(0, 10);
const from = process.argv[2] || defaultFrom;
const since = new Date(`${from}T00:00:00+03:00`);
const todayMsk = new Date(`${msk(new Date()).toISOString().slice(0, 10)}T00:00:00Z`);

function daysUntil(weddingDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weddingDate || '')) return null;
  return Math.round((new Date(`${weddingDate}T00:00:00Z`) - todayMsk) / 86400_000);
}
const ruDate = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : 'не указана');

(async () => {
  const drafts = await prisma.invitation.findMany({
    where: { createdAt: { gte: since }, status: { notIn: ['paid', 'published'] } },
    select: { id: true, userId: true, groomName: true, brideName: true, weddingDate: true, templateId: true, createdAt: true, updatedAt: true,
      user: { select: { email: true, emailOptOut: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  const customers = new Set((await prisma.invitation.findMany({
    where: { userId: { in: [...new Set(drafts.map(d => d.userId))] }, status: { in: ['paid', 'published'] } },
    select: { userId: true },
  })).map(i => i.userId));

  let optedOut = 0;
  const byUser = new Map(); // одна строка на человека — его последний черновик
  for (const d of drafts) {
    if (!d.user || isFreeAccount(d.user.email) || customers.has(d.userId)) continue;
    if (d.user.emailOptOut) { if (!byUser.has(d.userId)) optedOut++; byUser.set(d.userId, null); continue; }
    if (!byUser.has(d.userId)) byUser.set(d.userId, d);
  }
  const rows = [...byUser.values()].filter(Boolean)
    .map(d => ({ ...d, days: daysUntil(d.weddingDate) }))
    .sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9));

  console.log(`\nНеопубликованные черновики, начатые с ${from} (без тестовых аккаунтов, без уже опубликовавших)\n`);
  if (!rows.length) console.log('Таких нет.');
  for (const d of rows) {
    const names = [d.brideName, d.groomName].filter(s => s && s.trim()).join(' и ') || '— имена не вписаны —';
    const when = d.days === null ? 'дата не указана' : d.days < 0 ? `свадьба уже прошла (${-d.days} дн. назад)` : `через ${d.days} дн.`;
    const mark = d.days !== null && d.days >= 0 && d.days <= SOON_DAYS ? '🔥 ' : '   ';
    console.log(`${mark}${d.user.email}`);
    console.log(`     ${names} · свадьба ${ruDate(d.weddingDate)} (${when}) · шаблон «${TEMPLATE_NAMES[d.templateId] || d.templateId}»`);
    console.log(`     начат ${fmt(d.createdAt)}, последняя правка ${fmt(d.updatedAt)} (МСК)\n`);
  }
  console.log(`Итого: ${rows.length}, из них свадьба в ближайшие ${SOON_DAYS} дней (🔥): ${rows.filter(r => r.days !== null && r.days >= 0 && r.days <= SOON_DAYS).length}`);
  if (optedOut) console.log(`Не показаны отписавшиеся от писем: ${optedOut} — им не пишем.`);
  await prisma.$disconnect();
})().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
