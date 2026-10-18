'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import TemplatePreview from '@/components/TemplatePreview';
import LazyMount from '@/components/LazyMount';
import PreviewScale from '@/components/PreviewScale';
import { LEGAL, TEMPLATES, sampleWeddingDate, templateSampleDate } from '@/lib/constants';
import { reachGoal, GOAL } from '@/lib/metrika';
import { NAME_MAX, NO_NAMES, readPreviewNames, withPreviewNames, writePreviewNames, type PreviewNames } from '@/lib/preview-names';
import styles from './page.module.css';

const SAMPLE_DATA = {
  brideName: 'Дарья',
  groomName: 'Вадим',
  weddingDate: sampleWeddingDate(),
  weddingTime: '16:00',
  venue: 'Усадьба «Белый сад»',
  venueAddress: 'Москва, ул. Крымский Вал, 9',
  inviteText: 'Приглашаем вас разделить с нами радость нашего свадебного дня.',
  story: 'Мы встретились пять лет назад и с тех пор не расставались. Наш путь был полон приключений и любви.',
  dressCode: 'White Tie',
  dressCodeColors: [],
  dressCodePhoto: '',
  coverPhoto: '',
  galleryPhotos: [],
  mapLink: '',
  schedule: [
    { time: '15:00', title: 'Торжественная регистрация', icon: '💍' },
    { time: '16:00', title: 'Фотосессия', icon: '📸' },
    { time: '17:00', title: 'Фуршет', icon: '🍾' },
    { time: '18:00', title: 'Банкет', icon: '🍽️' },
    { time: '22:00', title: 'Танцы', icon: '💃' },
  ],
};

export default function TemplatesPage() {
  /* Свои имена во всех превью (lib/preview-names.ts): поля меняются сразу,
     превью — через 0,3 с, иначе двенадцать приглашений перерисовывались бы на
     каждую букву. Из localStorage — после монтирования, чтобы не разойтись
     с серверной разметкой. */
  const [names, setNames] = useState<PreviewNames>(NO_NAMES);
  const [shown, setShown] = useState<PreviewNames>(NO_NAMES);
  const typedRef = useRef(false);
  const goalSentRef = useRef(false);
  useEffect(() => {
    const saved = readPreviewNames();
    setNames(saved);
    setShown(saved);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setShown(names);
      if (!typedRef.current) return;
      writePreviewNames(names);
      // Цель — один раз за визит страницы, когда вписаны оба имени
      if (!goalSentRef.current && names.groom.trim() && names.bride.trim()) {
        goalSentRef.current = true;
        reachGoal(GOAL.catalogNames);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [names]);
  const setName = (key: keyof PreviewNames, value: string) => {
    typedRef.current = true;
    setNames(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroContent}>
          <h1 className={styles.title}>Шаблоны сайтов-приглашений на свадьбу</h1>
          <p className={styles.subtitle}>
            {TEMPLATES.length} дизайнов для вашего дня. Откройте пример и найдите свой стиль.
          </p>
          <p className={styles.subtitle} style={{ marginTop: 6, fontSize: 14, opacity: 0.85 }}>
            Редактор без регистрации: сделать и посмотреть — бесплатно, оплата при публикации.
          </p>
          <div className={styles.names}>
            <div className={styles.namesTitle} id="catalog-names-title">Посмотрите шаблоны со своими именами</div>
            <div className={styles.namesFields} role="group" aria-labelledby="catalog-names-title">
              <input className="input-field" aria-label="Имя жениха" placeholder="Имя жениха" autoComplete="off"
                maxLength={NAME_MAX} value={names.groom} onChange={e => setName('groom', e.target.value)} />
              <input className="input-field" aria-label="Имя невесты" placeholder="Имя невесты" autoComplete="off"
                maxLength={NAME_MAX} value={names.bride} onChange={e => setName('bride', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        {TEMPLATES.map((tpl, i) => (
          <div
            key={tpl.id}
            data-animate
            className={styles.card}
          >
            <div className={styles.cardImageWrapper}>
              <PreviewScale className={styles.previewScale}>
                <LazyMount initialVisible={i < 4}>
                  <TemplatePreview
                    data={withPreviewNames({
                      ...SAMPLE_DATA,
                      brideName: (tpl as any).sampleBride || SAMPLE_DATA.brideName,
                      groomName: (tpl as any).sampleGroom || SAMPLE_DATA.groomName,
                      templateId: tpl.id,
                      weddingDate: templateSampleDate(tpl),
                      coverPhoto: tpl.defaultCover,
                      galleryPhotos: tpl.defaultGallery
                    }, shown)}
                    apiBase={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}
                  />
                </LazyMount>
              </PreviewScale>
            </div>

            <div className={styles.cardInfo}>
              <h2 className={styles.cardTitle}>{tpl.name}</h2>
              <p className={styles.cardTags}>{tpl.tags.slice(0, 3).join(' · ')}</p>
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

      <section className={styles.seoText}>
        <h2>Как выбрать шаблон свадебного приглашения</h2>
        <p>
          Ориентируйтесь на настроение свадьбы: уютный сад, морской бриз, нежные цветы или вечернее золото.
        </p>
        <p>
          Нажмите «Посмотреть», чтобы открыть пример. Понравился стиль — выбирайте и добавляйте свои тексты и фото.
        </p>
      </section>

      <div className={styles.cta}>
        <h2 className={styles.ctaTitle}>Нет нужного шаблона?</h2>
        <p className={styles.ctaText}>Расскажите о вашей свадьбе — обсудим индивидуальный дизайн.</p>
        <a href={`mailto:${LEGAL.contactEmail}?subject=${encodeURIComponent('Заявка на уникальный шаблон')}`} className="btn-primary">
          Обсудить дизайн
        </a>
      </div>
    </div>
  );
}
