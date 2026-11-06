/* Пары, которые заплатили, — для личного письма владельца (например, просьбы об отзыве)
   и чтобы понять, как пара дошла до оплаты.
   Только чтение, ничего не отправляет. Печатает почты и имена — это данные клиентов:
   только для личной переписки владельца, никуда не пересылать.
   Не показывает тестовые аккаунты (FREE_ACCOUNTS). Отписавшихся от писем помечает:
   личное письмо им можно, но без рассылок.
   Телеграм: у нас есть только чат пары с нашим ботом (если подключили уведомления),
   ни имени пользователя, ни телефона — написать ей можно только на почту.

   «Путь до оплаты» — что знает база: вход, создание приглашения, бесплатная публикация,
   наши письма, ответы гостей, нажатие «Оплатить». Откуда человек пришёл на сайт
   (реклама, поиск, письмо), база не хранит — это видно только в Метрике
   (по времени оплаты из этого отчёта).

   На сервере (после сборки бэкенда):
     cd /var/www/wedding/backend && node scripts/paid-couples.cjs   */
require('dotenv').config({ quiet: true });
const prisma = require('../dist/lib/prisma').default;
const { isFreeAccount } = require('../dist/lib/freeAccounts');

const TEMPLATE_NAMES = require('./template-names.cjs');
const SITE = (process.env.FRONTEND_URL || 'https://weddingcraft.ru').replace(/\/$/, '');
const PLAN_NAMES = { premium: 'Премиум', maximum: 'Максимум', pro: 'Про', basic: 'Базовый', lite: 'Лайт', standard: 'Базовый' };
// Письма серии lib/lifecycleEmails.ts — по теме, как их видит пара
const LETTERS = {
  draft_24h: '«Ваше приглашение почти готово»',
  free_1d: '«Как узнать, кто придёт на свадьбу»',
  free_hidden: '«Гости отвечают на ваше приглашение» (часть ответов скрыта)',
  free_4d: 'про место и программу дня',
  date_90: '«До свадьбы три месяца»',
  date_60: '«Два месяца до свадьбы»',
  after_wedding: '«Как прошла свадьба?»',
  review_ask: '«Как вам WeddingCraft?»',
};

const msk = d => new Date(d.getTime() + 3 * 3600_000);
const fmt = d => (d ? msk(d).toISOString().slice(0, 10).split('-').reverse().join('.') : '—');
const stamp = d => { const s = msk(d).toISOString(); return `${s.slice(8, 10)}.${s.slice(5, 7)} ${s.slice(11, 16)}`; };
const ruDate = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : 'не указана');
const rub = kopecks => `${Math.round(kopecks / 100).toLocaleString('ru-RU')} ₽`;

function promoOf(attempt) {
  try { return JSON.parse(attempt.payload)?.metadata?.promoCode || ''; } catch { return ''; }
}

// События до оплаты по порядку: [время, что было]
async function pathToPayment(i) {
  const events = [
    [i.user.createdAt, 'первый вход (аккаунт создан)'],
    [i.createdAt, `создано это приглашение (всего приглашений в аккаунте: ${i.user._count.invitations})`],
  ];
  const mails = await prisma.emailEvent.findMany({ where: { invitationId: i.id }, select: { kind: true, sentAt: true } });
  for (const m of mails) {
    if (i.paidAt && m.sentAt > i.paidAt) continue;
    if (m.kind === 'mark:free_seen') events.push([m.sentAt, 'сайт уже опубликован бесплатно (рассылка впервые увидела его)']);
    else if (!m.kind.startsWith('mark:')) events.push([m.sentAt, `письмо ${LETTERS[m.kind] || m.kind}`]);
  }
  const attempt = i.paymentAttempt;
  if (attempt && attempt.paymentId === i.paymentId) {
    const promo = promoOf(attempt);
    events.push([attempt.createdAt, `нажал «Оплатить»: ${rub(attempt.amountKopecks)}${promo ? `, промокод ${promo}` : ''}`]);
  }
  if (i.paidAt) events.push([i.paidAt, 'оплата прошла']);
  events.sort((a, b) => a[0] - b[0]);
  const answersBefore = i.paidAt
    ? await prisma.guestResponse.count({ where: { invitationId: i.id, createdAt: { lt: i.paidAt } } })
    : i._count.guestResponses;
  return { events, answersBefore };
}

(async () => {
  const paid = await prisma.invitation.findMany({
    where: { status: { in: ['paid', 'published'] }, plan: { not: 'free' } },
    orderBy: { paidAt: 'asc' },
    select: {
      id: true, slug: true, plan: true, templateId: true, groomName: true, brideName: true, weddingDate: true, paidAt: true,
      createdAt: true, paymentId: true, notifyTelegramChatId: true,
      user: { select: { email: true, emailOptOut: true, createdAt: true, _count: { select: { invitations: true } } } },
      paymentAttempt: { select: { amountKopecks: true, payload: true, createdAt: true, paymentId: true } },
      review: { select: { rating: true } },
      _count: { select: { guestResponses: true } },
    },
  });
  const rows = paid.filter(i => i.user && !isFreeAccount(i.user.email));
  console.log(`Заплатили: ${rows.length} (время — московское)\n`);
  for (const i of rows) {
    const names = [i.groomName, i.brideName].filter(Boolean).join(' и ') || 'имена не указаны';
    console.log(`${names} — ${i.user.email}${i.user.emailOptOut ? ' (отписаны от рассылок)' : ''}`);
    console.log(`   «${PLAN_NAMES[i.plan] || i.plan}», оплата ${fmt(i.paidAt)}, свадьба ${ruDate(i.weddingDate)}, шаблон ${TEMPLATE_NAMES[i.templateId] || i.templateId}`);
    console.log(`   ответов гостей: ${i._count.guestResponses}; уведомления в Telegram: ${i.notifyTelegramChatId ? 'подключены' : 'нет'}; ` +
      `отзыв: ${i.review ? `есть (${i.review.rating}★)` : 'нет'}`);
    console.log(`   сайт: ${SITE}/${i.slug}`);
    console.log(`   отзыв в кабинете: ${SITE}/dashboard/${i.id}?review=1`);
    const { events, answersBefore } = await pathToPayment(i);
    console.log('   путь до оплаты:');
    for (const [at, what] of events) console.log(`     ${stamp(at)}  ${what}`);
    console.log(`     ответов гостей до оплаты: ${answersBefore}\n`);
  }

  // Печатные приглашения оплачиваются отдельно от сайта
  const prints = (await prisma.printOrder.findMany({
    where: { status: 'paid' }, orderBy: { paidAt: 'asc' },
    select: { templateId: true, paidAt: true, user: { select: { email: true } } },
  })).filter(p => p.user && !isFreeAccount(p.user.email));
  console.log(`Оплаченных заказов печати: ${prints.length}`);
  for (const p of prints) console.log(`   ${fmt(p.paidAt)} — ${p.user.email}, шаблон ${TEMPLATE_NAMES[p.templateId] || p.templateId}`);
  await prisma.$disconnect();
})().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
