import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Fragment } from 'react';
import Navbar from '@/components/Navbar';
import { SITE_URL } from '@/lib/constants';
import { ARTICLES, findArticle, sectionId, type Article, type ArticleBlock } from '@/lib/articles';
import CopyButton from '../CopyButton';
import styles from '../blog.module.css';

interface Props {
  params: Promise<{ slug: string }>;
}

// Статьи известны при сборке: остальные адреса /blog/<что-то> — 404
export const dynamicParams = false;
export function generateStaticParams() {
  return ARTICLES.map(a => ({ slug: a.slug }));
}

const OG_IMAGE = { url: '/invite/calla/assets/couple-photo.jpg', width: 1200, height: 630, alt: 'Свадебное приглашение WeddingCraft' };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = findArticle(slug);
  if (!article) return {};
  const url = `/blog/${article.slug}`;
  return {
    title: article.metaTitle,
    description: article.description,
    alternates: { canonical: url },
    // openGraph и twitter из layout относятся к главной — у статьи свои
    openGraph: {
      type: 'article',
      siteName: 'WeddingCraft',
      locale: 'ru_RU',
      url,
      title: article.title,
      description: article.description,
      publishedTime: article.published,
      modifiedTime: article.updated,
      images: [OG_IMAGE],
    },
    twitter: { card: 'summary_large_image', title: article.title, description: article.description, images: [OG_IMAGE.url] },
  };
}

/** [текст](/адрес) и **жирный** внутри строки */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const bold = part.match(/^\*\*([^*]+)\*\*$/);
        if (bold) return <strong key={i}>{bold[1]}</strong>;
        const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (link) return link[2].startsWith('/')
          ? <Link key={i} href={link[2]}>{link[1]}</Link>
          : <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

function Cta({ title, text }: { title?: string; text?: string }) {
  return (
    <div className={styles.cta}>
      <div className={styles.ctaTitle}>{title || 'Сделайте своё приглашение на свадьбу'}</div>
      <p className={styles.ctaText}>
        {text || 'Выберите шаблон, впишите имена и дату, добавьте место, программу и анкету для гостей — и посмотрите результат бесплатно.'}
      </p>
      <div className={styles.ctaRow}>
        <Link href="/templates" className={styles.ctaBtn}>Выбрать шаблон</Link>
        <span className={styles.ctaNote}>Без регистрации · есть бесплатный тариф</span>
      </div>
    </div>
  );
}

function Block({ block, index, h2Index }: { block: ArticleBlock; index: number; h2Index: number }) {
  if ('h2' in block) return <h2 id={sectionId(h2Index)}>{block.h2}</h2>;
  if ('p' in block) return <p><Inline text={block.p} /></p>;
  if ('ul' in block) return <ul>{block.ul.map((li, i) => <li key={i}><Inline text={li} /></li>)}</ul>;
  if ('ol' in block) return <ol>{block.ol.map((li, i) => <li key={i}><Inline text={li} /></li>)}</ol>;
  if ('tip' in block) return <div className={styles.tip}><Inline text={block.tip} /></div>;
  if ('cta' in block) return <Cta {...block.cta} />;
  const id = `example-${index}`;
  return (
    <figure className={styles.example}>
      {block.label && <div className={styles.exampleLabel}>{block.label}</div>}
      <blockquote id={id} className={styles.exampleText}>{block.example}</blockquote>
      <CopyButton text={block.example} targetId={id} />
    </figure>
  );
}

const blockText = (b: ArticleBlock): string =>
  'h2' in b ? b.h2 : 'p' in b ? b.p : 'ul' in b ? b.ul.join(' ') : 'ol' in b ? b.ol.join(' ')
    : 'tip' in b ? b.tip : 'example' in b ? b.example : '';

function readingMinutes(article: Article): number {
  const words = [article.lead, ...article.blocks.map(blockText)].join(' ').split(/\s+/).length;
  return Math.max(2, Math.round(words / 180));
}

const ruDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = findArticle(slug);
  if (!article) notFound();

  const headings = article.blocks.filter((b): b is { h2: string } => 'h2' in b).map(b => b.h2);
  let h2Counter = -1;
  const related = article.related.map(findArticle).filter((a): a is Article => !!a);
  const url = `${SITE_URL}/blog/${article.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: article.title,
        description: article.description,
        datePublished: article.published,
        dateModified: article.updated,
        inLanguage: 'ru',
        mainEntityOfPage: url,
        image: `${SITE_URL}${OG_IMAGE.url}`,
        author: { '@type': 'Organization', name: 'WeddingCraft', url: SITE_URL },
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Статьи', item: `${SITE_URL}/blog` },
          { '@type': 'ListItem', position: 3, name: article.short, item: url },
        ],
      },
    ],
  };

  return (
    <div className={styles.page}>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className={styles.container}>
        <nav className={styles.crumbs} aria-label="Навигация">
          <Link href="/">Главная</Link><span>/</span><Link href="/blog">Статьи</Link>
        </nav>
        <h1 className={styles.title}>{article.title}</h1>
        <p className={styles.lead}>{article.lead}</p>
        <p className={styles.meta}>
          <time dateTime={article.updated}>{ruDate(article.updated)}</time> · {readingMinutes(article)} мин чтения
        </p>

        {headings.length > 2 && (
          <nav className={styles.toc} aria-label="Содержание">
            <div className={styles.tocTitle}>Содержание</div>
            <ol>
              {headings.map((h, i) => <li key={i}><a href={`#${sectionId(i)}`}>{h}</a></li>)}
            </ol>
          </nav>
        )}

        <div className={styles.body}>
          {article.blocks.map((block, i) => {
            if ('h2' in block) h2Counter++;
            return <Block key={i} block={block} index={i} h2Index={h2Counter} />;
          })}
        </div>

        {!article.blocks.some(b => 'cta' in b) && <Cta />}

        {related.length > 0 && (
          <>
            <h2 className={styles.relatedTitle}>Ещё по теме</h2>
            <div className={styles.cards}>
              {related.map(a => (
                <Link key={a.slug} href={`/blog/${a.slug}`} className={styles.card}>
                  <span className={styles.cardTitle}>{a.short}</span>
                  <span className={styles.cardMore}>Читать →</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </article>
    </div>
  );
}
