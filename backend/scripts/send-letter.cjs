/* Личное письмо владельца паре — от support@weddingcraft.ru; ответ пары придёт туда же
   (а оттуда пересылкой Cloudflare — на почту владельца). Например, просьба об отзыве.
   Одно письмо одному адресату. Ничего не сохраняет и не пишет текст в журнал.
   На российские почты (yandex.ru, mail.ru…) — через RuSender, как коды входа: у Brevo
   туда хуже доставка; если RuSender не ответит — через Brevo.

   На сервере (после сборки бэкенда):
     cd /var/www/wedding/backend && node scripts/send-letter.cjs
   Скрипт спросит адрес, тему и текст (вставьте его и закончите строкой из одной
   точки), покажет письмо целиком и отправит только после «да». Отправитель в почте
   пары — «WeddingCraft <support@weddingcraft.ru>», подпись — в самом тексте.
   Посмотреть, что получится, без отправки: node scripts/send-letter.cjs --dry   */
require('dotenv').config({ quiet: true });
const readline = require('readline');
const { sendEmail, isEmailConfigured } = require('../dist/lib/email');
const { escapeHtml } = require('../dist/lib/security');

const FROM = 'support@weddingcraft.ru';
const FROM_NAME = 'WeddingCraft';
const DRY = process.argv.includes('--dry');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Вставленный текст приходит пачкой строк — копим их в очередь, чтобы ни одна не потерялась
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
// Своё приглашение readline («> ») при наборе затирало подсказки — вопросы пишем отдельной строкой
rl.setPrompt('');
const queue = [];
let waiting = null;
let closed = false;
rl.on('line', line => { if (waiting) { const w = waiting; waiting = null; w(line); } else queue.push(line); });
rl.on('close', () => { closed = true; if (waiting) { const w = waiting; waiting = null; w(null); } });
function ask(prompt) {
  if (prompt) console.log(prompt);
  if (queue.length) return Promise.resolve(queue.shift());
  if (closed) return Promise.resolve(null);
  return new Promise(resolve => { waiting = resolve; });
}

/* Без вёрстки и логотипов — письмо должно выглядеть личным. Ссылки кликабельные,
   точка или скобка после ссылки в неё не попадает. */
function toHtml(text) {
  // Ссылки ищем в исходной строке, а экранируем по частям: иначе «&» из адреса ломает ссылку
  const linkify = s => s.split(/(https?:\/\/[^\s<>"]*[^\s<>".,;:!?)»])/)
    .map((part, i) => (i % 2 ? `<a href="${escapeHtml(part)}">${escapeHtml(part)}</a>` : escapeHtml(part))).join('');
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222">'
    + text.split(/\n{2,}/).map(p => `<p style="margin:0 0 14px">${p.split('\n').map(linkify).join('<br>')}</p>`).join('')
    + '</div>';
}

function stop(message) {
  console.error(message);
  rl.close();
  process.exitCode = 1;
}

(async () => {
  if (!DRY && !isEmailConfigured()) return stop('Почта на этом сервере не настроена (нет ключей Brevo/Resend/SMTP).');
  const to = ((await ask('1. Адрес почты пары — и Enter:')) || '').trim();
  if (!EMAIL_RE.test(to)) return stop('Это не похоже на адрес почты — ничего не отправлено.');
  const subject = ((await ask('2. Тема письма — и Enter:')) || '').trim();
  if (!subject) return stop('Нужна тема письма — ничего не отправлено.');
  console.log('3. Текст письма — вставьте его. В конце отдельной строкой поставьте точку «.» и нажмите Enter:');
  const lines = [];
  for (;;) {
    const line = await ask('');
    if (line === null || line.trim() === '.') break;
    lines.push(line.replace(/\s+$/, ''));
  }
  const text = lines.join('\n').trim();
  if (!text) return stop('Пустое письмо — ничего не отправлено.');

  console.log('\n──────── Письмо ────────');
  console.log(`От:   ${FROM_NAME} <${FROM}>`);
  console.log(`Кому: ${to}`);
  console.log(`Тема: ${subject}\n`);
  console.log(text);
  console.log('────────────────────────');
  if (DRY) {
    console.log(`\nHTML-версия:\n${toHtml(text)}\n\nПроверка (--dry): ничего не отправлено.`);
    rl.close();
    return;
  }
  const answer = ((await ask('Всё верно? Чтобы отправить, напишите «да» и нажмите Enter:')) || '').trim().toLowerCase();
  if (!['да', 'д', 'yes', 'y'].includes(answer)) {
    console.log('Не отправлено.');
    rl.close();
    return;
  }
  try {
    await sendEmail({ to, subject, text, html: toHtml(text), from: { email: FROM, name: FROM_NAME }, replyTo: FROM, critical: true });
    console.log(`✅ Отправлено: ${to}. Ответ придёт на ${FROM}.`);
  } catch (e) {
    console.error(`⚠️ Не отправлено: ${e.message}`);
    process.exitCode = 1;
  }
  rl.close();
})();
