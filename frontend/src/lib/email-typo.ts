/* Опечатка в домене почты — и код входа уходит в никуда, а человек ждёт письмо.
   Подсказываем популярный почтовый домен, если до него одна-две буквы
   (gmial.com → gmail.com, mail.ry → mail.ru). Только подсказка: адрес не меняем. */

/** Куда подсказываем. */
const POPULAR = [
  'gmail.com', 'mail.ru', 'yandex.ru', 'ya.ru', 'bk.ru', 'inbox.ru', 'list.ru', 'internet.ru',
  'rambler.ru', 'icloud.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'yandex.com',
];
/** Настоящие домены, похожие на популярные, — их не «исправляем». */
const VALID = new Set([
  ...POPULAR, 'mail.com', 'email.com', 'live.com', 'live.ru', 'me.com', 'mac.com', 'gmx.com', 'aol.com',
  'ukr.net', 'mail.ua', 'i.ua', 'tut.by', 'yandex.by', 'yandex.kz', 'yandex.ua', 'proton.me', 'protonmail.com',
]);
/** Частые опечатки, которые по числу букв ближе к другому домену. */
const KNOWN: Record<string, string> = { 'gmail.ru': 'gmail.com', 'gmail.ry': 'gmail.com', 'jmail.com': 'gmail.com' };

/** Расстояние Дамерау–Левенштейна: вставка, удаление, замена, перестановка соседних. */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i ? (j ? 0 : i) : j)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/* Mail.ru (17.10.26) отклоняет часть наших писем с кодом как спам
   («550 spam message rejected») — подсказываем другую почту, если код не пришёл. */
const MAILRU = new Set(['mail.ru', 'bk.ru', 'inbox.ru', 'list.ru', 'internet.ru', 'mail.ua']);
export const isMailRuAddress = (email: string): boolean => MAILRU.has(email.trim().toLowerCase().split('@')[1] || '');

/** Исправленный адрес, если в домене похоже на опечатку, иначе null. */
export function emailTypoFix(email: string): string | null {
  const m = /^([^@\s]+)@([^@\s]+)$/.exec(email.trim().toLowerCase());
  if (!m) return null;
  const [, local, domain] = m;
  if (KNOWN[domain]) return `${local}@${KNOWN[domain]}`;
  if (VALID.has(domain)) return null;
  let best = '';
  let bestDistance = Infinity;
  for (const candidate of POPULAR) {
    const dist = distance(domain, candidate);
    if (dist < bestDistance) { best = candidate; bestDistance = dist; }
  }
  // У коротких доменов (ya.ru, bk.ru) две буквы — это уже другой адрес
  return bestDistance <= (best.length <= 5 ? 1 : 2) ? `${local}@${best}` : null;
}
