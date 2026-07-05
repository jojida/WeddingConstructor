'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { TEMPLATES, TEMPLATE_DEFAULTS, SITE_URL } from '@/lib/constants';
import TemplatePreview from '@/components/TemplatePreview';
import MediterraneanTemplate from '@/components/MediterraneanTemplate';
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
        <Link href="/" className={styles.logo}>WeddingCraft</Link>

        <nav className={styles.nav}>
          <Link href="/templates" className={styles.navLink}>Шаблоны</Link>
          <a href="#features" className={styles.navLink}>Возможности</a>
          <a href="#rsvp" className={styles.navLink}>Управление RSVP</a>
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
          <a href="#features" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Возможности</a>
          <a href="#rsvp" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Управление RSVP</a>
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
/* Данные для живого превью «Средиземноморья» в hero: реальные тексты, фото и
   программа дня из TEMPLATE_DEFAULTS — как на странице /demo/mediterranean. */
function heroMediterraneanData() {
  const defs = TEMPLATE_DEFAULTS['mediterranean'] || {};
  return {
    templateId: 'mediterranean',
    groomName: 'Максим',
    brideName: 'Катерина',
    weddingDate: '2026-09-19',
    weddingTime: '16:00',
    venue: defs.venue ?? 'СПА Отель',
    venueAddress: '',
    inviteText: '',
    story: defs.story ?? '',
    dressCode: '',
    dressCodeColors: [],
    dressCodePhoto: defs.dressCodePhoto ?? '',
    coverPhoto: '',
    galleryPhotos: [],
    mapLink: '',
    schedule: defs.schedule ?? [],
    customData: { ...(defs.custom || {}), ...(defs.drinks ? { drinks: defs.drinks } : {}) },
  };
}

function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroBg}>
        <img
          src="https://images.unsplash.com/photo-1519741497674-611481863552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1400"
          alt=""
          className={styles.heroBgImg}
        />
        <div className={styles.heroBgOverlay} />
      </div>

      <div className={styles.heroGrid}>
        <div className={styles.heroText}>
          <div className={styles.heroBadge} data-animate>
            <span className={styles.heroBadgeDot} />
            <span>ЦИФРОВАЯ КОЛЛЕКЦИЯ 2025</span>
          </div>

          <h1 className={styles.heroHeadline} data-animate data-delay="100">
            Ваша идеальная{' '}
            <em className={styles.heroItalic}>история любви</em>
            {' '}в цифровом формате
          </h1>

          <p className={styles.heroSubtitle} data-animate data-delay="200">
            Интерактивные приглашения с мгновенной доставкой, живой музыкой и умным RSVP-сервисом.
          </p>

          <div className={styles.heroCtas} data-animate data-delay="300">
            <Link href="/templates" className={styles.heroCtaPrimary}>Начать создание</Link>
          </div>
        </div>

        <div className={styles.heroDevice}>
          <div className={styles.heroDeviceFrame}>
            {/* Живой шаблон «Средиземноморье» — прокручивается прямо в окошке.
                editing=1 отключает скролл-гейт и «стирание даты» внутри шаблона. */}
            <div className={styles.heroDeviceScreen}>
              <MediterraneanTemplate
                data={heroMediterraneanData()}
                apiBase={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}
                editing
              />
              {/* На мобильных прокрутка внутри окошка «съедает» свайпы —
                  поэтому там iframe не интерактивен, а тап открывает демо. */}
              <Link href="/demo/mediterranean" className={styles.heroDeviceTapLink} aria-label="Открыть демо шаблона «Средиземноморье»">
                <span className={styles.heroDeviceTapPill}>Полистать приглашение ↗</span>
              </Link>
            </div>
            <div className={styles.heroDeviceHint}>Живой пример — прокрутите приглашение</div>
          </div>
          <div className={styles.heroDeviceOrb} />
        </div>
      </div>
    </section>
  );
}

// ─── Templates Section ────────────────────────────────────────────────────────
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

