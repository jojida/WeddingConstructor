'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { PRINT_TEMPLATES, type PrintOrder } from '@/lib/print';
import styles from '../print.module.css';
export default function PrintOrders() {
  const { user } = useAuthStore();
  return <OrdersSession key={user?.id || 'guest'} />;
}
function OrdersSession() {
  const { user, loading } = useAuthStore(); const [orders, setOrders] = useState<PrintOrder[]>([]); const [busy, setBusy] = useState(true); const [error, setError] = useState(false); const [auth, setAuth] = useState(false); const [retry, setRetry] = useState(0);
  useEffect(() => { if (!user) return; let active = true; api.get<PrintOrder[]>('/api/print/orders').then(res => { if (active) setOrders(res.data); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setBusy(false); }); return () => { active = false; }; }, [user, retry]);
  return <><Navbar /><main className={styles.page}><div className={styles.editor}><div className={styles.editorHeader}><div><Link className={styles.back} href="/dashboard">← Личный кабинет</Link><h1>Мои печатные приглашения</h1></div><Link href="/print" className={styles.secondary}>Выбрать дизайн</Link></div>
    {loading ? <p>Загрузка…</p> : !user ? <div className={styles.notice}><p>Войдите, чтобы увидеть покупки и сохранённые макеты.</p><button className={styles.primary} onClick={() => setAuth(true)}>Войти по email</button></div> : busy ? <p role="status">Загружаем приглашения…</p> : error ? <div className={styles.notice}><p className={styles.error}>Не удалось загрузить приглашения.</p><button className={styles.secondary} onClick={() => { setBusy(true); setError(false); setRetry(r => r + 1); }}>Повторить</button></div> : orders.length ? <div className={styles.orderList}>{orders.map(o => <article key={o.id} className={styles.order}><img src={`/print/${o.templateId}.svg`} alt={`Дизайн «${PRINT_TEMPLATES.find(t => t.id === o.templateId)?.name}»`} /><h2>{o.data.groom} и {o.data.bride}</h2><p className={styles.muted}>{PRINT_TEMPLATES.find(t => t.id === o.templateId)?.name} · {o.status === 'paid' ? 'Оплачено' : 'Черновик'}</p><Link className={styles.primary} href={`/print/editor?order=${o.id}`}>{o.status === 'paid' ? 'Открыть и скачать PDF' : 'Продолжить оформление'}</Link></article>)}</div> : <div className={styles.notice}><h1>Здесь будет ваша бумажная история</h1><p className={styles.muted}>Выберите дизайн, добавьте детали вашей свадьбы — и макет останется в аккаунте.</p><Link href="/print" className={styles.primary}>Посмотреть коллекцию</Link></div>}
  </div></main>{auth && <AuthModal onClose={() => setAuth(false)} onSuccess={() => setAuth(false)} />}</>;
}
