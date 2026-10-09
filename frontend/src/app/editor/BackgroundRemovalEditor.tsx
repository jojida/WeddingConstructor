'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import styles from './page.module.css';

export interface PhotoCutout { originalUrl: string; resultUrl: string; }

/* Пока курсор на «Убрать фон», сервер заранее поднимает модель: холодный старт на
   сервере занимал несколько секунд. Не чаще раза в полторы минуты — сервер держит
   модель две минуты, а адрес считается в общий лимит загрузок. */
let warmedAt = 0;
function warmModel() {
  if (Date.now() - warmedAt < 90_000) return;
  warmedAt = Date.now();
  api.post('/api/upload/remove-background/warm').catch(() => {});
}

export default function BackgroundRemovalEditor({ src, originalUrl, saved, apiBase, onApply, onRestore }: {
  src: string; originalUrl: string; saved?: PhotoCutout;
  apiBase: string; onApply: (photo: PhotoCutout) => void; onRestore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const controller = useRef<AbortController | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { controller.current?.abort(); setBusy(false); setOpen(false); }
      if (event.key === 'Tab') {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
  }, [open]);

  const start = async () => {
    setOpen(true); setBusy(true); setResult('');
    const abort = new AbortController();
    controller.current = abort;
    try {
      const options = { signal: abort.signal, timeout: 55_000 };
      // Своё фото уже лежит на сервере — передаём адрес, а не скачиваем оригинал
      // и не загружаем его обратно (на телефоне это было основное ожидание).
      const uploaded = src.startsWith(apiBase + '/uploads/') ? src.slice(apiBase.length).split(/[?#]/)[0] : '';
      let output = uploaded
        ? await api.post<{ url: string }>('/api/upload/remove-background/existing', { source: uploaded }, options)
          .catch((error: unknown) => {
            // Старое имя файла или сервер без этого адреса — по-старому, загрузкой файла
            const status = axios.isAxiosError(error) ? error.response?.status : 0;
            if (status === 400 || status === 404) return null;
            throw error;
          })
        : null;
      if (!output) {
        const response = await fetch(src, { signal: abort.signal });
        if (!response.ok) throw new Error('Не удалось загрузить исходное фото.');
        const form = new FormData();
        form.append('image', await response.blob(), 'photo');
        output = await api.post<{ url: string }>('/api/upload/remove-background', form, options);
      }
      if (!abort.signal.aborted) setResult(output.data.url);
    } catch (error) {
      if (!abort.signal.aborted) {
        const message = axios.isAxiosError<{ error?: string }>(error) ? error.response?.data?.error : error instanceof Error ? error.message : '';
        toast.error(message || 'Не удалось удалить фон. Попробуйте ещё раз.');
        setOpen(false);
      }
    } finally { if (!abort.signal.aborted) setBusy(false); }
  };
  const close = () => { controller.current?.abort(); setBusy(false); setOpen(false); };

  return <>
    <div className={styles.cutoutActions}>
      {saved ? <button type="button" onClick={onRestore}>Вернуть оригинал</button>
        : <button type="button" onClick={start} disabled={!src || busy} onPointerEnter={warmModel} onFocus={warmModel}>✂ Убрать фон</button>}
    </div>
    {open && createPortal(<div className={styles.cutoutBackdrop} onClick={close}>
      <div ref={dialogRef} className={styles.cutoutDialog} role="dialog" aria-modal="true" aria-labelledby="cutout-title" onClick={event => event.stopPropagation()}>
        <div className={styles.cutoutHeading}>
          <h2 id="cutout-title">Удаление фона</h2>
          <button type="button" ref={closeRef} onClick={close} aria-label="Закрыть удаление фона">×</button>
        </div>
        {busy ? <div className={styles.cutoutPending} role="status">Выделяем людей на фото…<span>Это может занять несколько секунд.</span></div>
          : <>
            <div className={styles.cutoutComparison}>
              <figure><img src={src} alt="Исходное фото" /><figcaption>Оригинал</figcaption></figure>
              <figure><div className={styles.cutoutChecker}><img src={apiBase + result} alt="Фото без фона" /></div><figcaption>Без фона</figcaption></figure>
            </div>
            <p className={styles.cutoutHint}>Проверьте края волос и одежды. После применения фото появится на обложке без рамки.</p>
          </>}
        <div className={styles.cutoutFooter}>
          <button type="button" onClick={close}>Отмена</button>
          {!busy && result && <button type="button" onClick={() => { onApply({ originalUrl, resultUrl: result }); setOpen(false); }}>Применить</button>}
        </div>
      </div>
    </div>, document.body)}
  </>;
}
