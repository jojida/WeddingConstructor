/* Пары, которые заплатили, — для личного письма владельца (например, просьбы об отзыве).
   Только чтение, ничего не отправляет. Печатает почты и имена — это данные клиентов:
   только для личной переписки владельца, никуда не пересылать.
   Не показывает тестовые аккаунты (FREE_ACCOUNTS). Отписавшихся от писем помечает:
   личное письмо им можно, но без рассылок.
   Телеграм: у нас есть только чат пары с нашим ботом (если подключили уведомления),
   ни имени пользователя, ни телефона — написать ей можно только на почту.

   На сервере (после сборки бэкенда):
     cd /var/www/wedding/backend && node scripts/paid-couples.cjs   */
require('dotenv').config({ quiet: true });
const prisma = require('../dist/lib/prisma').default;
const { isFreeAccount } = require('../dist/lib/freeAccounts');

const TEMPLATE_NAMES = require('./template-names.cjs');
const SITE = (process.env.FRONTEND_URL || 'https://weddingcraft.ru').replace(/\/$/, '');
const PLAN_NAMES = { premium: 'Премиум', maximum: 'Максимум', pro: 'Про', basic: 'Базовый', lite: 'Лайт', standard: 'Базовый' };

const msk = d => new Date(d.getTime() + 3 * 3600_000);
const fmt = d => (d ? msk(d).toISOString().slice(0, 10).split('-').reverse().join('.') : '—');
const ruDate = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : 'не указана');

(async () => {
  const paid = await prisma.invitation.findMany({
    where: { status: { in: ['paid', 'published'] }, plan: { not: 'free' } },
    orderBy: { paidAt: 'asc' },
    select: {
      id: true, slug: true, plan: true, templateId: true, groomName: true, brideName: true, weddingDate: true, paidAt: true,
      notifyTelegramChatId: true,
      user: { select: { email: true, emailOptOut: true } },
      review: { select: { rating: true } },
      _count: { select: { guestResponses: true } },
    },
  });
  const rows = paid.filter(i => i.user && !isFreeAccount(i.user.email));
  console.log(`Заплатили: ${rows.length}\n`);
  for (const i of rows) {
    const names = [i.groomName, i.brideName].filter(Boolean).join(' и ') || 'имена не указаны';
    console.log(`${names} — ${i.user.email}${i.user.emailOptOut ? ' (отписаны от рассылок)' : ''}`);
    console.log(`   «${PLAN_NAMES[i.plan] || i.plan}», оплата ${fmt(i.paidAt)}, свадьба ${ruDate(i.weddingDate)}, шаблон ${TEMPLATE_NAMES[i.templateId] || i.templateId}`);
    console.log(`   ответов гостей: ${i._count.guestResponses}; уведомления в Telegram: ${i.notifyTelegramChatId ? 'подключены' : 'нет'}; ` +
      `отзыв: ${i.review ? `есть (${i.review.rating}★)` : 'нет'}`);
    console.log(`   сайт: ${SITE}/${i.slug}`);
    console.log(`   отзыв в кабинете: ${SITE}/dashboard/${i.id}?review=1\n`);
  }
  await prisma.$disconnect();
})().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
