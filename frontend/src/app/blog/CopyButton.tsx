'use client';
import { useEffect, useRef, useState } from 'react';
import styles from './blog.module.css';

/** «Скопировать» у готового текста. Если буфер обмена недоступен (старый браузер,
    страница не в фокусе), выделяем текст — останется нажать «Копировать» самому. */
export default function CopyButton({ text, targetId }: { text: string; targetId: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const selectText = () => {
    const el = document.getElementById(targetId);
    const sel = window.getSelection();
    if (!el || !sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      selectText();
    }
  };

  return (
    <button type="button" className={`${styles.copy} ${copied ? styles.copied : ''}`} onClick={copy} aria-live="polite">
      {copied ? '✓ Скопировано' : 'Скопировать'}
    </button>
  );
}
