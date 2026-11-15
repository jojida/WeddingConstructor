'use client';

import React from 'react';
import Link from 'next/link';
import ChooseTemplateLink from './ChooseTemplateLink';
import styles from './DemoActions.module.css';

/* Крестик сверху справа — на всех экранах. Демо открывается из каталога в
   новой вкладке — крестик её закрывает. Если на демо пришли в той же вкладке,
   закрывать нечего — крестик возвращает на предыдущую страницу. Если браузер
   вкладку не закрыл, ссылка ведёт в каталог. */
function closeDemo(e: React.MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (window.history.length > 1) {
    e.preventDefault();
    window.history.back();
    return;
  }
  window.close();
}

export default function DemoActions({ templateId, templateName }: { templateId: string; templateName: string }) {
  return (
    <>
      <Link href="/templates" className={styles.close} aria-label="Закрыть" onClick={closeDemo}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </Link>
      <ChooseTemplateLink templateId={templateId} templateName={templateName} className={styles.choose}>
        Выбрать этот шаблон
      </ChooseTemplateLink>
    </>
  );
}
