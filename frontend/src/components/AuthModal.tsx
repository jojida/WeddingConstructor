'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { emailTypoFix, isMailRuAddress } from '@/lib/email-typo';
import { reachGoal, GOAL } from '@/lib/metrika';
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
  const [resendIn, setResendIn] = useState(0); // секунд до повторной отправки
  const { setAuth } = useAuthStore();
  /* Почти каждый третий, запросивший код, так и не входил, а неверный код вводили
     единицы — письмо не доходит или лежит в «Спаме». Поэтому: подсказка про спам,
     повторная отправка, подсказка при опечатке в адресе и цифровая клавиатура. */
  const typoFix = emailTypoFix(email);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const handleSendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/auth/send-code', { email });
      reachGoal(GOAL.codeSent);
      setStep('code');
      setCode('');
      setResendIn(60);
      toast.success('Код отправлен!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка отправки кода');
    } finally {
      setLoading(false);
    }
  };

  const verify = async (value: string) => {
    setLoading(true);
    try {
      const res = await api.post('/api/auth/verify-code', { email, code: value });
      setAuth(res.data.user, res.data.token);
      toast.success('Добро пожаловать!');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = (e: React.FormEvent) => { e.preventDefault(); void verify(code); };

  // Код вставили из письма или набрали шестую цифру — входим сразу, без лишнего нажатия
  const onCodeChange = (raw: string) => {
    const value = raw.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    if (value.length === 6 && !loading) void verify(value);
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Close button */}
        <button className={styles.close} onClick={onClose} aria-label="Закрыть">×</button>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}>WeddingCraft</div>
          <h2 className={styles.title}>
            {step === 'email' ? 'Вход в аккаунт' : 'Введите код'}
          </h2>
          <p className={styles.subtitle}>
            {step === 'email'
              ? 'Пришлём код на вашу почту, чтобы сохранить приглашение.'
              : `Код отправлен на ${email}. Письмо приходит за минуту — если его нет во «Входящих», загляните в «Спам».`}
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
                autoComplete="email"
                aria-describedby={typoFix ? 'modal-email-typo' : undefined}
              />
              {typoFix && (
                <p id="modal-email-typo" className={styles.typo}>
                  Возможно, вы имели в виду{' '}
                  <button type="button" className={styles.typoFix} onClick={() => setEmail(typoFix)}>{typoFix}</button>?
                </p>
              )}
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
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={e => onCodeChange(e.target.value)}
                required
                autoFocus
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
            {resendIn === 0 && isMailRuAddress(email) && (
              <p className={styles.typo} role="note">
                Письма на Mail.ru сейчас иногда не доходят. Если кода нет и в «Спаме», укажите почту Gmail или Яндекс —
                нажмите «Изменить email».
              </p>
            )}
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => handleSendCode()}
              disabled={loading || resendIn > 0}
            >
              {resendIn > 0 ? `Отправить код ещё раз — через ${resendIn} с` : 'Отправить код ещё раз'}
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => { setStep('email'); setCode(''); }}
            >
              Изменить email
            </button>
          </form>
        )}

        {/* Ссылки — в новой вкладке: модалка открыта поверх редактора с несохранёнными правками */}
        <p className={styles.privacy}>
          Нажимая «{step === 'email' ? 'Получить код' : 'Войти'}», вы соглашаетесь с{' '}
          <a href="/oferta" target="_blank" rel="noopener" style={{ textDecoration: 'underline', color: 'inherit' }}>условиями оферты</a> и{' '}
          <a href="/privacy" target="_blank" rel="noopener" style={{ textDecoration: 'underline', color: 'inherit' }}>политикой конфиденциальности</a>
        </p>
      </div>
    </div>
  );
}
