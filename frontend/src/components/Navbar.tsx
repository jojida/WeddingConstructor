'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
    setMenuOpen(false);
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>✦</span>
          WeddingCraft
        </Link>

        <div className={styles.links}>
          <Link href="/templates" className={`${styles.link} ${pathname === '/templates' ? styles.active : ''}`}>
            Шаблоны
          </Link>
          <Link href="/#pricing" className={styles.link}>
            Тарифы
          </Link>
        </div>

        <div className={styles.actions}>
          {user ? (
            <>
              <Link href="/dashboard" className={styles.link}>
                Мои сайты
              </Link>
              <button onClick={handleLogout} className="btn-outline" style={{ padding: '9px 20px', fontSize: '14px' }}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link href="/auth" className={styles.link}>
                Войти
              </Link>
              <Link href="/templates" className="btn-primary" style={{ padding: '10px 24px', fontSize: '14px' }}>
                Создать сайт
              </Link>
            </>
          )}
        </div>

        {/* Mobile burger */}
        <button className={styles.burger} onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </div>

      {menuOpen && (
        <div className={styles.mobileMenu}>
          <Link href="/templates" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Шаблоны</Link>
          {user ? (
            <>
              <Link href="/dashboard" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Мои сайты</Link>
              <button onClick={handleLogout} className={styles.mobileLink}>Выйти</button>
            </>
          ) : (
            <Link href="/auth" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Войти</Link>
          )}
        </div>
      )}
    </nav>
  );
}
