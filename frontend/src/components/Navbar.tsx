'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
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
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>Eloquence</Link>

        <nav className={styles.links}>
          <Link href="/templates" className={`${styles.link} ${pathname === '/templates' ? styles.active : ''}`}>
            Шаблоны
          </Link>
          <Link href="/#features" className={styles.link}>Возможности</Link>
          <Link href="/#examples" className={styles.link}>Примеры</Link>
          <Link href="/#pricing" className={styles.link}>Цены</Link>
        </nav>

        <div className={styles.actions}>
          {user ? (
            <>
              <Link href="/dashboard" className={styles.btnLogin}>Мои сайты</Link>
              <button onClick={handleLogout} className={styles.btnLogin}>Выйти</button>
            </>
          ) : (
            <>
              <Link href="/auth" className={styles.btnLogin}>Войти</Link>
              <Link href="/templates" className={styles.btnCreate}>Начать</Link>
            </>
          )}
        </div>

        <button className={styles.burger} onClick={() => setMenuOpen(!menuOpen)} aria-label="Меню">
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen && (
        <div className={styles.mobileMenu}>
          <Link href="/templates" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Шаблоны</Link>
          <Link href="/#features" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Возможности</Link>
          <Link href="/#examples" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Примеры</Link>
          <Link href="/#pricing" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Цены</Link>
          <div className={styles.mobileDivider} />
          {user ? (
            <>
              <Link href="/dashboard" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Мои сайты</Link>
              <button onClick={handleLogout} className={styles.mobileLink}>Выйти</button>
            </>
          ) : (
            <>
              <Link href="/auth" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Войти</Link>
              <Link href="/templates" className={styles.mobileBtnCreate} onClick={() => setMenuOpen(false)}>
                Начать создание
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
