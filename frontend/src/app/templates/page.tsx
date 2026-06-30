'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import TemplatePreview from '@/components/TemplatePreview';
import { TEMPLATES } from '@/lib/constants';
import styles from './page.module.css';

function useScrollReveal(count: number) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [visible, setVisible] = useState<boolean[]>(() => new Array(count).fill(false));

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    refs.current.forEach((el, i) => {
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisible(prev => { const next = [...prev]; next[i] = true; return next; });
            obs.disconnect();
          }
        },
        { threshold: 0.12 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [count]);

  return { refs, visible };
}

const FILTERS = ['Все', 'Море', 'Классика', 'Минимализм', 'Бохо', 'Люкс', 'Пастель', 'Конверт'];

const FILTER_MAP: Record<string, string[]> = {
  'Все': [],
  'Море': ['mediterranean'],
  'Классика': ['classic'],
  'Минимализм': ['modern', 'mediterranean'],
  'Бохо': ['bohemian'],
  'Люкс': ['luxury'],
  'Пастель': ['pastel'],
  'Конверт': ['envelope'],
};

const SAMPLE_DATA = {
  brideName: 'Дарья',
  groomName: 'Вадим',
  weddingDate: '2025-09-20',
  weddingTime: '16:00',
  venue: 'Усадьба «Белый сад»',
  venueAddress: 'Москва, ул. Розовая, 1',
  inviteText: 'С радостью приглашаем вас разделить с нами один из самых счастливых дней нашей жизни',
  story: 'Мы встретились пять лет назад и с тех пор не расставались. Наш путь был полон приключений и любви.',
  dressCode: 'White Tie',
  dressCodeColors: [],
  dressCodePhoto: '',
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

  const { refs, visible } = useScrollReveal(filtered.length);

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroContent}>
          <h1 className={styles.title}>Выберите шаблон</h1>
          <p className={styles.subtitle}>
            {TEMPLATES.length} уникальных дизайнов. Каждый включает hero-фото, дресс-код, карту и анкету для гостей.
          </p>

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

      <div className={styles.grid}>
        {filtered.map((tpl, i) => (
          <div
            key={tpl.id}
            ref={el => { refs.current[i] = el; }}
            className={styles.card}
            style={{
              opacity: visible[i] ? 1 : 0,
              transform: visible[i] ? 'translateY(0)' : 'translateY(36px)',
              transition: `opacity 0.55s ease ${i * 0.1}s, transform 0.55s ease ${i * 0.1}s`,
            }}
          >
            <div className={styles.cardImageWrapper}>
              <div className={styles.previewScale}>
                <TemplatePreview
                  data={{
                    ...SAMPLE_DATA,
                    brideName: (tpl as any).sampleBride || SAMPLE_DATA.brideName,
                    groomName: (tpl as any).sampleGroom || SAMPLE_DATA.groomName,
                    templateId: tpl.id,
                    coverPhoto: tpl.defaultCover,
                    galleryPhotos: tpl.defaultGallery
                  }}
                  apiBase={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}
                />
              </div>
            </div>

            <div className={styles.cardActions}>
              <Link href={`/demo/${tpl.id}`} target="_blank" className={styles.actionBtnOutline}>
                Посмотреть
              </Link>
              <Link href={`/editor?template=${tpl.id}`} className={styles.actionBtnPrimary}>
                Выбрать
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.cta}>
        <p className={styles.ctaText}>Не знаете что выбрать? Начните с любого — всё можно изменить в редакторе</p>
        <Link href="/editor?template=classic" className="btn-primary">
          Начать бесплатно
        </Link>
      </div>
    </div>
  );
}
