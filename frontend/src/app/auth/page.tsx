'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import styles from './page.module.css';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();

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
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.bg} />
      <div className={styles.card}>
        <Link href="/" className={styles.logo}>✦ WeddingCraft</Link>
        
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
            onClick={() => setMode('login')}
          >
            Войти
          </button>
          <button
            className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`}
            onClick={() => setMode('register')}
          >
            Регистрация
          </button>
        </div>

        <h1 className={styles.title}>
          {mode === 'login' ? 'С возвращением!' : 'Создайте аккаунт'}
        </h1>
        <p className={styles.subtitle}>
          {mode === 'login'
            ? 'Войдите, чтобы управлять своими приглашениями'
            : 'Начните создавать красивые приглашения'}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {mode === 'register' && (
            <div className={styles.field}>
              <label className={styles.label}>Ваше имя</label>
              <input
                id="auth-name"
                className="input-field"
                type="text"
                placeholder="Анна Иванова"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
          )}
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              id="auth-email"
              className="input-field"
              type="email"
              placeholder="anna@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Пароль</label>
            <input
              id="auth-password"
              className="input-field"
              type="password"
              placeholder={mode === 'register' ? 'Минимум 6 символов' : '••••••••'}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Загрузка...' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>

        <div className={styles.switch}>
          {mode === 'login' ? (
            <>Нет аккаунта? <button onClick={() => setMode('register')} className={styles.switchBtn}>Зарегистрироваться</button></>
          ) : (
            <>Уже есть аккаунт? <button onClick={() => setMode('login')} className={styles.switchBtn}>Войти</button></>
          )}
        </div>
      </div>
    </div>
  );
}
