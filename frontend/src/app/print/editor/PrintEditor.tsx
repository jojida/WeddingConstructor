'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Download, ArrowLeft, LockKeyhole } from 'lucide-react';
import axios from 'axios';
import api from '@/lib/api';
import { PRINT_FIELDS, PRINT_PRICE, getPrintSample, PRINT_TEMPLATES, PRINT_PHOTO_TEMPLATES, printDimensions, type PrintData, type PrintOrder } from '@/lib/print';
import PrintPhotoPicker from './PrintPhotoPicker';
import { useAuthStore } from '@/store/auth';
import Navbar from '@/components/Navbar';
import dynamic from 'next/dynamic';
import styles from '../print.module.css';

const AuthModal = dynamic(() => import('@/components/AuthModal'));

const errorMessage = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.error || 'Не удалось соединиться с сервером. Попробуйте ещё раз.' : 'Не удалось выполнить действие. Попробуйте ещё раз.';
export default function PrintEditor() {
  const params = useSearchParams();
  const { user } = useAuthStore();
  return <EditorSession key={`${params.toString()}:${user?.id || 'guest'}`} />;
}
function EditorSession() {
  const params = useSearchParams(); const router = useRouter();
  const orderId = params.get('order');
  const requestedTemplate = params.get('template') || 'vow';
  const { user, loading: authLoading } = useAuthStore();
  const [data, setData] = useState<PrintData>(() => getPrintSample(requestedTemplate));
  const [order, setOrder] = useState<PrintOrder | null>(null);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState(params.get('checkout') === 'retry' ? 'Макет сохранён. Оплату не удалось открыть — попробуйте ещё раз позже.' : ''); const [busy, setBusy] = useState(false);
  const [showAuth, setShowAuth] = useState(false); const [saved, setSaved] = useState(false);
  const templateId = order?.templateId || requestedTemplate;
  const template = PRINT_TEMPLATES.find(t => t.id === templateId);
  useEffect(() => {
    let active = true;
    if (orderId) {
      if (!user) return;
      api.get<PrintOrder>(`/api/print/orders/${encodeURIComponent(orderId)}`).then(({ data: value }) => { if (active) { setOrder(value); setData(value.data); setReady(true); } }).catch(e => { if (active) setError(errorMessage(e)); });
    } else {
      // Hydrate the browser-only draft after the server render; the session key resets navigation.
      queueMicrotask(() => {
        if (!active) return;
        try { const raw = localStorage.getItem(`wc_print_${requestedTemplate}`); const cached = raw ? JSON.parse(raw) : null; setData(cached && PRINT_FIELDS.every(f => typeof cached[f.key] === 'string') ? cached : getPrintSample(requestedTemplate)); } catch { setData(getPrintSample(requestedTemplate)); }
        setReady(true);
      });
    }
    return () => { active = false; };
  }, [orderId, requestedTemplate, user]);
  useEffect(() => {
    if (!ready || !template) return;
    if (!orderId) { try { localStorage.setItem(`wc_print_${templateId}`, JSON.stringify(data)); } catch { /* Editor still works when storage is unavailable. */ } }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api.post('/api/print/preview', { templateId, data }, { signal: controller.signal, responseType: 'text' }).then(res => {
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(new Blob([res.data], { type: 'image/svg+xml' })); setPreview(url); setPreviewError('');
      }).catch(e => { if (!controller.signal.aborted) { setPreview(''); setPreviewError(axios.isAxiosError(e) && e.response?.status === 400 ? 'Заполните имена, дату, время и место торжества для предпросмотра.' : 'Предпросмотр недоступен. Проверьте подключение и измените поле, чтобы повторить.'); } });
    }, 450);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [data, ready, template, templateId, orderId]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const orderStatus = order?.status;
  const paymentStatus = order?.paymentStatus;
  useEffect(() => {
    if (!orderId || !user || !orderStatus || orderStatus === 'paid' || paymentStatus === 'canceled') return;
    let active = true; let attempts = 0;
    const timer = setInterval(() => {
      if (++attempts > 24) { clearInterval(timer); return; }
      api.get<PrintOrder>(`/api/print/orders/${encodeURIComponent(orderId)}`).then(res => { if (active) setOrder(res.data); }).catch(() => {});
    }, 5000);
    return () => { active = false; clearInterval(timer); };
    // Payment polling must not replace text currently being edited.
  }, [orderId, user, orderStatus, paymentStatus]);
  async function persist() {
    if (orderId) { await api.put(`/api/print/orders/${encodeURIComponent(orderId)}`, { data }); return orderId; }
    const result = await api.post<{ id: string }>('/api/print/orders', { templateId, data });
    return result.data.id;
  }
  async function purchase(event: React.FormEvent) {
    event.preventDefault();
    if (photoBusy) return;
    if (!user) { setShowAuth(true); return; }
    setBusy(true); setError('');
    let id: string | undefined;
    try { id = await persist(); const result = await api.post(`/api/print/orders/${id}/pay`); window.location.assign(result.data.paymentUrl); return; }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
    if (id && !orderId) router.replace(`/print/editor?order=${id}&checkout=retry`);
  }
  async function download(bleed: boolean) {
    if (!orderId || busy || photoBusy) return;
    setBusy(true); setError('');
    try {
      await persist();
      const res = await api.get(`/api/print/orders/${encodeURIComponent(orderId)}/pdf?bleed=${bleed ? '1' : '0'}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data); const a = document.createElement('a'); a.href = url; a.download = `weddingcraft-${templateId}${bleed ? '-bleed' : '-a6'}.pdf`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); setSaved(true);
    } catch { setError('Не удалось скачать PDF. Проверьте оплату и подключение, затем попробуйте снова.'); } finally { setBusy(false); }
  }
  if (!template && !orderId) return <><Navbar /><main className={styles.page}><div className={styles.notice}><h1>Дизайн не найден</h1><Link href="/print" className={styles.primary}>Открыть коллекцию</Link></div></main></>;
  return <><Navbar /><main className={styles.page}><div className={`${styles.editor} ${styles.editorWide}`}>
    <div className={styles.editorHeader}><div><Link href="/print" className={styles.back}><ArrowLeft size={12} /> Все дизайны</Link><h1>{template?.name || 'Ваше приглашение'}</h1></div><Link href="/print/orders" className={styles.secondary}>Мои приглашения</Link></div>
    {orderId && !user ? <div className={styles.notice}><h1>Ваш макет сохранён</h1><p className={styles.muted}>Войдите с email, который использовали при покупке, чтобы открыть приглашение и скачать PDF.</p><button className={styles.primary} disabled={authLoading} onClick={() => setShowAuth(true)}>Войти по email</button></div> : !ready ? <div className={styles.notice}><p role="status">{error || 'Загружаем макет…'}</p><Link href="/print/orders">Мои приглашения</Link></div> : <div className={styles.editorGrid}>
      <div className={styles.previewPanel}><div className={styles.previewMat}>{previewError ? <p className={styles.error} role="alert">{previewError}</p> : <img src={preview || `/print/${templateId}.svg`} alt="Предпросмотр вашего приглашения" />}</div><p className={styles.previewCaption}>A6 · {printDimensions(templateId)} · В скачанном PDF водяного знака нет</p></div>
      <form className={styles.form} onSubmit={purchase}><h2>Всё начинается с ваших слов</h2><p className={styles.muted}>Заполните детали — приглашение обновится рядом.</p>
        {PRINT_PHOTO_TEMPLATES.includes(templateId) && <PrintPhotoPicker templateId={templateId} data={data} onBusy={setPhotoBusy} onChange={patch => { setData(d => ({ ...d, ...patch })); setSaved(false); }} />}
        <div className={styles.fields}>{PRINT_FIELDS.map((field, i) => <label key={field.key} className={`${styles.field} ${i > 3 ? styles.wide : ''}`}><span>{field.label}</span>{'type' in field && field.type === 'textarea' ? <textarea value={data[field.key]} maxLength={field.max} onChange={e => { setData(d => ({ ...d, [field.key]: e.target.value })); setSaved(false); }} /> : <input type={'type' in field ? field.type : 'text'} value={data[field.key]} maxLength={field.max} required={['groom', 'bride', 'date', 'time', 'venue'].includes(field.key)} onChange={e => { setData(d => ({ ...d, [field.key]: e.target.value })); setSaved(false); }} />}{i > 3 && <small>{data[field.key].length} / {field.max}</small>}</label>)}</div>
        <div className={styles.checkout}>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {order?.status === 'paid' ? <><p className={styles.success}>{user?.free ? 'Тестовый доступ. Ваш PDF готов к печати.' : 'Оплачено. Ваш PDF готов к печати.'}{saved && ' Изменения сохранены.'}</p><button type="button" className={styles.primary} disabled={busy || photoBusy || !!previewError} onClick={() => download(false)}><Download size={16} /> {busy ? 'Готовим файл…' : 'Скачать PDF · A6'}</button><button type="button" className={styles.secondary} disabled={busy || photoBusy || !!previewError} onClick={() => download(true)}>PDF для типографии · вылеты 3 мм</button><p className={styles.muted}>Домашняя печать: масштаб 100%, без подгонки. Типография: вылеты по 3 мм с каждой стороны, обрезка до A6. Текст и фото сохраняются при скачивании.</p></> : <>
            {order?.paymentStatus === 'pending' && <p className={styles.success}>Ожидаем оплату. После подтверждения здесь появится скачивание. Если окно оплаты закрыто — нажмите кнопку ниже.</p>}
            {order?.paymentStatus === 'canceled' && <p className={styles.error}>Платёж отменён. Макет сохранён, можно попробовать оплатить ещё раз.</p>}
            {order?.paymentStatus === 'unavailable' && <p className={styles.error}>Проверка оплаты временно недоступна. Мы повторим её автоматически.</p>}
            <div className={styles.priceLine}><span>Ваш дизайн · навсегда в аккаунте</span><b>{user?.free ? 'Бесплатно' : `${PRINT_PRICE} ₽`}</b></div><button className={styles.primary} disabled={busy || photoBusy || !!previewError || authLoading}><LockKeyhole size={15} />{busy ? 'Подготавливаем…' : user?.free ? 'Открыть PDF бесплатно' : `Купить PDF за ${PRINT_PRICE} ₽`}</button><p className={styles.muted}>Разовая оплата за один дизайн. Повторные скачивания, правки текста и замена фото включены. Печать и доставка не входят. Нажимая «Купить», вы принимаете <Link href="/oferta">оферту</Link>.</p>
          </>}
        </div>
      </form>
    </div>}
  </div></main>{showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />}</>;
}
