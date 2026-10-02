import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL, SITE_URL } from '@/lib/constants';
import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Контакты',
  description: 'Контакты сервиса WeddingCraft: Москва, работаем по всей России. Поддержка по email, реквизиты ИП.',
  alternates: { canonical: `${SITE_URL}/contacts` },
};

export default function ContactsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href="/" className={styles.back}>← На главную</Link>
        <h1 className={styles.title}>Контакты</h1>

        <p>
          WeddingCraft — онлайн-конструктор сайтов-приглашений на свадьбу и печатных приглашений.
          Мы находимся в Москве и работаем со всеми городами России: сайт-приглашение создаётся
          и публикуется онлайн, гости открывают его по ссылке из любой точки мира.
        </p>

        <h2>Город</h2>
        <p>Россия, г. Москва</p>

        <h2>Поддержка</h2>
        <p>
          E-mail: <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
        </p>

        <div className={styles.requisites}>
          <p><strong>Реквизиты</strong></p>
          <p>{LEGAL.sellerName}</p>
          <p>Статус: {LEGAL.sellerStatus}</p>
          <p>ИНН: {LEGAL.sellerInn}</p>
          {LEGAL.sellerOgrnip && <p>ОГРНИП: {LEGAL.sellerOgrnip}</p>}
          <p>Регион регистрации: г. Москва</p>
          <p>Сайт: {SITE_URL}</p>
        </div>

        <p>
          <Link href="/oferta">Публичная оферта</Link> · <Link href="/privacy">Политика конфиденциальности</Link>
        </p>
      </div>
    </div>
  );
}
