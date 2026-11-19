'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ChooseTemplateLink from './ChooseTemplateLink';
import styles from './DemoActions.module.css';

/* Панель демо внизу: «← Все шаблоны» и «Создать приглашение» (в редактор с
   этим шаблоном, цель template_choose).
   «Все шаблоны»: демо открыли с нашего сайта в новой вкладке (каталог и главная
   открывают его так) — закрываем её, гость возвращается туда же, на то же место.
   Иначе (или если браузер вкладку не закрыл) — ссылка в каталог. Адреса
   страницы в referrer нет — у сайта Referrer-Policy: strict-origin, только домен. */
function toTemplates(e: React.MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  let fromSite = false;
  try {
    fromSite = !!document.referrer && new URL(document.referrer).origin === window.location.origin;
  } catch { /* битый referrer — обычный переход */ }
  if (fromSite && window.history.length <= 1) window.close();
}

export default function DemoActions({ templateId, templateName }: { templateId: string; templateName: string }) {
  // Шаблон открыл окно во весь экран (например, «Смотреть образы») — панель
  // прячем, иначе она закрывала бы низ окна: его фото и точки листания
  const [overlay, setOverlay] = useState(false);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !e.data || e.data.type !== 'wc:overlay') return;
      setOverlay(!!e.data.open);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return (
    <nav className={`${styles.bar} ${overlay ? styles.barHidden : ''}`} aria-label="Шаблон" aria-hidden={overlay || undefined}>
      <Link href="/templates" className={styles.back} onClick={toTemplates}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        Все шаблоны
      </Link>
      <ChooseTemplateLink templateId={templateId} templateName={templateName} className={styles.cta}>
        Создать приглашение
      </ChooseTemplateLink>
    </nav>
  );
}
