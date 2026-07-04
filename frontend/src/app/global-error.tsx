'use client';
import { useEffect } from 'react';

/* Корневая граница ошибок. Ловит то, что НЕ ловит error.tsx: исключения в
   корневом layout, в провайдерах и ошибки уровня роутера (например, срыв
   загрузки чанка при переходе — ChunkLoadError). Заменяет стандартный пустой
   экран Next.js «This page couldn't load» на экран с реальной причиной.
   Должен объявлять собственные <html>/<body>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[GlobalError]', error); }, [error]);

  const isChunk = /chunk|dynamically imported module|Loading.*failed|Failed to fetch/i.test(
    `${error?.name} ${error?.message}`,
  );

  return (
    <html lang="ru">
      <body style={{ margin: 0, background: '#faf8f5', fontFamily: 'Georgia, serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 500, width: '100%', background: '#fff', border: '1px solid rgba(206,197,186,0.5)', borderRadius: 16, padding: '32px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>😔</div>
            <h1 style={{ fontSize: 24, color: '#0e1d26', margin: '0 0 8px' }}>Страница не загрузилась</h1>
            <p style={{ fontSize: 14, color: '#7d766c', lineHeight: 1.6, margin: '0 0 20px', fontFamily: 'system-ui, sans-serif' }}>
              {isChunk
                ? 'Обновилась версия сайта. Обновите страницу — это исправит ошибку.'
                : 'Произошла ошибка. Попробуйте обновить страницу.'}
            </p>

            {error?.message && (
              <pre style={{
                textAlign: 'left', fontSize: 12, color: '#a3453f', background: '#fbf3f2',
                border: '1px solid rgba(184,92,92,0.25)', borderRadius: 8, padding: '10px 12px',
                margin: '0 0 20px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 180, overflow: 'auto',
                fontFamily: 'ui-monospace, monospace',
              }}>
                {error.name ? error.name + ': ' : ''}{error.message}{error.digest ? `\n\ndigest: ${error.digest}` : ''}
              </pre>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', fontFamily: 'system-ui, sans-serif' }}>
              <button onClick={() => (isChunk ? window.location.reload() : reset())}
                style={{ padding: '11px 24px', fontSize: 14, background: '#685d4a', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                Обновить
              </button>
              <a href="/dashboard"
                style={{ padding: '11px 24px', fontSize: 14, background: 'transparent', color: '#685d4a', border: '1px solid rgba(206,197,186,0.8)', borderRadius: 10, textDecoration: 'none' }}>
                В кабинет
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
