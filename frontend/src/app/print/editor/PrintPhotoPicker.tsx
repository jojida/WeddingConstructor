'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import type { PrintData } from '@/lib/print';
import styles from '../print.module.css';

export default function PrintPhotoPicker({ data, onChange, onBusy }: {
  data: PrintData;
  onChange: (patch: Pick<PrintData, 'photo' | 'photoPosition'>) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  async function upload(file?: File) {
    if (!file) return;
    const job = ++generation.current;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('Выберите JPG, PNG или WebP размером до 10 МБ.'); return;
    }
    setUploading(true); onBusy(true);
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      // Normalize orientation, transparency and format before sending to the PDF renderer.
      const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) { bitmap.close(); throw new Error('canvas'); }
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const jpeg = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('image')), 'image/jpeg', .94));
      const form = new FormData(); form.append('image', jpeg, 'print-photo.jpg');
      const response = await api.post<{ url: string }>('/api/upload/image', form);
      if (generation.current === job) onChange({ photo: response.data.url, photoPosition: 'xMidYMid' });
    } catch {
      if (generation.current === job) setError('Не удалось загрузить фотографию. Попробуйте ещё раз или выберите другой файл.');
    } finally {
      if (generation.current === job) { setUploading(false); onBusy(false); }
    }
  }

  return <fieldset className={styles.photoPicker}>
    <legend>Ваша фотография</legend>
    <label className={styles.field}><span>{data.photo ? 'Заменить фотографию' : 'Загрузить фотографию'}</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
    </label>
    <p className={styles.muted}>JPG, PNG или WebP, до 10 МБ. Фото автоматически впишется в рамку.</p>
    {uploading && <p role="status">Загружаем фотографию…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {data.photo && <>
      <label className={styles.field}><span>Положение фото в рамке</span>
        <select value={data.photoPosition || 'xMidYMid'} disabled={uploading} onChange={e => onChange({ photo: data.photo, photoPosition: e.target.value })}>
          {['Верх', 'Середина', 'Низ'].flatMap((row, y) => ['Слева', 'По центру', 'Справа'].map((column, x) => <option key={`${x}-${y}`} value={`x${['Min', 'Mid', 'Max'][x]}Y${['Min', 'Mid', 'Max'][y]}`}>{row} · {column.toLowerCase()}</option>))}
        </select>
      </label>
      <button className={styles.secondary} type="button" disabled={uploading} onClick={() => { setError(''); onChange({ photo: '', photoPosition: 'xMidYMid' }); }}>Вернуть фото шаблона</button>
    </>}
  </fieldset>;
}
