/* Отзывы пар о WeddingCraft в нашей базе: все, включая неопубликованные (ждут проверки,
   с оценкой 1–3, без согласия на показ), и сколько пар мы об отзыве просили письмами
   (review_ask — через неделю после публикации, after_wedding — после свадьбы).
   Отзывы на Яндексе здесь не видны — их смотреть в карточке yandex.ru/profile/162112565078.
   Только чтение. Тексты отзывов — слова пар: для владельца, никуда не пересылать.
   Почты не печатаются; тестовые аккаунты (FREE_ACCOUNTS) не считаются.

   На сервере (после сборки бэкенда):
     cd /var/www/wedding/backend && node scripts/reviews-report.cjs   */
require('dotenv').config({ quiet: true });
const prisma = require('../dist/lib/prisma').default;
const { isFreeAccount } = require('../dist/lib/freeAccounts');
const TEMPLATE_NAMES = require('./template-names.cjs');

const STATUS = { pending: 'ждёт проверки', published: 'на главной', hidden: 'скрыт' };
const msk = d => new Date(d.getTime() + 3 * 3600_000);
const fmt = d => msk(d).toISOString().slice(0, 10).split('-').reverse().join('.');

(async () => {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const test = new Set(users.filter(u => isFreeAccount(u.email)).map(u => u.id));

  const reviews = (await prisma.review.findMany({ orderBy: { createdAt: 'asc' } })).filter(r => !test.has(r.userId));
  console.log(`\nОтзывов в базе: ${reviews.length}`);
  for (const r of reviews) {
    const consent = r.rating >= 4 ? (r.publish ? 'показывать разрешили' : 'показывать не разрешили') : 'оценка ниже 4 — не публикуется';
    console.log(`\n${fmt(r.createdAt)}  ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}  ${STATUS[r.status] || r.status}, ${consent}`);
    console.log(`   шаблон ${TEMPLATE_NAMES[r.templateId] || r.templateId || '—'}${r.names ? `, подпись «${r.names}»` : ''}`);
    console.log(`   ${r.text ? `«${r.text.replace(/\s+/g, ' ').slice(0, 300)}»` : '(без текста)'}`);
  }

  // Кого просили об отзыве письмами — и ответили ли
  const asked = (await prisma.emailEvent.findMany({
    where: { kind: { in: ['review_ask', 'after_wedding'] } }, select: { kind: true, invitationId: true, userId: true, sentAt: true },
  })).filter(e => !test.has(e.userId));
  const reviewed = new Set(reviews.map(r => r.invitationId));
  console.log('\nПросьбы об отзыве письмами:');
  for (const kind of ['review_ask', 'after_wedding']) {
    const rows = asked.filter(e => e.kind === kind);
    const answered = rows.filter(e => reviewed.has(e.invitationId)).length;
    const last = rows.length ? fmt(new Date(Math.max(...rows.map(e => e.sentAt.getTime())))) : '—';
    console.log(`   ${kind === 'review_ask' ? '«Как вам WeddingCraft?»' : '«Как прошла свадьба?»'}: отправлено ${rows.length}, последнее ${last}; оставили отзыв у нас: ${answered}`);
  }
  console.log('\nОтзывы на Яндексе в базу не попадают: https://yandex.ru/profile/162112565078');
  await prisma.$disconnect();
})().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
