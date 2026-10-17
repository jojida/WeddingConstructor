'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { emailTypoFix, isMailRuAddress } from '@/lib/email-typo';
import { useAuthStore } from '@/store/auth';
import styles from './page.module.css';

/* Вход/регистрация — беспарольные, по коду на email
   (эндпоинты /api/auth/send-code и /api/auth/verify-code).
   Если аккаунта нет — он создаётся автоматически при верном коде. */
export default function AuthPage() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0); // секунд до повторной отправки
  const { setAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/auth/send-code', { email });
      setStep('code');
      setResendIn(60);
      toast.success('Код отправлен на почту');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Не удалось отправить код');
    } finally {
      setLoading(false);
    }
  };

  const typoFix = emailTypoFix(email);

  // Код вставили из письма или набрали шестую цифру — входим сразу
  const onCodeChange = (raw: string) => {
    const value = raw.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    if (value.length === 6 && !loading) void verify(value);
  };

  const verifyCode = (e: React.FormEvent) => { e.preventDefault(); void verify(code); };

  const verify = async (value: string) => {
    setLoading(true);
    try {
      const res = await api.post('/api/auth/verify-code', { email, code: value });
      setAuth(res.data.user, res.data.token);
      toast.success('Добро пожаловать!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.bg} />
      <div className={styles.card}>
        <Link href="/" className={styles.logo}>✦ WeddingCraft</Link>

        <h1 className={styles.title}>
          {step === 'email' ? 'Вход и регистрация' : 'Введите код'}
        </h1>
        <p className={styles.subtitle}>
          {step === 'email'
            ? 'Пришлём код на вашу почту. Новый аккаунт создастся автоматически.'
            : `Код отправлен на ${email}. Письмо приходит за минуту — если его нет во «Входящих», загляните в «Спам».`}
        </p>

        {step === 'email' ? (
          <form onSubmit={sendCode} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                id="auth-email"
                className="input-field"
                type="email"
                placeholder="anna@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                aria-describedby={typoFix ? 'auth-email-typo' : undefined}
              />
              {typoFix && (
                <p id="auth-email-typo" className={styles.typo}>
                  Возможно, вы имели в виду{' '}
                  <button type="button" className={styles.typoFix} onClick={() => setEmail(typoFix)}>{typoFix}</button>?
                </p>
              )}
            </div>
            <button type="submit" className="btn-primary" disabled={loading || !email} style={{ width: '100%', marginTop: 8 }}>
              {loading ? 'Отправка…' : 'Получить код'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Код из письма</label>
              <input
                id="auth-code"
                className="input-field"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={e => onCodeChange(e.target.value)}
                required
                autoFocus
                style={{ textAlign: 'center', fontSize: 20, letterSpacing: 4 }}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading || code.length < 6} style={{ width: '100%', marginTop: 8 }}>
              {loading ? 'Проверка…' : 'Войти'}
            </button>
            {resendIn === 0 && isMailRuAddress(email) && (
              <p className={styles.typo} role="note" style={{ marginTop: 12 }}>
                Письма на Mail.ru сейчас иногда не доходят. Если кода нет и в «Спаме», укажите почту Gmail или Яндекс —
                нажмите «Изменить email».
              </p>
            )}
            <button
              type="button"
              onClick={() => sendCode()}
              disabled={loading || resendIn > 0}
              className={styles.switchBtn}
              style={{ marginTop: 14, background: 'none', border: 'none', cursor: resendIn > 0 ? 'default' : 'pointer', opacity: resendIn > 0 ? 0.5 : 1 }}
            >
              {resendIn > 0 ? `Отправить код повторно (${resendIn} с)` : 'Отправить код повторно'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setCode(''); }}
              className={styles.switchBtn}
              style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Изменить email
            </button>
          </form>
        )}

        <p className={styles.subtitle} style={{ marginTop: 18, fontSize: 12 }}>
          Нажимая «Войти», вы соглашаетесь с{' '}
          <Link href="/oferta" style={{ textDecoration: 'underline', color: 'inherit' }}>условиями оферты</Link> и{' '}
          <Link href="/privacy" style={{ textDecoration: 'underline', color: 'inherit' }}>политикой конфиденциальности</Link>.
        </p>
      </div>
    </div>
  );
}