function TemplatesSection() {
  return (
    <section id="examples" className={styles.templatesSection}>
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeader} data-animate>
          <div>
            <span className={styles.sectionLabel}>Цифровые шаблоны</span>
            <h2 className={styles.sectionTitle}>Избранные стили</h2>
          </div>
          <Link href="/templates" className={styles.seeAllBtn}>
            Смотреть все <span className={styles.arrowIcon}>→</span>
          </Link>
        </div>

        <div className={styles.templatesScroll} data-animate data-delay="150">
          {TEMPLATES.map((tpl) => (
            <Link key={tpl.id} href={`/demo/${tpl.id}`} target="_blank" className={styles.templateScrollItem}>
              <div className={styles.mosaicCard}>
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

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
          <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
        </svg>
      ),
      title: 'Выберите шаблон',
      text: 'Изучите нашу коллекцию адаптивных дизайнов, созданных для идеального отображения на любом экране.',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      title: 'Персонализируйте',
      text: 'Добавьте музыку, карту проезда и анкету RSVP в нашем интуитивном редакторе за 5 минут.',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
          <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      ),
      title: 'Отправьте мгновенно',
      text: 'Поделитесь приглашением через мессенджеры или по почте одной ссылкой.',
    },
  ];

  return (
    <section className={styles.howSection}>
      <div className={styles.sectionInner}>
        <div className={styles.howHeader} data-animate>
          <div className={styles.howLabelRow}>
            <span className={styles.howLabelLine} />
            <span className={styles.howLabelText}>КАК ЭТО РАБОТАЕТ</span>
            <span className={styles.howLabelLine} />
          </div>
          <h2 className={styles.howTitle}>
            Три простых шага до{' '}
            <em className={styles.howTitleItalic}>идеального приглашения</em>
          </h2>
        </div>

        <div className={styles.howSteps}>
          {steps.map((step, i) => (
            <div key={i} className={styles.howStep} data-animate data-delay={String(i * 150)}>
              {/* Mobile: left column with icon + connector */}
              <div className={styles.howMobileCol}>
                <div className={styles.howCircle}>{step.icon}</div>
                {i < steps.length - 1 && <div className={styles.howMobileConnector} />}
              </div>

              {/* Card (desktop) / content (mobile) */}
              <div className={styles.howCard}>
                {/* Desktop: icon + label + number row */}
                <div className={styles.howCardRow}>
                  <div className={styles.howCircle}>{step.icon}</div>
                  <span className={styles.howStepLabel}>ШАГ {i + 1}</span>
                  <span className={styles.howStepNum}>0{i + 1}</span>
                </div>
                {/* Mobile: label + number inline */}
                <div className={styles.howMobileLabel}>
                  <span className={styles.howStepLabel}>ШАГ {i + 1}</span>
                  <span className={styles.howMobileNum}>&nbsp;— 0{i + 1}</span>
                </div>
                <h4 className={styles.howStepTitle}>{step.title}</h4>
                <p className={styles.howStepText}>{step.text}</p>
              </div>
            </div>
          ))}
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
      title: 'Умный RSVP',
      text: 'Отслеживайте подтверждения гостей в реальном времени. Получайте уведомления и управляйте списком в личном кабинете.',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 36, height: 36 }}>
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      title: 'Интерактивность',
      text: 'Встроенные карты, обратный отсчёт до торжества и возможность добавить событие в календарь одним кликом.',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 36, height: 36 }}>
          <path d="M2 22l1-1h3l9-9" /><path d="M3 21v-3l9-9" />
          <path d="M15 6l3.5-3.5a2.121 2.121 0 0 1 3 3L18 9l.5.5-3 3-.5-.5-9-9" />
        </svg>
      ),
      title: 'Эко-подход и скорость',
      text: 'Никаких отходов бумаги и ожидания доставки. Ваше приглашение готово за считанные минуты.',
    },
  ];

  return (
    <section id="features" className={styles.featuresSection}>
      <div className={styles.sectionInner}>
        <div className={styles.howHeader} data-animate>
          <h2 className={styles.sectionTitle}>Всё что нужно</h2>
          <p className={styles.howSubtitle}>Мы продумали каждую деталь</p>
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
const PLANS = [
  {
    name: 'Базовый',
    price: '3 990',
    period: 'разовая оплата за один сайт',
    features: ['Сайт-приглашение', 'Форма RSVP', 'Уведомления в Telegram или на Email', 'Музыкальный фон', 'Ссылка на нашем домене'],
    popular: false,
  },
  {
    name: 'Премиум',
    price: '5 990',
    period: 'разовая оплата за один сайт',
    features: ['Всё из Базового', 'Личный кабинет гостей', 'Персональные ссылки с обращением', 'Ответы по каждому гостю', 'Свой домен', 'Неограниченно гостей и фото'],
    popular: true,
  },
];

function Pricing() {
  return (
    <section id="pricing" className={styles.pricingSection}>
      <div className={styles.sectionInner}>
        <div className={styles.howHeader} data-animate>
          <h2 className={styles.sectionTitle}>Простые и честные цены</h2>
          <p className={styles.howSubtitle}>Выберите план, который подходит вам</p>
        </div>

        <div className={styles.pricingGrid}>
          {PLANS.map((plan, i) => (
            <div key={i} className={`${styles.pricingCard} ${plan.popular ? styles.pricingCardPopular : ''}`} data-animate data-delay={String(i * 100)}>
              {plan.popular && <div className={styles.popularBadge}>Популярный</div>}
              <div className={styles.planName}>{plan.name}</div>
              <div className={styles.planPriceRow}>
                <span className={styles.planCurrency}>₽</span>
                <span className={styles.planPrice}>{plan.price}</span>
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
            <h2 className={styles.ctaTitle}>Готовы создать своё цифровое чудо?</h2>
            <p className={styles.ctaText}>
              Начните прямо сейчас и удивите своих гостей современным подходом к традициям.
            </p>
            <Link href="/templates" className={styles.ctaBtn}>
              Создать приглашение сейчас
            </Link>
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
              © 2025 Цифровая свадебная полиграфия WeddingCraft. Будущее ваших традиций.
            </p>
          </div>
          <div>
            <h5 className={styles.footerHeading}>Продукты</h5>
            <ul className={styles.footerLinks}>
              <li><Link href="/templates" className={styles.footerLink}>Цифровые приглашения</Link></li>
              <li><Link href="/templates" className={styles.footerLink}>Digital Save the Date</Link></li>
              <li><Link href="/templates" className={styles.footerLink}>Свадебные сайты</Link></li>
              <li><a href="#rsvp" className={styles.footerLink}>Управление RSVP</a></li>
            </ul>
          </div>
          <div>
            <h5 className={styles.footerHeading}>Компания</h5>
            <ul className={styles.footerLinks}>
              <li><Link href="/dashboard" className={styles.footerLink}>Личный кабинет</Link></li>
              <li><a href="#features" className={styles.footerLink}>Возможности</a></li>
              <li><Link href="/templates" className={styles.footerLink}>Дизайн-студия</Link></li>
              <li><Link href="/auth" className={styles.footerLink}>Войти</Link></li>
            </ul>
          </div>
          <div>
            <h5 className={styles.footerHeading}>Поддержка</h5>
            <ul className={styles.footerLinks}>
              <li><a href="#" className={styles.footerLink}>Политика конфиденциальности</a></li>
              <li><a href="#" className={styles.footerLink}>Условия использования</a></li>
              <li><Link href="/editor" className={styles.footerLink}>Помощь по редактору</Link></li>
              <li><a href="#" className={styles.footerLink}>Частые вопросы</a></li>
            </ul>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <div className={styles.footerSocials}>
            <a href="#" className={styles.footerSocial} aria-label="share">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 18, height: 18 }}>
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </a>
            <a href="#" className={styles.footerSocial} aria-label="instagram">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 18, height: 18 }}>
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </a>
            <a href="#" className={styles.footerSocial} aria-label="mail">
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
    'Гость заполняет анкету: имя, придёт ли, выбор напитка',
    'Ответы мгновенно приходят вам в Telegram или на Email',
    'Вся статистика — в личном кабинете',
  ];
  const advanced = [
    'Добавляйте гостей вручную в личном кабинете',
    'Каждому — персональная ссылка с именным обращением: «Дорогие Денис и Мария», «Семья Кореловых»',
    'Видно, кто ответил и что выбрал — по каждому гостю',
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
          <h2 className={styles.sectionTitle}>Умное управление RSVP</h2>
          <p className={styles.howSubtitle}>Сайт сам собирает ответы гостей — вам остаётся встречать</p>
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', maxWidth: 920, margin: '0 auto' }} data-animate>
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b8f5c', marginBottom: 6 }}>Базовый</div>
            <h3 style={{ fontFamily: 'var(--font-playfair, Georgia), serif', fontSize: 22, color: '#0e1d26', margin: '0 0 16px' }}>Анкета + уведомления</h3>
            {simple.map(t => <div key={t} style={item}>{check}<span>{t}</span></div>)}
          </div>
          <div style={{ ...card, borderColor: 'rgba(201,169,110,0.55)', boxShadow: '0 10px 40px rgba(201,169,110,0.12)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: 6 }}>Премиум</div>
            <h3 style={{ fontFamily: 'var(--font-playfair, Georgia), serif', fontSize: 22, color: '#0e1d26', margin: '0 0 16px' }}>Личный кабинет гостей</h3>
            {advanced.map(t => <div key={t} style={item}>{check}<span>{t}</span></div>)}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 28 }} data-animate>
          <Link href="/templates" className={styles.ctaBtn} style={{ display: 'inline-block' }}>
            Создать приглашение с RSVP
          </Link>
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
          'Электронное свадебное приглашение: готовые шаблоны, RSVP-анкета гостей, уведомления в Telegram и на Email, персональные ссылки и свой домен.',
        brand: { '@id': `${SITE_URL}/#organization` },
        offers: PLANS.map((plan) => ({
          '@type': 'Offer',
          name: `Тариф «${plan.name}»`,
          price: plan.price.replace(/\s/g, ''),
          priceCurrency: 'RUB',
          url: `${SITE_URL}/#pricing`,
          availability: 'https://schema.org/InStock',
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
      <HowItWorks />
      <Features />
      <RsvpSection />
      <Pricing />
      <Cta />
      <Footer />
    </div>
  );
}
