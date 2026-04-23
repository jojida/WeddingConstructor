'use client';
import Link from 'next/link';
import { useState } from 'react';
import Navbar from '@/components/Navbar';
import TemplatePreview from '@/components/TemplatePreview';
import { TEMPLATES } from '@/lib/constants';
import styles from './page.module.css';

const FILTERS = ['Все', 'Классика', 'Минимализм', 'Бохо', 'Люкс', 'Пастель'];

const FILTER_MAP: Record<string, string[]> = {
  'Все': [],
  'Классика': ['classic'],
  'Минимализм': ['modern'],
  'Бохо': ['bohemian'],
  'Люкс': ['luxury'],
  'Пастель': ['pastel'],
};

const SAMPLE_DATA = {
  brideName: 'Анна',
  groomName: 'Михаил',
  weddingDate: '2025-09-20',
  weddingTime: '16:00',
  venue: 'Усадьба «Белый сад»',
  venueAddress: 'Москва, ул. Розовая, 1',
  inviteText: 'С радостью приглашаем вас разделить с нами один из самых счастливых дней нашей жизни',
  story: 'Мы встретились пять лет назад и с тех пор не расставались. Наш путь был полон приключений и любви.',
  dressCode: 'White Tie',
  coverPhoto: '',
  galleryPhotos: [],
  mapLink: 'https://maps.google.com',
  schedule: [
    { time: '15:00', title: 'Торжественная регистрация', icon: '💍' },
    { time: '16:00', title: 'Фотосессия', icon: '📸' },
    { time: '17:00', title: 'Фуршет', icon: '🍾' },
    { time: '18:00', title: 'Банкет', icon: '🍽️' },
    { time: '22:00', title: 'Танцы', icon: '💃' },
  ],
};

export default function TemplatesPage() {
  const [activeFilter, setActiveFilter] = useState('Все');

  const filtered = TEMPLATES.filter(t => {
    const ids = FILTER_MAP[activeFilter];
    return ids.length === 0 || ids.includes(t.id);
  });

  return (
    <div className={styles.page}>
      <Navbar />

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroContent}>
          <h1 className={styles.title}>Выберите шаблон</h1>
          <p className={styles.subtitle}>
            5 уникальных дизайнов. Каждый включает hero-фото, дресс-код, карту и анкету для гостей.
          </p>

          {/* Filters */}
          <div className={styles.filters}>
            {FILTERS.map(f => (
              <button
                key={f}
                className={`${styles.filter} ${activeFilter === f ? styles.filterActive : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className={styles.grid}>
        {filtered.map((tpl, i) => (
          <div key={tpl.id} className={styles.card} style={{ animationDelay: `${i * 0.07}s` }}>
            {/* Browser chrome mockup */}
            <div className={styles.browser}>
              <div className={styles.browserBar}>
                <div className={styles.browserDots}>
                  <span style={{ background: '#ff5f57' }} />
                  <span style={{ background: '#ffbd2e' }} />
                  <span style={{ background: '#28c840' }} />
                </div>
                <div className={styles.browserUrl}>weddingcraft.ru/invite/anna-i-mikhail</div>
              </div>
              {/* Live preview — compact phone-size mode */}
              <div className={styles.browserContent}>
                <div className={styles.previewScale}>
                  <TemplatePreview
                    data={{ ...SAMPLE_DATA, templateId: tpl.id }}
                    apiBase={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}
                  />
                </div>
              </div>
            </div>

            {/* Card footer */}
            <div className={styles.cardFooter}>
              <div className={styles.cardMeta}>
                <div className={styles.colorDots}>
                  {tpl.colors.map((c, ci) => (
                    <span key={ci} className={styles.colorDot} style={{ background: c }} />
                  ))}
                </div>
                <h2 className={styles.cardName}>{tpl.name}</h2>
                <p className={styles.cardDesc}>{tpl.description}</p>
                <div className={styles.tags}>
                  {tpl.tags.map(tag => (
                    <span key={tag} className={styles.tag}>{tag}</span>
                  ))}
                </div>
              </div>
              <Link href={`/editor?template=${tpl.id}`} className={styles.useBtn}>
                Выбрать и редактировать →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className={styles.cta}>
        <p className={styles.ctaText}>Не знаете что выбрать? Начните с любого — всё можно изменить в редакторе</p>
        <Link href="/editor?template=classic" className="btn-primary" style={{ fontSize: 16, padding: '14px 40px' }}>
          Начать бесплатно ✦
        </Link>
      </div>
    </div>
  );
}
