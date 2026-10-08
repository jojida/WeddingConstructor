'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { TEMPLATES, SITE_URL, LEGAL, PLANS, sampleWeddingDate, templateSampleDate } from '@/lib/constants';
import TemplatePreview from '@/components/TemplatePreview';
import LazyMount from '@/components/LazyMount';
import PrintInvitationsTeaser from '@/components/PrintInvitationsTeaser';
import PreviewScale from '@/components/PreviewScale';
import HeroPhone from '@/components/landing/HeroPhone';
import FeatureDemo from '@/components/landing/FeatureDemo';
import styles from './page.module.css';

// ─── Header ───────────────────────────────────────────────────────────────────
function Header() {
  const { user, logout } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.logo}>
          <img src="/brand/logo-mark.svg" alt="" width="31" height="22" style={{ display: 'block' }} />
          WeddingCraft
        </Link>

        <nav className={styles.nav}>
          <Link href="/templates" className={styles.navLink}>Шаблоны</Link>
          <Link href="/print" className={styles.navLink}>Для печати</Link>
          <a href="#features" className={styles.navLink}>Возможности</a>
          <a href="#rsvp" className={styles.navLink}>Управление</a>
          <a href="#pricing" className={styles.navLink}>Цены</a>
        </nav>

        <div className={styles.headerActions}>
          {user ? (
            <>
              <Link href="/dashboard" className={styles.btnLogin}>Мои сайты</Link>
              <button onClick={logout} className={styles.btnLogin}>Выйти</button>
            </>
          ) : (
            <>
              <Link href="/auth" className={styles.btnLogin}>Войти</Link>
              <Link href="/templates" className={styles.btnStart}>Начать</Link>
            </>
          )}
        </div>

        <button className={styles.burger} onClick={() => setMenuOpen(!menuOpen)} aria-label="Меню">
          <span className={styles.burgerLine} />
          <span className={styles.burgerLine} />
          <span className={styles.burgerLine} />
        </button>
      </div>

      {menuOpen && (
        <div className={styles.mobileMenu}>
          <Link href="/templates" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Шаблоны</Link>
          <Link href="/print" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Печатные приглашения · 290 ₽</Link>
          <a href="#features" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Возможности</a>
          <a href="#rsvp" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Управление</a>
          <a href="#pricing" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Цены</a>
          <div className={styles.mobileDivider} />
          {user ? (
            <>
              <Link href="/dashboard" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Мои сайты</Link>
              <button onClick={() => { logout(); setMenuOpen(false); }} className={styles.mobileLink}>Выйти</button>
            </>
          ) : (
            <>
              <Link href="/auth" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Войти</Link>
              <Link href="/templates" className={styles.mobileCta} onClick={() => setMenuOpen(false)}>Начать создание</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
/* Первый экран: слева обещание и кнопка, справа телефон с живым приглашением
   и плавающими акварельными предметами (components/landing/HeroPhone). */
function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroBg}>
        <div className={styles.heroBgOverlay} />
      </div>

      <div className={styles.heroGrid}>
        {/* Без data-animate: первый экран виден сразу, появление — чистым CSS (heroIn) */}
        <div className={styles.heroText}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            <span>Сезон 2027</span>
          </div>

          <h1 className={styles.heroHeadline}>
            <span className={styles.nowrap}>Сайт-приглашение</span> на свадьбу —{' '}
            <em className={styles.heroItalic}>готов за один вечер</em>
          </h1>

          <p className={styles.heroSubtitle}>
            Ваши фото и музыка в одной красивой ссылке для всех гостей.
            Начните бесплатно, а анкету и карту добавьте, когда будете готовы.
          </p>

          <div className={styles.heroCtas}>
            <Link href="/templates" className={styles.heroCtaPrimary}>Создать бесплатно</Link>
            <a href="#how" className={styles.heroCtaLink}>Как это работает ↓</a>
          </div>
          <div className={styles.heroNote}>Редактор без регистрации · Разовая оплата, без подписки</div>

          <ul className={styles.heroPerks}>
            <li><span aria-hidden="true">✉</span>Конверт и живая обложка</li>
            <li><span aria-hidden="true">✓</span>Анкета для гостей</li>
            <li><span aria-hidden="true">✈</span>Ответы в Telegram</li>
          </ul>
        </div>

        <div className={styles.heroDevice}>
          <HeroPhone />
        </div>
      </div>
    </section>
  );
}

// ─── Templates Section ────────────────────────────────────────────────────────
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

function TemplatesSection() {
  return (
    <section id="examples" className={styles.templatesSection}>
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeader} data-animate>
          <div>
            <span className={styles.sectionLabel}>Избранные стили</span>
            <h2 className={styles.sectionTitle}>Шаблоны свадебных приглашений</h2>
          </div>
          <Link href="/templates" className={styles.seeAllBtn}>
            Смотреть все <span className={styles.arrowIcon}>→</span>
          </Link>
        </div>

        <div className={styles.templatesScroll} data-animate data-delay="150">
          {TEMPLATES.map((tpl) => (
            <Link key={tpl.id} href={`/demo/${tpl.id}`} target="_blank" className={styles.templateScrollItem}>
              <div className={styles.mosaicCard}>
                <PreviewScale className={styles.previewScale}>
                  <LazyMount>
                    <TemplatePreview
                      data={{
                        ...SAMPLE_DATA,
                        brideName: (tpl as any).sampleBride || SAMPLE_DATA.brideName,
                        groomName: (tpl as any).sampleGroom || SAMPLE_DATA.groomName,
                        templateId: tpl.id,
                        weddingDate: templateSampleDate(tpl),
                        coverPhoto: tpl.defaultCover,
                        galleryPhotos: tpl.defaultGallery
                      }}
                      apiBase={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}
                    />
                  </LazyMount>
                </PreviewScale>
                <div className={styles.mosaicOverlay} />
                <div className={styles.mosaicInfo}>
                  <h3 className={styles.mosaicTitle}>{tpl.name}</h3>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className={styles.templatesCta}>
          <Link href="/templates" className="btn-primary">Выбрать шаблон</Link>
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
function Features() {
  const features = [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 36, height: 36 }}>
          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
      title: 'Ответы без обзвона',
      text: 'Гости подтвердят участие, а вы увидите ответы в кабинете.',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 36, height: 36 }}>
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      title: 'Детали под рукой',
      text: 'Карта и программа дня помогут гостям спланировать поездку.',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 36, height: 36 }}>
          <path d="M2 22l1-1h3l9-9" /><path d="M3 21v-3l9-9" />
          <path d="M15 6l3.5-3.5a2.121 2.121 0 0 1 3 3L18 9l.5.5-3 3-.5-.5-9-9" />
        </svg>
      ),
      title: 'Правки без перепечатки',
      text: 'Обновляйте тексты и фото — ссылка останется прежней.',
    },
  ];

  return (
    <section id="features" className={styles.featuresSection}>
      <div className={styles.sectionInner}>
        <div className={styles.howHeader} data-animate>
          <h2 className={styles.sectionTitle}>Всё, что нужно в приглашении</h2>
          <p className={styles.howSubtitle}>Всё, что гостям важно знать, — в одной ссылке</p>
        </div>

        <div className={styles.featuresGrid}>
          {features.map((f, i) => (
            <div key={i} className={styles.featureCard} data-animate data-delay={String(i * 150)}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureText}>{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
/* Тарифы берём из constants — там же их читают страница оплаты и бэкенд.
   Своя копия на лендинге уже приводила к расхождению текстов. */

function Pricing() {
  return (
    <section id="pricing" className={styles.pricingSection}>
      <div className={styles.sectionInner}>
        <div className={styles.howHeader} data-animate>
          <h2 className={styles.sectionTitle}>Простые и честные цены</h2>
          <p className={styles.howSubtitle}>
            Есть бесплатный тариф. Платные — без подписок и продлений.
          </p>
        </div>

        <div className={`${styles.pricingGrid} ${PLANS.length === 1 ? styles.pricingGridSingle : ''}`}>
          {PLANS.map((plan, i) => (
            <div key={i} className={`${styles.pricingCard} ${plan.popular ? styles.pricingCardPopular : ''}`} data-animate data-delay={String(i * 100)}>
              {plan.popular && <div className={styles.popularBadge}>{plan.badge || 'Популярный'}</div>}
              <div className={styles.planName}>{plan.name}</div>
              <div className={styles.planPriceRow}>
                <span className={styles.planCurrency}>₽</span>
                <span className={styles.planPrice}>{plan.price.toLocaleString('ru-RU')}</span>
              </div>
              <div className={styles.planPeriod}>{plan.period}</div>
              <ul className={styles.planFeatures}>
                {plan.features.map((f) => (
                  <li key={f} className={styles.planFeature}>
                    <span className={styles.planCheck}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/templates" className={plan.popular ? styles.planBtnPrimary : styles.planBtnOutline}>
                Начать
              </Link>
            </div>
          ))}
        </div>

        <p className={styles.pricingNote} data-animate>
          Ссылка на WeddingCraft входит в тариф. Свой домен можно купить отдельно и подключить в кабинете.
        </p>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────
function Cta() {
  return (
    <section className={styles.ctaSection}>
      <div className={styles.sectionInner}>
        <div className={styles.ctaBox} data-animate>
          <div className={styles.ctaOrb1} />
          <div className={styles.ctaOrb2} />
          <div className={styles.ctaContent}>
            <h2 className={styles.ctaTitle}>Нет нужного шаблона?</h2>
            <p className={styles.ctaText}>
              Расскажите о вашей свадьбе — обсудим индивидуальный дизайн.
            </p>
            <a href={`mailto:${LEGAL.contactEmail}?subject=${encodeURIComponent('Заявка на уникальный шаблон')}`} className={styles.ctaBtn}>
              Обсудить дизайн
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.sectionInner}>
        <div className={styles.footerGrid}>
          <div>
            <div className={styles.footerLogo}>WeddingCraft</div>
            <p className={styles.footerDesc}>
              © 2026 WeddingCraft — сайты-приглашения на свадьбу.
            </p>
            {/* Реквизиты продавца должны быть видны на сайте, а не только
                внутри оферты — это проверяет модерация платёжного провайдера. */}
            <p className={styles.footerRequisites}>
              {LEGAL.sellerStatus} {LEGAL.sellerName}<br />
              ИНН {LEGAL.sellerInn}{LEGAL.sellerOgrnip ? ` · ОГРНИП ${LEGAL.sellerOgrnip}` : ''}
            </p>
          </div>
          <div>
            <h5 className={styles.footerHeading}>Продукты</h5>
            <ul className={styles.footerLinks}>
              <li><Link href="/templates" className={styles.footerLink}>Шаблоны приглашений</Link></li>
              <li><Link href="/print" className={styles.footerLink}>Печатные приглашения · 290 ₽</Link></li>
              <li><a href="#rsvp" className={styles.footerLink}>Управление</a></li>
            </ul>
          </div>
          <div>
            <h5 className={styles.footerHeading}>Компания</h5>
            <ul className={styles.footerLinks}>
              <li><Link href="/dashboard" className={styles.footerLink}>Личный кабинет</Link></li>
              <li><a href="#features" className={styles.footerLink}>Возможности</a></li>
              <li><Link href="/auth" className={styles.footerLink}>Войти</Link></li>
            </ul>
          </div>
          <div>
            <h5 className={styles.footerHeading}>Поддержка</h5>
            <ul className={styles.footerLinks}>
              <li><Link href="/privacy" className={styles.footerLink}>Политика конфиденциальности</Link></li>
              <li><Link href="/oferta" className={styles.footerLink}>Публичная оферта</Link></li>
              <li><Link href="/contacts" className={styles.footerLink}>Контакты</Link></li>
              <li><Link href="/editor" className={styles.footerLink}>Открыть редактор</Link></li>
              <li><a href="mailto:support@weddingcraft.ru" className={styles.footerLink}>Написать в поддержку</a></li>
            </ul>
          </div>
        </div>

        <div className={styles.footerBottom}>
          {/* Соцсети появятся после создания аккаунтов (VK/Telegram) — мёртвые
              ссылки «#» убраны, чтобы не подрывать доверие. */}
          <div className={styles.footerSocials}>
            <a href="mailto:support@weddingcraft.ru" className={styles.footerSocial} aria-label="Написать в поддержку">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 18, height: 18 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </a>
          </div>
          <div className={styles.footerCopy}>СОЗДАНО С ОСОБЫМ СМЫСЛОМ.</div>
        </div>
      </div>
    </footer>
  );
}

// ─── RSVP / управление гостями ──────────────────────────────────────────────
function RsvpSection() {
  const simple = [
    'Участие и напитки — в одной анкете',
    'Уведомления в Telegram или на почту',
    'Все ответы — в вашем кабинете',
  ];
  const advanced = [
    'Составьте список приглашённых',
    'Отправьте каждому ссылку с личным обращением',
    'Посмотрите, кто уже ответил',
  ];
  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid rgba(206,197,186,0.5)', borderRadius: 18,
    padding: '28px 26px', flex: '1 1 320px',
  };
  const item: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 15, color: '#5b554c', lineHeight: 1.5, marginBottom: 12 };
  const check = <span style={{ color: '#c9a96e', fontWeight: 700, flexShrink: 0 }}>✓</span>;

  return (
    <section id="rsvp" className={styles.featuresSection}>
      <div className={styles.sectionInner}>
        <div className={styles.howHeader} data-animate>
          <h2 className={styles.sectionTitle}>Анкета для гостей на свадьбу</h2>
          <p className={styles.howSubtitle}>Меньше переписок перед свадьбой</p>
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', maxWidth: 920, margin: '0 auto' }} data-animate>
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b8f5c', marginBottom: 6 }}>Ответы гостей</div>
            <h3 style={{ fontFamily: 'var(--font-playfair, Georgia), serif', fontSize: 22, color: '#0e1d26', margin: '0 0 16px' }}>Анкета + уведомления</h3>
            {simple.map(t => <div key={t} style={item}>{check}<span>{t}</span></div>)}
          </div>
          <div style={{ ...card, borderColor: 'rgba(201,169,110,0.55)', boxShadow: '0 10px 40px rgba(201,169,110,0.12)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: 6 }}>Именные приглашения</div>
            <h3 style={{ fontFamily: 'var(--font-playfair, Georgia), serif', fontSize: 22, color: '#0e1d26', margin: '0 0 16px' }}>Каждому — своё приглашение</h3>
            {advanced.map(t => <div key={t} style={item}>{check}<span>{t}</span></div>)}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 28 }} data-animate>
          <Link href="/templates" className={styles.ctaBtn} style={{ display: 'inline-block' }}>
            Создать приглашение с анкетой
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Сравнение с бумажными приглашениями ─────────────────────────────────────
function CompareSection() {
  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid rgba(206,197,186,0.5)', borderRadius: 18,
    padding: '28px 26px', flex: '1 1 320px',
  };
  const item: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 15, color: '#5b554c', lineHeight: 1.5, marginBottom: 12 };
  const yes = <span style={{ color: '#c9a96e', fontWeight: 700, flexShrink: 0 }}>✓</span>;

  const paper = [
    'Открытка на память о вашем дне',
    'Готовый макет в PDF — 290 ₽',
    'Печать дома или в типографии',
    'Ответы гостей собираете сами',
  ];
  const site = [
    'Приглашение открывается на телефоне',
    'Публикация от 0 ₽',
    'Анкета для гостей и карта проезда',
    'Тексты и фото можно менять после публикации',
  ];

  return (
    <section className={styles.featuresSection}>
      <div className={styles.sectionInner}>
        <div className={styles.howHeader} data-animate>
          <h2 className={styles.sectionTitle}>Как пригласить гостей?</h2>
          <p className={styles.howSubtitle}>Выберите удобный формат или сочетайте оба</p>
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', maxWidth: 920, margin: '0 auto' }} data-animate>
          <div style={card}>
            <h3 style={{ fontFamily: 'var(--font-playfair, Georgia), serif', fontSize: 22, color: '#8a8378', margin: '0 0 16px' }}>Бумажные приглашения</h3>
            {paper.map(t => <div key={t} style={item}>{yes}<span>{t}</span></div>)}
          </div>
          <div style={{ ...card, borderColor: 'rgba(201,169,110,0.55)', boxShadow: '0 10px 40px rgba(201,169,110,0.12)' }}>
            <h3 style={{ fontFamily: 'var(--font-playfair, Georgia), serif', fontSize: 22, color: '#0e1d26', margin: '0 0 16px' }}>Сайт-приглашение WeddingCraft</h3>
            {site.map(t => <div key={t} style={item}>{yes}<span>{t}</span></div>)}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Отзывы ──────────────────────────────────────────────────────────────────
/* ⚠️ ЗАГЛУШКИ: заменить на реальные отзывы первых клиентов перед деплоем
   (промо «−30% за отзыв»). Пустой массив — секция не показывается. */
const REVIEWS: { names: string; template: string; text: string }[] = [
  /* Сюда — только настоящие отзывы клиентов с их согласия. Пока массив пуст,
     секция не показывается: выдуманные отзывы вводят покупателя в заблуждение. */
];

function ReviewsSection() {
  if (REVIEWS.length === 0) return null;
  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid rgba(206,197,186,0.5)', borderRadius: 18,
    padding: '26px 24px', flex: '1 1 280px', maxWidth: 360,
  };
  return (
    <section id="reviews" className={styles.featuresSection}>
      <div className={styles.sectionInner}>
        <div className={styles.howHeader} data-animate>
          <h2 className={styles.sectionTitle}>Пары о WeddingCraft</h2>
          <p className={styles.howSubtitle}>Первые свадьбы уже прошли — вот что нам пишут</p>
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }} data-animate>
          {REVIEWS.map(r => (
            <div key={r.names} style={card}>
              <div style={{ color: '#c9a96e', fontSize: 15, letterSpacing: 2, marginBottom: 10 }}>★★★★★</div>
              <p style={{ fontSize: 15, color: '#5b554c', lineHeight: 1.6, margin: '0 0 16px' }}>{r.text}</p>
              <div style={{ fontWeight: 600, color: '#0e1d26', fontSize: 15 }}>{r.names}</div>
              <div style={{ fontSize: 13, color: '#8a8378', marginTop: 2 }}>шаблон «{r.template}»</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Коротко о сервисе ──────────────────────────────────────────────────────
function AboutSection() {
  const p: React.CSSProperties = { fontSize: 16, color: '#5b554c', lineHeight: 1.7, margin: '0 0 16px' };
  return (
    <section id="about" className={styles.featuresSection}>
      <div className={styles.sectionInner}>
        <div className={styles.howHeader} data-animate>
          <h2 className={styles.sectionTitle}>Ваш день — в одной ссылке</h2>
        </div>
        <div style={{ maxWidth: 760, margin: '0 auto' }} data-animate>
          <p style={p}>
            Приглашение всегда под рукой: гости смогут открыть его перед поездкой и вернуться к деталям праздника.
          </p>
          <p style={{ ...p, margin: 0 }}>
            Начните с{' '}
            <Link href="/templates" style={{ color: '#9c7a3c' }}>шаблона сайта</Link> или выберите{' '}
            <Link href="/print" style={{ color: '#9c7a3c' }}>приглашение для печати</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'Как сделать электронное приглашение на свадьбу?',
    a: 'Выберите шаблон, добавьте ваши данные и фото. Результат сразу виден в редакторе.',
  },
  {
    q: 'Как гости получат приглашение?',
    a: 'Отправьте ссылку в мессенджере, по SMS или на почту. Гостям не нужны приложения и регистрация.',
  },
  {
    q: 'Сколько это стоит? Есть ли подписка?',
    a: 'Бесплатный — 0 ₽, «Премиум» — 2 490 ₽, «Максимум» — 3 990 ₽. Оплата разовая, срок действия не ограничен.',
  },
  {
    q: 'Можно ли опубликовать сайт бесплатно?',
    a: 'Да: имена, дата, фото и музыка входят в бесплатный тариф. Анкета, карта и программа дня — в платные.',
  },
  {
    q: 'Можно ли редактировать сайт после оплаты?',
    a: 'Да, бесплатно. Откройте редактор из кабинета и сохраните изменения — ссылка останется прежней.',
  },
  {
    q: 'Что умеет анкета для гостей?',
    a: 'Собирает подтверждения участия и выбор напитков. Ответы видны в кабинете; уведомления можно получать в Telegram или на почту.',
  },
  {
    q: 'Есть ли печатные приглашения на свадьбу?',
    a: 'Да. Выберите дизайн, добавьте данные и скачайте PDF за 290 ₽. Печатайте дома или в типографии.',
  },
  {
    q: 'Можно ли подключить свой домен?',
    a: 'Да, в любом тарифе. Купите домен у регистратора и подключите по инструкции в кабинете.',
  },
];

function FaqSection() {
  return (
    <section id="faq" className={styles.featuresSection}>
      <div className={styles.sectionInner}>
        <div className={styles.howHeader} data-animate>
          <h2 className={styles.sectionTitle}>Частые вопросы</h2>
        </div>
        <div style={{ maxWidth: 760, margin: '0 auto' }} data-animate>
          {FAQ_ITEMS.map(item => (
            <details
              key={item.q}
              style={{
                background: '#fff', border: '1px solid rgba(206,197,186,0.5)', borderRadius: 14,
                padding: '16px 20px', marginBottom: 12,
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 16, color: '#0e1d26', listStyle: 'none' }}>
                {item.q}
              </summary>
              <p style={{ fontSize: 15, color: '#5b554c', lineHeight: 1.6, margin: '12px 0 0' }}>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SEO: структурированные данные (Schema.org) ──────────────────────────────
function JsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'WeddingCraft',
        url: SITE_URL,
        logo: `${SITE_URL}/brand/avatar.png`,
        email: LEGAL.contactEmail,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'WeddingCraft — электронные свадебные приглашения',
        url: SITE_URL,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'ru-RU',
      },
      {
        '@type': 'Product',
        name: 'Сайт-приглашение на свадьбу',
        description:
          'Электронное свадебное приглашение: готовые шаблоны, анкета для гостей, уведомления в Telegram и на Email, персональные ссылки и привязка своего домена.',
        // image обязателен для расширенного сниппета Product (валидатор Яндекса —
        // критичная ошибка без него): обложка с пары + превью шаблонов.
        image: [
          `${SITE_URL}/invite/calla/assets/couple-photo.jpg`,
          ...TEMPLATES.map((tpl) => `${SITE_URL}${tpl.preview}`),
        ],
        url: SITE_URL,
        brand: { '@id': `${SITE_URL}/#organization` },
        offers: PLANS.map((plan) => ({
          '@type': 'Offer',
          name: `Тариф «${plan.name}»`,
          price: String(plan.price),
          priceCurrency: 'RUB',
          url: `${SITE_URL}/#pricing`,
          availability: 'https://schema.org/InStock',
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ_ITEMS.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className={styles.page}>
      <JsonLd />
      <Header />
      <Hero />
      <TemplatesSection />
      <PrintInvitationsTeaser />
      <FeatureDemo />
      <CompareSection />
      <Features />
      <RsvpSection />
      <ReviewsSection />
      <Pricing />
      <AboutSection />
      <FaqSection />
      <Cta />
      <Footer />
    </div>
  );
}
