'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import styles from './AuthModal.module.css';

interface Props {
  onSuccess: () => void;
  onClose: () => void;
}

export default function AuthModal({ onSuccess, onClose }: Props) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/auth/send-code', { email });
      setStep('code');
      toast.success('Код отправлен!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка отправки кода');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/api/auth/verify-code', { email, code });
      setAuth(res.data.user, res.data.token);
      toast.success('Добро пожаловать!');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Close button */}
        <button className={styles.close} onClick={onClose} aria-label="Закрыть">×</button>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}>Eloquence</div>
          <h2 className={styles.title}>
            {step === 'email' ? 'Вход в аккаунт' : 'Введите код'}
          </h2>
          <p className={styles.subtitle}>
            {step === 'email'
              ? 'Введите email, чтобы войти и сохранить приглашение. Мы отправим вам код подтверждения.'
              : `Код отправлен на ${email}`}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Ваш Email</label>
              <input
                id="modal-email"
                className="input-field"
                type="email"
                placeholder="anna@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button
              id="modal-submit-email"
              type="submit"
              className="btn-primary"
              disabled={loading || !email}
              style={{ width: '100%', marginTop: 4, fontSize: '16px', padding: '14px' }}
            >
              {loading ? 'Отправка...' : 'Получить код'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Код подтверждения</label>
              <input
                id="modal-code"
                className="input-field"
                type="text"
                placeholder="123456"
                value={code}
                onChange={e => setCode(e.target.value)}
                required
                autoFocus
                maxLength={6}
                style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '4px' }}
              />
            </div>
            <button
              id="modal-submit-code"
              type="submit"
              className="btn-primary"
              disabled={loading || code.length < 6}
              style={{ width: '100%', marginTop: 4, fontSize: '16px', padding: '14px' }}
            >
              {loading ? 'Проверка...' : '✦ Войти'}
            </button>
            <button
              type="button"
              onClick={() => setStep('email')}
              style={{
                width: '100%', marginTop: '12px', background: 'none', border: 'none',
                color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Изменить email
            </button>
          </form>
        )}

        <p className={styles.privacy}>
          Нажимая «Войти», вы соглашаетесь с условиями использования
        </p>
      </div>
    </div>
  );
}
