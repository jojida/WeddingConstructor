import crypto from 'crypto';

/* ── Тестовые аккаунты ───────────────────────────────────────────────────────

   Владельцу сервиса нужно проверять боевой сайт целиком: публикацию, ссылку
   для гостей, анкету, уведомления, кабинет гостей. Через кассу это значило бы
   покупать собственный продукт на каждую проверку, поэтому такие аккаунты
   публикуют и меняют тариф без оплаты.

   Адрес держим не текстом, а sha256: репозиторий открытый, а почта владельца
   в нём — приглашение для спама. На сравнение это не влияет.

   Новый хеш:  node -e "console.log(require('crypto').createHash('sha256')
                 .update('почта@example.com'.trim().toLowerCase()).digest('hex'))"

   Можно и без правки кода — переменной окружения бэкенда:
     FREE_ACCOUNTS="a@mail.ru, b@mail.ru"
   (после правки: pm2 restart wedding-api --update-env)                      */

const HASHES = new Set<string>([
  // sha256 почты владельца
]);

/** sha256 нормализованной почты — ровно так заполняется HASHES. */
export function emailHash(email: string): string {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

const fromEnv = (): string[] =>
  (process.env.FREE_ACCOUNTS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** Публикует ли этот аккаунт бесплатно (тестовый аккаунт владельца). */
export function isFreeAccount(email: string | null | undefined): boolean {
  const e = (email || '').trim().toLowerCase();
  if (!e) return false;
  return HASHES.has(emailHash(e)) || fromEnv().includes(e);
}
