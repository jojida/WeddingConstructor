'use client';

import React, { useSyncExternalStore } from 'react';
import Link from 'next/link';
import ChooseTemplateLink from './ChooseTemplateLink';
import styles from './DemoActions.module.css';

/* Демо открывается из каталога в новой вкладке — её можно закрыть (крестик).
   Если на демо пришли в той же вкладке, закрывать нечего — стрелка «назад».
   Если браузер вкладку не закрыл, ссылка ведёт в каталог. */
const noop = () => () => {};
const canGoBack = () => window.history.length > 1;

function closeDemo(e: React.MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  window.close();
}

export default function DemoActions({ templateId, templateName }: { templateId: string; templateName: string }) {
  const back = useSyncExternalStore(noop, canGoBack, () => false);
  return (
    <>
      {/* Компьютер и планшет — панель слева внизу */}
      <div className={styles.panel} style={{
        position: 'fixed',
        bottom: '32px',
        left: '32px',
        display: 'flex',
        flexWrap: 'wrap',
        // справа внизу — кнопка музыки шаблона (44px в 16px от края), не закрываем её
        maxWidth: 'calc(100vw - 108px)',
        gap: '12px',
        zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        padding: '12px',
        borderRadius: '16px',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <Link
          href="/templates"
          onClick={closeDemo}
          style={{
            padding: '12px 24px',
            borderRadius: '50px',
            background: 'rgba(255,255,255,0.1)',
            color: '#fff',
            textDecoration: 'none',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            fontWeight: 500,
            border: '1px solid rgba(255,255,255,0.2)',
            cursor: 'pointer'
          }}
        >
          Закрыть
        </Link>
        <ChooseTemplateLink
          templateId={templateId}
          templateName={templateName}
          style={{
            padding: '12px 32px',
            borderRadius: '50px',
            background: 'linear-gradient(135deg, #d3c5ad, #685d4a)',
            color: '#fff',
            textDecoration: 'none',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(104, 93, 74, 0.3)',
            cursor: 'pointer'
          }}
        >
          Выбрать этот шаблон
        </ChooseTemplateLink>
      </div>

      {/* Телефон — крестик (или «назад») сверху справа и маленькая кнопка выбора внизу */}
      {back ? (
        <Link href="/templates" className={styles.close} aria-label="Назад"
          onClick={e => { e.preventDefault(); window.history.back(); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
        </Link>
      ) : (
        <Link href="/templates" className={styles.close} aria-label="Закрыть" onClick={closeDemo}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
      )}
      <ChooseTemplateLink templateId={templateId} templateName={templateName} className={styles.choose}>
        Выбрать этот шаблон
      </ChooseTemplateLink>
    </>
  );
}
