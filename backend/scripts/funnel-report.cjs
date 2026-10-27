/* Отчёт по воронке: где люди отваливаются между входом и оплатой.
   Только чтение и только общие числа — без почт, имён и адресов.
   Тестовые аккаунты владельца (FREE_ACCOUNTS) не считаются.

   На сервере (после сборки бэкенда):
     cd /var/www/wedding/backend && node scripts/funnel-report.cjs [с какой даты, по умолчанию 2026-10-10]   */
require('dotenv').config({ quiet: true });
const prisma = require('../dist/lib/prisma').default;
const { isFreeAccount } = require('../dist/lib/freeAccounts');
const { ownPlace } = require('../dist/lib/templatePlaces');

const from = process.argv[2] || '2026-10-10';
const since = new Date(`${from}T00:00:00+03:00`);
const day = d => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(5, 10);   // ММ-ДД по Москве
const count = (rows, key) => rows.reduce((m, r) => { const k = key(r); m[k] = (m[k] || 0) + 1; return m; }, {});
const line = (label, value) => console.log(`${label.padEnd(58, '.')} ${value}`);
const median = xs => { if (!xs.length) return '—'; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

(async () => {
  console.log(`\nВоронка с ${from} (без тестовых аккаунтов)\n`);

  // ── Вход ──
  const users = (await prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { id: true, email: true, createdAt: true, emailOptOut: true } }))
    .filter(u => !isFreeAccount(u.email));
  const userIds = new Set(users.map(u => u.id));
  // Код удаляется при успешном входе: оставшиеся строки — запросили код и не ввели
  const codes = await prisma.verificationCode.findMany({ where: { createdAt: { gte: since } }, select: { email: true, attempts: true } });
  const known = new Set((await prisma.user.findMany({ where: { email: { in: codes.map(c => c.email) } }, select: { email: true } })).map(u => u.email));
  const stuck = codes.filter(c => !known.has(c.email) && !isFreeAccount(c.email));
  line('1. Новых аккаунтов (вошли по коду)', users.length);
  line('   запросили код, но так и не вошли', `${stuck.length} (из них вводили неверный код: ${stuck.filter(c => c.attempts > 0).length})`);
  line('   по дням', JSON.stringify(count(users, u => day(u.createdAt))));

  // ── Приглашения ──
  const invites = (await prisma.invitation.findMany({
    where: { userId: { in: [...userIds] } },
    select: { id: true, userId: true, status: true, plan: true, templateId: true, weddingDate: true, venue: true, venueAddress: true,
      paymentId: true, paidAt: true, createdAt: true, updatedAt: true },
  }));
  const published = invites.filter(i => i.status === 'published' || i.status === 'paid');
  const free = published.filter(i => i.plan === 'free');
  const paid = published.filter(i => i.status === 'paid' && !['', 'dev_test', 'free_account'].includes(i.paymentId));
  const usersWithInvite = new Set(invites.map(i => i.userId));
  const usersPublished = new Set(published.map(i => i.userId));
  line('2. Аккаунтов с приглашением', usersWithInvite.size);
  line('3. Аккаунтов, опубликовавших сайт', usersPublished.size);
  line('   вошли, но не опубликовали (черновик брошен)', [...usersWithInvite].filter(u => !usersPublished.has(u)).length);
  line('   бесплатных сайтов', free.length);
  line('   из них со своим местом (гости его не видят)', free.filter(i => ownPlace(i.venue, i.venueAddress)).length);
  line('4. Оплаченных сайтов (настоящая оплата)', paid.length);
  line('   по тарифам', JSON.stringify(count(paid, i => i.plan)));

  // ── Попытки оплаты ──
  const attempts = await prisma.paymentAttempt.findMany({ where: { createdAt: { gte: since }, invitationId: { not: null } }, select: { plan: true, invitationId: true } });
  const attemptsOwn = attempts.filter(a => invites.some(i => i.id === a.invitationId));
  line('5. Дошли до кассы ЮKassa (попытки оплаты)', `${attemptsOwn.length} ${JSON.stringify(count(attemptsOwn, a => a.plan))}`);

  // ── После бесплатной публикации ──
  const seen = await prisma.emailEvent.findMany({ where: { invitationId: { in: free.map(i => i.id) }, kind: 'mark:free_seen' }, select: { invitationId: true, sentAt: true } });
  const seenAt = new Map(seen.map(e => [e.invitationId, e.sentAt.getTime()]));
  const editedAfter = free.filter(i => seenAt.has(i.id) && i.updatedAt.getTime() > seenAt.get(i.id) + 3600_000);
  line('6. Бесплатные: правили сайт позже чем через час после публикации', `${editedAfter.length} из ${free.length}`);
  const toPublish = free.filter(i => seenAt.has(i.id)).map(i => Math.round((seenAt.get(i.id) - i.createdAt.getTime()) / 60_000));
  line('   минут от черновика до публикации (медиана, ±30 мин)', median(toPublish));

  // ── Письма ──
  const mails = await prisma.emailEvent.findMany({ where: { userId: { in: [...userIds] }, NOT: { kind: { startsWith: 'mark:' } } }, select: { kind: true } });
  line('7. Писем серии отправлено', JSON.stringify(count(mails, m => m.kind)));
  line('   отписались от писем', users.filter(u => u.emailOptOut).length);

  // ── Кто эти пары ──
  const month = i => (/^\d{4}-\d{2}/.test(i.weddingDate) ? i.weddingDate.slice(0, 7) : 'без даты');
  line('8. Месяц свадьбы (все приглашения)', JSON.stringify(Object.fromEntries(Object.entries(count(invites, month)).sort())));
  line('   шаблоны', JSON.stringify(count(invites, i => i.templateId)));

  // ── По дням регистрации: так сравниваются периоды (с бесплатным тарифом и без, правки воронки) ──
  const byDay = new Map();
  for (const u of users) {
    const d = day(u.createdAt);
    if (!byDay.has(d)) byDay.set(d, { in: 0, invite: 0, pub: 0, paid: 0 });
    const r = byDay.get(d);
    r.in++;
    if (usersWithInvite.has(u.id)) r.invite++;
    if (usersPublished.has(u.id)) r.pub++;
    if (paid.some(i => i.userId === u.id)) r.paid++;
  }
  console.log('9. По дням регистрации: вошли / с приглашением / опубликовали / оплатили');
  for (const [d, r] of [...byDay].sort()) console.log(`   ${d}   ${r.in} / ${r.invite} / ${r.pub} / ${r.paid}`);
  line('   оплаты (день оплаты по Москве, тариф)', JSON.stringify(paid.map(i => `${i.paidAt ? day(i.paidAt) : '?'} ${i.plan}`)));
  console.log('');
})().catch(e => { console.error('Ошибка отчёта:', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
