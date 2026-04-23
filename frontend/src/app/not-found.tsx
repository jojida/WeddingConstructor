import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '24px',
      background: 'linear-gradient(160deg, #fdf6ec, #f0e4cc)',
      fontFamily: 'var(--font-inter)',
      textAlign: 'center',
      padding: '24px',
    }}>
      <div style={{ fontSize: '64px' }}>💌</div>
      <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '48px', color: '#1a1a2e', margin: 0 }}>404</h1>
      <p style={{ fontSize: '20px', color: '#6b7280', maxWidth: '400px', lineHeight: 1.6, margin: 0 }}>
        Страница не найдена или приглашение ещё не оплачено
      </p>
      <Link href="/" style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '13px 32px',
        background: 'linear-gradient(135deg, #e8d5a3, #c9a96e)',
        color: '#1a1a2e',
        borderRadius: '50px',
        textDecoration: 'none',
        fontWeight: 600,
        fontSize: '15px',
      }}>
        ← На главную
      </Link>
    </div>
  );
}
