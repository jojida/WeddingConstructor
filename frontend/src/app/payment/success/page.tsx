'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { isAdvancedPlan } from '@/lib/constants';
import styles from './page.module.css';

function SuccessContent() {
  const searchParams = useSearchParams();
  const inviteId = searchParams.get('id') || '';
  const [invite, setInvite] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!inviteId) return;
    // Poll until paid
    const poll = setInterval(async () => {
      try {
        const res = await api.get(`/api/invites/${inviteId}`);
        if (res.data.status === 'paid' || res.data.status === 'published') {
          setInvite(res.data);
          clearInterval(poll);
        }
      } catch {}
    }, 1000);
    return () => clearInterval(poll);
  }, [inviteId]);

  const siteUrl = invite ? `${window.location.origin}/invite/${invite.slug}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(siteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.page}>
      <div className={styles.confetti}>
        {['🎊','✨','💍','🌸','🎉','💕','✦','🥂'].map((e, i) => (
          <span key={i} className={styles.emoji} style={{ '--i': i } as React.CSSProperties}>{e}</span>
        ))}
      </div>
      <div className={styles.card}>
        <div className={styles.check}>✓</div>
        <h1 className={styles.title}>Оплата прошла!</h1>
        <p className={styles.subtitle}>Ваш сайт-приглашение готов к отправке гостям</p>

        {invite ? (
          <>
            <div className={styles.linkBox}>
              <div className={styles.linkLabel}>Ссылка для гостей</div>
              <div className={styles.link}>{siteUrl}</div>
              <button id="copy-link" className="btn-primary" onClick={copyLink} style={{ width: '100%', marginTop: 12 }}>
                {copied ? '✓ Скопировано!' : '📋 Скопировать ссылку'}
              </button>
            </div>
            <div className={styles.actions}>
              <Link href={`/invite/${invite.slug}`} target="_blank" className="btn-outline">
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
        ) : (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>Активируем ваш сайт...</p>
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
