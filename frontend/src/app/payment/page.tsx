'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { PLANS, LEGAL } from '@/lib/constants';
import { reachGoal, GOAL } from '@/lib/metrika';
import styles from './page.module.css';

function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const inviteId = searchParams.get('id') || '';

  const [selectedPlan, setSelectedPlan] = useState('premium');
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<any>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<{ code: string; percent: number } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);

  useEffect(() => {
    if (!inviteId) return;
    api.get(`/api/invites/${inviteId}`)
      .then(res => setInvite(res.data))
      .catch(() => toast.error('Приглашение не найдено'));
  }, [inviteId]);

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoChecking(true);
    try {
      const res = await api.get(`/api/payment/promo/${encodeURIComponent(code)}`);
      setPromo(res.data);
      toast.success(`Промокод применён: −${res.data.percent}%`);
    } catch (err: any) {
      setPromo(null);
      toast.error(err.response?.data?.error || 'Промокод не найден');
    } finally {
      setPromoChecking(false);
    }
  };

  // Цена с учётом промокода — как её посчитает бэкенд
  const priceWithPromo = (price: number) =>
    promo ? Math.round(price * 100 * (100 - promo.percent) / 100) / 100 : price;

  const handlePay = async () => {
    if (!inviteId) return;
    reachGoal(GOAL.paymentStart, { plan: selectedPlan });
    setLoading(true);
    try {
      const res = await api.post('/api/payment/create', {
        inviteId,
        plan: selectedPlan,
        ...(promo ? { promoCode: promo.code } : {}),
      });
      if (res.data.devMode || res.data.alreadyPaid) {
        if (res.data.message) toast.success(res.data.message);
        router.push(`/payment/success?id=${inviteId}`);
      } else if (res.data.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка оплаты');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return (
    <div className={styles.center}>
      <p>Необходима авторизация. <Link href="/auth">Войти</Link></p>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.bg} />
      <div className={styles.container}>
        <Link href={inviteId ? `/editor?id=${inviteId}` : '/dashboard'} className={styles.back}>← Вернуться к редактору</Link>
        
        <div className={styles.header}>
          <div className={styles.logo}>✦ WeddingCraft</div>
          <h1 className={styles.title}>Выберите тариф</h1>
          <p className={styles.subtitle}>После оплаты вы получите уникальную ссылку для гостей</p>
        </div>

        {invite && (
          <div className={styles.invitePreview}>
            <span className={styles.inviteIcon}>💌</span>
            <span className={styles.inviteName}>
              {invite.groomName && invite.brideName
                ? `${invite.groomName} & ${invite.brideName}`
                : 'Ваше приглашение'}
            </span>
          </div>
        )}

        <div className={styles.plans}>
          {PLANS.map(plan => (
            <div
              key={plan.id}
              id={`plan-${plan.id}`}
              className={`${styles.plan} ${selectedPlan === plan.id ? styles.planActive : ''} ${plan.popular ? styles.planPopular : ''}`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && <div className={styles.popularBadge}>Популярный</div>}
              <div className={styles.planHeader}>
                <div className={styles.planName}>{plan.name}</div>
                <div className={styles.radio}>
                  {selectedPlan === plan.id && <div className={styles.radioDot} />}
                </div>
              </div>
              <div className={styles.planPrice}>
                {plan.price.toLocaleString('ru-RU')} <span className={styles.planCurrency}>₽</span>
              </div>
              <div className={styles.planPeriod}>{plan.period}</div>
              <ul className={styles.planFeatures}>
                {plan.features.map(f => (
                  <li key={f} className={styles.planFeature}>
                    <span style={{ color: plan.color }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', margin: '18px 0 4px', flexWrap: 'wrap' }}>
          <input
            id="promo-input"
            className="input-field"
            type="text"
            placeholder="Промокод (если есть)"
            value={promoInput}
            onChange={e => { setPromoInput(e.target.value.toUpperCase()); if (promo) setPromo(null); }}
            style={{ maxWidth: 220, textTransform: 'uppercase' }}
          />
          <button
            type="button"
            onClick={applyPromo}
            disabled={promoChecking || !promoInput.trim()}
            className="btn-primary"
            style={{ padding: '10px 18px', fontSize: 14, opacity: promoInput.trim() ? 1 : 0.5 }}
          >
            {promoChecking ? 'Проверка…' : promo ? `−${promo.percent}% ✓` : 'Применить'}
          </button>
        </div>

        <div className={styles.payBtn}>
          <button id="pay-button" className="btn-primary" onClick={handlePay} disabled={loading}
            style={{ fontSize: '17px', padding: '16px 64px' }}>
            {loading
              ? 'Перенаправление...'
              : `Оплатить ${priceWithPromo(PLANS.find(p => p.id === selectedPlan)?.price || 0).toLocaleString('ru-RU')} ₽`}
          </button>
          {promo && (
            <p className={styles.payNote} style={{ color: '#2e7d32' }}>
              Промокод {promo.code}: скидка {promo.percent}% применена
            </p>
          )}
          <p className={styles.payNote}>
            💳 Оплата через ЮKassa: банковские карты, СБП, SberPay
          </p>
          <p className={styles.payNote} style={{ marginTop: 6 }}>
            Сайт публикуется сразу после оплаты и работает бессрочно — без продлений и подписок.
          </p>
          <p className={styles.payNote} style={{ marginTop: 4 }}>
            ⚠️ Проверьте имена, даты и текст до оплаты: вы оплачиваете готовый сайт,
            после публикации он не редактируется.
          </p>
          <p className={styles.payNote} style={{ marginTop: 4 }}>
            Вопросы? <a href="mailto:support@weddingcraft.ru" style={{ textDecoration: 'underline' }}>support@weddingcraft.ru</a> — отвечаем быстро
          </p>
          <p className={styles.payNote} style={{ marginTop: 4 }}>
            Нажимая «Оплатить», вы принимаете <Link href="/oferta" style={{ textDecoration: 'underline' }}>условия оферты</Link> и{' '}
            <Link href="/privacy" style={{ textDecoration: 'underline' }}>политику конфиденциальности</Link>
          </p>
          {/* Покупатель должен видеть, кому платит, прямо на экране оплаты. */}
          <p className={styles.payNote} style={{ marginTop: 10, opacity: 0.75 }}>
            Получатель платежа: {LEGAL.sellerStatus} {LEGAL.sellerName},{' '}
            ИНН {LEGAL.sellerInn}{LEGAL.sellerOgrnip ? `, ОГРНИП ${LEGAL.sellerOgrnip}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Загрузка...</div>}>
      <PaymentContent />
    </Suspense>
  );
}
