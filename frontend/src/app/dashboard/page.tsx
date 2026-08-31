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

  /* Удаление необратимо, а для оплаченного сайта равносильно потере покупки:
     вместо нативного confirm — диалог с названием сайта, а у оплаченных ещё и галочка. */
  const [pendingDelete, setPendingDelete] = useState<Invite | null>(null);
  const [ackPaid, setAckPaid] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/api/invites/${pendingDelete.id}`);
      setInvites(prev => prev.filter(i => i.id !== pendingDelete.id));
      toast.success('Сайт удалён');
      setPendingDelete(null);
    } catch { toast.error('Ошибка удаления'); }
    finally { setDeleting(false); }
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
                        <>
                          <Link href={`/editor?id=${invite.id}`} className="btn-outline" style={{ flex: 1, padding: '10px', fontSize: '14px', textAlign: 'center' }}>
                            Редактировать
                          </Link>
                          <Link href={`/payment?id=${invite.id}`} className="btn-primary" style={{ flex: 1, padding: '10px', fontSize: '14px', textAlign: 'center' }}>
                            Оплатить
                          </Link>
                        </>
                      ) : (
                        <Link href={`/dashboard/${invite.id}`} className="btn-primary" style={{ flex: 1, padding: '10px', fontSize: '14px', textAlign: 'center' }}>
                          Управление
                        </Link>
                      )}
                      <button
                        className={styles.deleteBtn}
                        onClick={() => { setPendingDelete(invite); setAckPaid(false); }}
                        title="Удалить"
                      >
                        🗑
                      </button>
                    </div>
                    {invite.status !== 'draft' && (
                      <div className={styles.shareLink}>
                        <span className={styles.shareLinkText}>
                          {`${window.location.origin}/${invite.slug}`}
                        </span>
                        <button
                          className={styles.copyBtn}
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/${invite.slug}`);
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

      {pendingDelete && (
        <DeleteDialog
          invite={pendingDelete}
          ack={ackPaid}
          onAck={setAckPaid}
          busy={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

/* Диалог удаления. У оплаченного сайта кнопка заблокирована, пока не отмечено
   согласие: гости потеряют доступ, а деньги сами собой не вернутся. */
function DeleteDialog({ invite, ack, onAck, onCancel, onConfirm, busy }: {
  invite: Invite;
  ack: boolean;
  onAck: (v: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const paid = invite.status === 'paid' || invite.status === 'published';
  const names = invite.groomName && invite.brideName
    ? `${invite.groomName} & ${invite.brideName}`
    : 'Без названия';
  const blocked = busy || (paid && !ack);

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(13,11,9,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 16, padding: '26px 26px 22px' }}>
        <h3 style={{ margin: '0 0 10px', fontFamily: 'var(--font-playfair, Georgia), serif', fontSize: 22, color: '#0e1d26' }}>
          Удалить сайт?
        </h3>
        <p style={{ margin: '0 0 4px', fontSize: 15, color: '#4b463d', lineHeight: 1.5 }}>
          <strong>{names}</strong>
        </p>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#8a8378', wordBreak: 'break-all' }}>
          /{invite.slug}
        </p>

        {paid ? (
          <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: '#b03a2e', marginBottom: 6, fontSize: 14 }}>
              Этот сайт оплачен
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#7d5a52', lineHeight: 1.55 }}>
              После удаления ссылка перестанет открываться у гостей, а ответы анкеты и список
              гостей исчезнут. Восстановить сайт нельзя, оплата не возвращается автоматически.
            </p>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#5b554c', cursor: 'pointer' }}>
              <input type="checkbox" checked={ack} onChange={e => onAck(e.target.checked)} style={{ marginTop: 2 }} />
              <span>Понимаю, что сайт перестанет открываться у гостей</span>
            </label>
          </div>
        ) : (
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#7d766c', lineHeight: 1.55 }}>
            Черновик будет удалён безвозвратно.
          </p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={busy}
            style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(206,197,186,0.7)', background: 'transparent', color: '#4b463d', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-inter)' }}>
            Отмена
          </button>
          <button onClick={onConfirm} disabled={blocked}
            style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: blocked ? '#e2b3ac' : '#c0392b', color: '#fff', fontSize: 14, fontWeight: 600, cursor: blocked ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-inter)' }}>
            {busy ? 'Удаляем…' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
}
