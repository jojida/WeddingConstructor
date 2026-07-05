import Link from 'next/link';

/* Экран для неоплаченного сайта-приглашения (бэкенд ответил 402).
   Видят и гости, открывшие ссылку раньше времени, и сама пара —
   поэтому есть мягкий CTA в кабинет для владельца. */
export default function UnpublishedNotice() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#faf8f5', padding: 20, fontFamily: 'var(--font-inter, sans-serif)',
    }}>
      <div style={{
        maxWidth: 460, width: '100%', textAlign: 'center', background: '#fff',
        border: '1px solid rgba(206,197,186,0.5)', borderRadius: 20,
        padding: '48px 32px', boxShadow: '0 20px 60px rgba(14,29,38,0.06)',
      }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>💌</div>
        <h1 style={{ fontFamily: 'var(--font-playfair, Georgia), serif', fontSize: 27, color: '#0e1d26', margin: '0 0 10px' }}>
          Сайт ещё не опубликован
        </h1>
        <p style={{ fontSize: 15, color: '#7d766c', lineHeight: 1.6, margin: '0 0 26px' }}>
          Приглашение готовится и станет доступно, как только пара его опубликует.
          Загляните чуть позже.
        </p>
        <div style={{ borderTop: '1px solid rgba(206,197,186,0.4)', paddingTop: 22 }}>
          <p style={{ fontSize: 13, color: '#9a948a', margin: '0 0 14px' }}>
            Это ваш сайт? Войдите в кабинет и завершите оплату — ссылка заработает сразу.
          </p>
          <Link href="/dashboard" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none', padding: '12px 28px', fontSize: 14 }}>
            Перейти в кабинет
          </Link>
        </div>
        <div style={{ marginTop: 26 }}>
          <Link href="/" style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c9a96e', textDecoration: 'none' }}>
            WeddingCraft — сайты-приглашения
          </Link>
        </div>
      </div>
    </div>
  );
}
