'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './planner.module.css';

/** Окно поверх страницы: Esc и клик мимо закрывают, фокус возвращается туда, откуда открыли.
    На телефоне — нижняя шторка (см. media в planner.module.css). */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close.current(); } };
    document.addEventListener('keydown', onKey);
    // Поле с autoFocus уже взяло фокус — не отбираем
    if (box.current && !box.current.contains(document.activeElement)) box.current.focus();
    const scroll = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = scroll;
      before?.focus?.();
    };
  }, []);

  return createPortal(
    <div className={styles.root}>
      <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
          className={`${styles.dialog} ${wide ? styles.dialogWide : ''}`}>
          <div className={styles.dialogHead}>
            <h3 className={styles.dialogTitle}>{title}</h3>
            <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Закрыть">✕</button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Меню действий: «⋯» у человека, группы, стола. Закрывается по Esc и клику снаружи. */
export function Popover({ label, button, children }: { label: string; button: ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className={styles.menuWrap} ref={wrap}>
      <button type="button" className={styles.iconBtn} aria-label={label} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}>{button}</button>
      {open && <div className={styles.menu} role="menu">{children(() => setOpen(false))}</div>}
    </span>
  );
}

export function MenuItem({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" role="menuitem" className={`${styles.menuItem} ${danger ? styles.menuDanger : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}
