'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

interface Invite {
  id: string;
  slug: string;
  status: string;
  groomName: string;
  brideName: string;
  weddingDate: string;
  templateId: string;
  plan: string;
  updatedAt: string;
}

const TEMPLATE_COLORS: Record<string, [string, string]> = {
  classic:  ['#f5f0e8', '#c9a96e'],
  modern:   ['#f9f9f9', '#111111'],
  bohemian: ['#fdf6ec', '#b5813d'],
  luxury:   ['#1a1a2e', '#c9a96e'],
  pastel:   ['#fce4ec', '#f48fb1'],
};

export default function DashboardPage() {
  const { user, loading } = useAuthStore();
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/auth');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api.get('/api/invites')
      .then(res => setInvites(res.data))
      .catch(() => toast.error('Ошибка загрузки'))
      .finally(() => setFetching(false));
  }, [user]);

  const createNew = async () => {
    sessionStorage.removeItem('wc_draft_id');
    router.push('/templates');
  };

  const deleteInvite = async (id: string) => {
    if (!confirm('Удалить это приглашение?')) return;
    try {
      await api.delete(`/api/invites/${id}`);
      setInvites(prev => prev.filter(i => i.id !== id));
      toast.success('Удалено');
    } catch { toast.error('Ошибка удаления'); }
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('ru-RU') : '';

  if (loading || fetching) return (
    <div className={styles.page}>
      <Navbar />
      <div className={styles.loadingWrap}><div className={styles.spinner} /></div>
    </div>
  );

  return (
    <div className={styles.page}>
      <Navbar />
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Мои приглашения</h1>
            <p className={styles.subtitle}>Добро пожаловать, {user?.name}!</p>
          </div>
          <button id="create-new" className="btn-primary" onClick={createNew}>
            + Создать новое
          </button>
        </div>

        {invites.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>💌</div>
            <h2 className={styles.emptyTitle}>У вас ещё нет приглашений</h2>
            <p className={styles.emptyDesc}>Создайте своё первое свадебное приглашение за 5 минут</p>
            <button className="btn-primary" onClick={createNew}>
              Создать первое приглашение ✦
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {invites.map(invite => {
              const [bg, accent] = TEMPLATE_COLORS[invite.templateId] || TEMPLATE_COLORS.classic;
              return (
                <div key={invite.id} className={styles.card}>
                  <div className={styles.cardPreview} style={{ background: `linear-gradient(160deg, ${bg}, ${accent}33)` }}>
                    <div className={styles.cardStatus}>
                      <span className={`${styles.statusBadge} ${invite.status === 'paid' || invite.status === 'published' ? styles.statusPaid : styles.statusDraft}`}>
                        {invite.status === 'paid' || invite.status === 'published' ? '✓ Опубликовано' : '✎ Черновик'}
                      </span>
                    </div>
                    <div className={styles.cardNames} style={{ color: invite.templateId === 'luxury' ? '#fff' : '#2c2c2c' }}>
                      {invite.groomName && invite.brideName
                        ? `${invite.groomName} & ${invite.brideName}`
                        : <span style={{ opacity: 0.4 }}>Без названия</span>
                      }
                    </div>
                    {invite.weddingDate && (
                      <div className={styles.cardDate} style={{ color: accent }}>
                        {formatDate(invite.weddingDate)}
                      </div>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardMeta}>
                      Обновлено {formatDate(invite.updatedAt)}
                    </div>
                    <div className={styles.cardActions}>
                      {invite.status === 'draft' ? (
                        <Link href={`/editor?id=${invite.id}`} className="btn-primary" style={{ flex: 1, padding: '10px', fontSize: '14px', textAlign: 'center' }}>
                          Редактировать
                        </Link>
                      ) : (
                        <Link href={`/invite/${invite.slug}`} target="_blank" className="btn-primary" style={{ flex: 1, padding: '10px', fontSize: '14px', textAlign: 'center' }}>
                          Открыть сайт
                        </Link>
                      )}
                      <button
                        className={styles.deleteBtn}
                        onClick={() => deleteInvite(invite.id)}
                        title="Удалить"
                      >
                        🗑
                      </button>
                    </div>
                    {invite.status !== 'draft' && (
                      <div className={styles.shareLink}>
                        <span className={styles.shareLinkText}>
                          {`${window.location.origin}/invite/${invite.slug}`}
                        </span>
                        <button
                          className={styles.copyBtn}
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/invite/${invite.slug}`);
                            toast.success('Скопировано!');
                          }}
                        >
                          📋
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
