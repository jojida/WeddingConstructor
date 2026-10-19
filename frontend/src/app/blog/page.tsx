import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { ARTICLES } from '@/lib/articles';
import styles from './blog.module.css';

const TITLE = 'Статьи о свадебных приглашениях';
const DESCRIPTION =
  'Тексты приглашений на свадьбу, анкета для гостей, сроки рассылки, приглашения на никах и венчание — советы и готовые примеры.';
const OG_IMAGE = { url: '/invite/calla/assets/couple-photo.jpg', width: 1200, height: 630, alt: 'Свадебное приглашение WeddingCraft' };

export const metadata: Metadata = {
  title: `${TITLE}: тексты, советы, примеры`,
  description: DESCRIPTION,
  alternates: { canonical: '/blog' },
  openGraph: { type: 'website', siteName: 'WeddingCraft', locale: 'ru_RU', url: '/blog', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE.url] },
};

export default function BlogPage() {
  return (
    <div className={styles.page}>
      <Navbar />
      <div className={styles.wide}>
        <nav className={styles.crumbs} aria-label="Навигация">
          <Link href="/">Главная</Link><span>/</span><span>Статьи</span>
        </nav>
        <h1 className={styles.title}>{TITLE}</h1>
        <p className={styles.lead} style={{ maxWidth: 680, marginBottom: 32 }}>
          Как написать текст приглашения, какие вопросы задать гостям и когда всё разослать. Готовые примеры можно скопировать одной кнопкой.
        </p>
        <div className={styles.cards}>
          {ARTICLES.map(a => (
            <Link key={a.slug} href={`/blog/${a.slug}`} className={styles.card}>
              <span className={styles.cardTitle}>{a.title}</span>
              <span className={styles.cardText}>{a.description}</span>
              <span className={styles.cardMore}>Читать →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
