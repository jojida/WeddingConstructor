'use client';
import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { isAdvancedPlan, LEGAL } from '@/lib/constants';
import { reachGoal, GOAL } from '@/lib/metrika';
import styles from './page.module.css';

/* ЮKassa возвращает покупателя на return_url ЛЮБЫМ исходом — и после успешной
   оплаты, и после отмены. Поэтому страница не имеет права поздравлять сразу:
   сначала подтверждаем оплату (вебхук или дозапрос статуса), и только потом
   показываем ссылку. Если за минуту подтверждения нет — честно об этом говорим. */

const POLL_MS = 2500;
const MAX_TRIES = 24; // ~60 секунд ожидания

type PayState = 'checking' | 'paid' | 'stalled';

function SuccessContent() {
  const searchParams = useSearchParams();
  const inviteId = searchParams.get('id') || '';
  const targetPlan = searchParams.get('plan') || '';
  const returnToken = searchParams.get('token') || '';
  /* Тестовому аккаунту кассу не показывали — поздравлять с оплатой нечестно. */
  const isFree = !!useAuthStore((st) => st.user)?.free || targetPlan === 'free';
  const [invite, setInvite] = useState<any>(null);
  const [state, setState] = useState<PayState>('checking');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const runRef = useRef(0);

  const stop = useCallback(() => {
    runRef.current += 1;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  const startPolling = useCallback(() => {
    stop();
    if (!inviteId) { setState('stalled'); return; }
    const run = runRef.current;
    let tries = 0;
    const deadline = Date.now() + MAX_TRIES * POLL_MS;
    setState('checking');
    setPaymentStatus('');
    setInvite(null);

    const check = async () => {
      if (run !== runRef.current) return;
      tries += 1;
      const request = new AbortController();
      requestRef.current = request;
      try {
        // The return token grants access only to this payment status, even when
        // the purchaser returns from another browser without their login session.
        const st = await api.get(`/api/payment/public-status/${encodeURIComponent(inviteId)}`, {
          params: returnToken ? { token: returnToken } : undefined,
          signal: request.signal,
          timeout: Math.max(1, Math.min(10_000, deadline - Date.now())),
        });
        if (run !== runRef.current) return;
        if (st.data.paymentStatus) setPaymentStatus(st.data.paymentStatus);
        if (st.data.paid && (!targetPlan || st.data.plan === targetPlan)) {
          stop();
          // Бесплатный тариф тоже приходит сюда как «paid» — в оплаты его не пишем.
          if (st.data.plan === 'free') reachGoal(GOAL.freePublish);
          else reachGoal(GOAL.paymentSuccess, { plan: st.data.plan });
          setInvite({ id: inviteId, slug: st.data.slug, plan: st.data.plan });
          setState('paid');
          return;
        }
        // Платёж отменён — ждать больше нечего.
        if (st.data.paymentStatus === 'canceled') { stop(); setState('stalled'); return; }
      } catch (error) {
        if (run !== runRef.current) return;
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status === 401 || status === 403) {
          stop(); setPaymentStatus('auth-required'); setState('stalled'); return;
        }
      }
      if (run !== runRef.current) return;
      if (tries >= MAX_TRIES || Date.now() >= deadline) { stop(); setState('stalled'); return; }
      // Await each request before the next: slow connections cannot accumulate
      // concurrent status requests, and unmounted pages cannot restart polling.
      timerRef.current = setTimeout(check, Math.min(POLL_MS, deadline - Date.now()));
    };

    void check();
  }, [inviteId, targetPlan, returnToken, stop]);

  useEffect(() => { startPolling(); return stop; }, [startPolling, stop]);

  // Канонический адрес сайта пары — короткий, без /invite (его же отдаёт кабинет).
  const siteUrl = invite ? `${window.location.origin}/${invite.slug}` : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Не удалось скопировать. Выделите ссылку вручную.'); }
  };

  const title = state === 'paid' ? (isFree ? 'Сайт опубликован!' : 'Оплата прошла!')
    : state === 'checking' ? (isFree ? 'Публикуем сайт…' : 'Проверяем оплату…')
      : paymentStatus === 'auth-required' ? 'Войдите для проверки оплаты'
      : paymentStatus === 'canceled' ? 'Платёж не прошёл' : 'Оплата пока не подтверждена';

  const subtitle = state === 'paid' ? 'Ваш сайт-приглашение готов к отправке гостям'
    : state === 'checking' ? 'Это занимает несколько секунд — не закрывайте страницу'
      : paymentStatus === 'auth-required' ? 'Ссылка проверки истекла. Войдите в свой аккаунт и откройте приглашение в личном кабинете.'
      : paymentStatus === 'canceled' ? 'Платёж был отменён, деньги не списаны'
        : 'Банк ещё не подтвердил платёж. Если деньги списались, сайт активируется автоматически';

  return (
    <div className={styles.page}>
      {state === 'paid' && (
        <div className={styles.confetti}>
          {['🎊','✨','💍','🌸','🎉','💕','✦','🥂'].map((e, i) => (
            <span key={i} className={styles.emoji} style={{ '--i': i } as React.CSSProperties}>{e}</span>
          ))}
        </div>
      )}
      <div className={styles.card}>
        {state === 'paid' && <div className={styles.check}>✓</div>}
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>

        {state === 'paid' && invite ? (
          <>
            <div className={styles.linkBox}>
              <div className={styles.linkLabel}>Ссылка для гостей</div>
              <div className={styles.link}>{siteUrl}</div>
              <button id="copy-link" className="btn-primary" onClick={copyLink} style={{ width: '100%', marginTop: 12 }}>
                {copied ? '✓ Скопировано!' : '📋 Скопировать ссылку'}
              </button>
            </div>
            <div className={styles.actions}>
              <Link href={`/${invite.slug}`} target="_blank" className="btn-outline">
                Открыть сайт
              </Link>
              <Link href="/dashboard" className={styles.dashLink}>
                Мои приглашения →
              </Link>
            </div>

            {isAdvancedPlan(invite.plan) && (
              <div style={{ marginTop: 20, padding: '16px 18px', background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.4)', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#8a6d2f', marginBottom: 4 }}>✦ Доступен кабинет гостей</div>
                <p style={{ fontSize: 13, color: '#7d6a45', margin: '0 0 12px' }}>
                  Добавьте гостей и получите для каждого персональную ссылку с именным обращением.
                </p>
                <Link href={`/dashboard/${invite.id}`} className="btn-primary" style={{ textDecoration: 'none', padding: '10px 22px', fontSize: 14 }}>
                  Перейти к гостям →
                </Link>
              </div>
            )}
          </>
        ) : state === 'checking' ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>Подтверждаем платёж…</p>
          </div>
        ) : (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {paymentStatus === 'auth-required' && <Link href="/auth" className="btn-primary">Войти в аккаунт</Link>}
              <button className="btn-primary" onClick={startPolling}>Проверить ещё раз</button>
              <Link href={inviteId ? `/payment?id=${inviteId}` : '/dashboard'} className="btn-outline">
                {paymentStatus === 'canceled' ? 'Оплатить заново' : 'Вернуться к оплате'}
              </Link>
            </div>
            <p style={{ marginTop: 16, fontSize: 13, color: '#7d766c', textAlign: 'center', lineHeight: 1.6 }}>
              Деньги списались, а сайт не активировался? Напишите на{' '}
              <a href={`mailto:${LEGAL.contactEmail}`} style={{ textDecoration: 'underline' }}>{LEGAL.contactEmail}</a>
              {' '}— найдём платёж и включим сайт вручную.
            </p>
            <p style={{ marginTop: 10, textAlign: 'center' }}>
              <Link href="/dashboard" className={styles.dashLink}>Мои приглашения →</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Загрузка...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
