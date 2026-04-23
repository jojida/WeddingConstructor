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
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : { email: form.email, password: form.password, name: form.name };

      const res = await api.post(endpoint, payload);
      setAuth(res.data.user, res.data.token);
      toast.success(mode === 'login' ? 'Добро пожаловать!' : 'Аккаунт создан!');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка');
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
          <div className={styles.logo}>✦ WeddingCraft</div>
          <h2 className={styles.title}>
            {mode === 'register' ? 'Сохраните ваше приглашение' : 'Войдите в аккаунт'}
          </h2>
          <p className={styles.subtitle}>
            {mode === 'register'
              ? 'Создайте аккаунт — мы сохраним все ваши данные'
              : 'Войдите, чтобы сохранить приглашение'}
          </p>
        </div>

        {/* Tab switcher */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`}
            onClick={() => setMode('register')}
          >
            Регистрация
          </button>
          <button
            className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
            onClick={() => setMode('login')}
          >
            Уже есть аккаунт
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {mode === 'register' && (
            <div className={styles.field}>
              <label className={styles.label}>Ваше имя</label>
              <input
                id="modal-name"
                className="input-field"
                type="text"
                placeholder="Анна Иванова"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                autoFocus
              />
            </div>
          )}
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              id="modal-email"
              className="input-field"
              type="email"
              placeholder="anna@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              autoFocus={mode === 'login'}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Пароль</label>
            <input
              id="modal-password"
              className="input-field"
              type="password"
              placeholder={mode === 'register' ? 'Минимум 6 символов' : '••••••••'}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>

          <button
            id="modal-submit"
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: 4, fontSize: '16px', padding: '14px' }}
          >
            {loading
              ? 'Сохранение...'
              : mode === 'register'
                ? '✦ Сохранить приглашение'
                : '✦ Войти и сохранить'}
          </button>
        </form>

        <p className={styles.privacy}>
          Нажимая «Сохранить», вы соглашаетесь с условиями использования
        </p>
      </div>
    </div>
  );
}
