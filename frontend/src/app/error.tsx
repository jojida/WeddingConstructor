'use client';
import { useEffect } from 'react';
import Link from 'next/link';

/* Граница ошибок уровня приложения. Ловит исключения при рендере любых
   страниц (кабинет, редактор и т.д.) и показывает понятный экран с реальным
   текстом ошибки вместо стандартного пустого «This page couldn't load».
   error.tsx НЕ ловит ошибки в корневом layout — это задача global-error. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Логируем в консоль, чтобы причина была видна в DevTools и в отчётах.
    console.error('[AppError]', error);
  }, [error]);

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', background: '#fff', border: '1px solid rgba(206,197,186,0.5)', borderRadius: 16, padding: '32px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>😔</div>
        <h1 style={{ fontFamily: 'var(--font-playfair, Georgia), serif', fontSize: 24, color: '#0e1d26', margin: '0 0 8px' }}>
          Страница не загрузилась
        </h1>
        <p style={{ fontSize: 14, color: '#7d766c', lineHeight: 1.6, margin: '0 0 20px' }}>
          Произошла ошибка. Попробуйте обновить страницу — обычно это помогает.
        </p>

        {error?.message && (
          <pre style={{
            textAlign: 'left', fontSize: 12, color: '#a3453f', background: '#fbf3f2',
            border: '1px solid rgba(184,92,92,0.25)', borderRadius: 8, padding: '10px 12px',
            margin: '0 0 20px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflow: 'auto',
          }}>
            {error.message}{error.digest ? `\n\ndigest: ${error.digest}` : ''}
          </pre>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => reset()} className="btn-primary" style={{ padding: '11px 24px', fontSize: 14 }}>
            Обновить
          </button>
          <Link href="/dashboard" className="btn-outline" style={{ textDecoration: 'none', padding: '11px 24px', fontSize: 14 }}>
            В кабинет
          </Link>
        </div>
      </div>
    </div>
  );
}
