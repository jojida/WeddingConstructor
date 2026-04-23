'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { PLANS } from '@/lib/constants';
import styles from './page.module.css';

function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const inviteId = searchParams.get('id') || '';

  const [selectedPlan, setSelectedPlan] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<any>(null);

  useEffect(() => {
    if (!inviteId) return;
    api.get(`/api/invites/${inviteId}`)
      .then(res => setInvite(res.data))
      .catch(() => toast.error('Приглашение не найдено'));
  }, [inviteId]);

  const handlePay = async () => {
    if (!inviteId) return;
    setLoading(true);
    try {
      const res = await api.post('/api/payment/create', { inviteId, plan: selectedPlan });
      if (res.data.devMode) {
        toast.success(res.data.message);
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
        <Link href="/editor" className={styles.back}>← Вернуться к редактору</Link>
        
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

        <div className={styles.payBtn}>
          <button id="pay-button" className="btn-primary" onClick={handlePay} disabled={loading}
            style={{ fontSize: '17px', padding: '16px 64px' }}>
            {loading ? 'Перенаправление...' : `Оплатить ${PLANS.find(p => p.id === selectedPlan)?.price.toLocaleString('ru-RU')} ₽`}
          </button>
          <p className={styles.payNote}>
            💳 Оплата через ЮМани — защищённый платёж
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
