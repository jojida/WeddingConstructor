'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import PhotoFrameEditor from '../../editor/PhotoFrameEditor';
import type { PrintData } from '@/lib/print';
import styles from '../print.module.css';

export default function PrintPhotoPicker({ data, templateId, onChange, onBusy }: {
  data: PrintData;
  templateId: string;
  onChange: (patch: Pick<PrintData, 'photo' | 'photoPosition' | 'photoFrame'>) => void;
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
      if (generation.current === job) onChange({ photo: response.data.url, photoPosition: 'xMidYMid', photoFrame: { x: 50, y: 50, z: 1, r: 0 } });
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
      <p className={styles.muted}>Перетаскивайте фото мышью или пальцем. Масштаб и поворот можно настроить ниже.</p>
      <PhotoFrameEditor
        src={new URL(data.photo, api.defaults.baseURL).href}
        frame={data.photoFrame || { x: data.photoPosition?.startsWith('xMin') ? 0 : data.photoPosition?.startsWith('xMax') ? 100 : 50, y: data.photoPosition?.endsWith('YMin') ? 0 : data.photoPosition?.endsWith('YMax') ? 100 : 50, z: 1, r: 0 }}
        slot={{ w: templateId === 'azure-bloom' ? 256.4 : templateId === 'floral-gold' ? 261.9 : templateId === 'newspaper' ? 248 : 525, h: templateId === 'azure-bloom' ? 422.2 : templateId === 'floral-gold' ? 262.2 : templateId === 'newspaper' ? 304 : 740, x: 50, y: 50 }}
        onChange={frame => onChange({ photo: data.photo, photoFrame: frame || { x: 50, y: 50, z: 1, r: 0 } })}
      />
      <button className={styles.secondary} type="button" disabled={uploading} onClick={() => { setError(''); onChange({ photo: '', photoPosition: 'xMidYMid', photoFrame: { x: 50, y: 50, z: 1, r: 0 } }); }}>Вернуть фото шаблона</button>
    </>}
  </fieldset>;
}
