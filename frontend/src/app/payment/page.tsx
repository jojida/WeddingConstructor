'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { planPriceDue } from '@/lib/plans';
import { PLANS, LEGAL, TEMPLATE_DEFAULTS } from '@/lib/constants';
import { reachGoal, GOAL } from '@/lib/metrika';
import styles from './page.module.css';

function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuthStore();
  const inviteId = searchParams.get('id') || '';
  /* Тестовый аккаунт владельца: касса не вызывается, тариф переключается
     сколько угодно раз — в том числе у уже опубликованного сайта. */
  const isFree = !!user?.free;

  const [selectedPlan, setSelectedPlan] = useState(PLANS.some(p => p.id === searchParams.get('plan')) ? searchParams.get('plan')! : 'premium');
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<any>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<{ code: string; percent: number } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);

  useEffect(() => {
    if (!inviteId || !user) return;
    let cancelled = false;
    api.get(`/api/invites/${inviteId}`)
      .then(res => {
        if (cancelled) return;
        setInvite(res.data);
        if (!searchParams.get('plan') && (res.data.status === 'paid' || res.data.status === 'published')) {
          setSelectedPlan(res.data.plan === 'premium' || res.data.plan === 'maximum' ? 'maximum' : 'premium');
        }
      })
      .catch(() => { if (!cancelled) toast.error('Приглашение не найдено'); });
    return () => { cancelled = true; };
  }, [inviteId, searchParams, user]);

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

  const published = invite?.status === 'paid' || invite?.status === 'published';
  const currentPrice = published ? PLANS.find(p => p.id === invite?.plan)?.price ?? 0 : 0;
  const selectedPrice = PLANS.find(p => p.id === selectedPlan)?.price ?? 0;
  const due = isFree ? 0 : priceWithPromo(planPriceDue(selectedPlan, invite?.plan, published));
  const freePublication = selectedPlan === 'free' || isFree;
  const alreadyConnected = published && invite?.plan === selectedPlan && !isFree;

  const handlePay = async () => {
    if (!inviteId) return;
    if (!alreadyConnected && !isFree && selectedPlan !== 'free') {
      const venue = (invite?.venue || '').trim();
      const address = (invite?.venueAddress || '').trim();
      if (!venue || !address) {
        toast.error('Укажите место и адрес свадьбы в редакторе перед подключением платного тарифа');
        return;
      }
      const defaults = TEMPLATE_DEFAULTS[invite.templateId];
      if ((defaults?.venue && venue === defaults.venue) || (defaults?.venueAddress && address === defaults.venueAddress)) {
        if (!window.confirm(`Место и адрес как в примере шаблона:\n«${venue}», ${address}\n\nВсё верно?`)) return;
      }
    }
    reachGoal(GOAL.paymentStart, { plan: selectedPlan });
    setLoading(true);
    try {
      const res = await api.post('/api/payment/create', {
        inviteId,
        plan: selectedPlan,
        ...(promo ? { promoCode: promo.code } : {}),
      });
      if (res.data.devMode || res.data.alreadyPaid || res.data.free) {
        if (res.data.message) toast.success(res.data.message);
        router.push(res.data.redirectUrl || `/payment/success?id=${inviteId}&plan=${selectedPlan}`);
      } else if (res.data.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      } else {
        toast.error('Платёж не создан. Попробуйте ещё раз или обратитесь в поддержку.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка оплаты');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <div className={styles.center}>Загрузка…</div>;

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
          <h1 className={styles.title}>{PLANS.length > 1 ? 'Выберите тариф' : 'Публикация сайта'}</h1>
          <p className={styles.subtitle}>
            {isFree
              ? 'Тестовый аккаунт: публикация без оплаты'
              : 'Публикуйте бесплатно или выберите тариф с дополнительными возможностями'}
          </p>
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

        <div role="radiogroup" aria-label="Тариф сайта" className={`${styles.plans} ${PLANS.length === 1 ? styles.plansSingle : ''}`}>
          {PLANS.map(plan => (
            <div
              key={plan.id}
              id={`plan-${plan.id}`}
              className={`${styles.plan} ${selectedPlan === plan.id ? styles.planActive : ''} ${plan.popular ? styles.planPopular : ''} ${published && !isFree && plan.price < currentPrice ? styles.planUnavailable : ''}`}
              role="radio" aria-checked={selectedPlan === plan.id} aria-label={`Тариф «${plan.name}», ${plan.price} рублей`}
              aria-disabled={published && !isFree && plan.price < currentPrice}
              tabIndex={published && !isFree && plan.price < currentPrice ? -1 : 0}
              onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !(published && !isFree && plan.price < currentPrice)) { e.preventDefault(); setSelectedPlan(plan.id); } }}
              onClick={() => { if (!(published && !isFree && plan.price < currentPrice)) setSelectedPlan(plan.id); }}
            >
              {plan.badge && <div className={styles.popularBadge}>{plan.badge || 'Популярный'}</div>}
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

        <div style={{ display: freePublication || alreadyConnected ? 'none' : 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', margin: '18px 0 4px', flexWrap: 'wrap' }}>
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
          <button id="pay-button" className="btn-primary" onClick={handlePay} disabled={loading || !invite || (published && !isFree && selectedPrice < currentPrice)}
            style={{ fontSize: '17px', padding: '16px clamp(20px, 4vw, 64px)', maxWidth: '100%', whiteSpace: 'normal' }}>
            {loading
              ? (freePublication ? 'Публикуем…' : 'Перенаправление...')
              : alreadyConnected ? 'Тариф уже подключён — открыть сайт'
              : freePublication
                ? 'Опубликовать бесплатно'
                : `${published ? 'Доплатить' : 'Оплатить'} ${due.toLocaleString('ru-RU')} ₽`}
          </button>
          {promo && !freePublication && !alreadyConnected && (
            <p className={styles.payNote} style={{ color: '#2e7d32' }}>
              Промокод {promo.code}: скидка {promo.percent}% применена
            </p>
          )}
          {freePublication ? (
            <>
              <p className={styles.payNote}>
                {isFree ? '🎁 Тестовый аккаунт: сайт публикуется сразу.' : 'Сайт публикуется бесплатно и работает бессрочно. Платные функции можно подключить позже.'}
              </p>
            </>
          ) : (
            <>
              <p className={styles.payNote}>
                💳 Оплата через ЮKassa: банковские карты, СБП, SberPay
              </p>
              <p className={styles.payNote} style={{ marginTop: 6 }}>
                Сайт публикуется сразу после оплаты и работает бессрочно — без продлений и подписок.
              </p>
              <p className={styles.payNote} style={{ marginTop: 4 }}>
                Правки после публикации бесплатны и не ограничены: гости увидят их сразу,
                ссылка не меняется.
              </p>
            </>
          )}
          <p className={styles.payNote} style={{ marginTop: 4 }}>
            Вопросы? <a href="mailto:support@weddingcraft.ru" style={{ textDecoration: 'underline' }}>support@weddingcraft.ru</a> — отвечаем быстро
          </p>
          {!freePublication && !alreadyConnected && (
            <>
              <p className={styles.payNote} style={{ marginTop: 4 }}>
                Нажимая «Оплатить», вы принимаете <Link href="/oferta" style={{ textDecoration: 'underline' }}>условия оферты</Link> и{' '}
                <Link href="/privacy" style={{ textDecoration: 'underline' }}>политику конфиденциальности</Link>
              </p>
              {/* Покупатель должен видеть, кому платит, прямо на экране оплаты. */}
              <p className={styles.payNote} style={{ marginTop: 10, opacity: 0.75 }}>
                Получатель платежа: {LEGAL.sellerStatus} {LEGAL.sellerName},{' '}
                ИНН {LEGAL.sellerInn}{LEGAL.sellerOgrnip ? `, ОГРНИП ${LEGAL.sellerOgrnip}` : ''}
              </p>
            </>
          )}
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
