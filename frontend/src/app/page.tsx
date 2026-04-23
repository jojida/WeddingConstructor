'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { TEMPLATES } from '@/lib/constants';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

export default function HomePage() {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <div className={styles.page}>
      <Navbar />

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroOrbs}>
          <div className={styles.orb1} />
          <div className={styles.orb2} />
          <div className={styles.orb3} />
        </div>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span>✦</span> Онлайн конструктор
          </div>
          <h1 className={styles.heroTitle}>
            Создайте сайт-приглашение
            <span className="text-gold-gradient"> на вашу свадьбу</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Выберите шаблон, добавьте фото и текст — и поделитесь красивой ссылкой с гостями.
            Никакого кода, никаких технических знаний.
          </p>
          <div className={styles.heroButtons}>
            <Link href="/templates" className="btn-primary">
              Выбрать шаблон ✦
            </Link>
            {!mounted || !user ? (
              <Link href="/auth" className="btn-outline">
                Войти в аккаунт
              </Link>
            ) : (
              <Link href="/dashboard" className="btn-outline">
                Мои приглашения
              </Link>
            )}
          </div>
          <div className={styles.heroStats}>
            <div className={styles.stat}>
                    <div className={styles.statNum}>6</div>
                    <div className={styles.statLabel}>шаблонов</div>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>990₽</span>
              <span className={styles.statLabel}>от</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>5 мин</span>
              <span className={styles.statLabel}>на создание</span>
            </div>
          </div>
        </div>

        {/* Phone mockup */}
        <div className={styles.heroVisual}>
          <div className={styles.phoneMockup}>
            <div className={styles.phoneFrame}>
              <div className={styles.phoneNotch} />
              <div className={styles.phoneScreen}>
                {/* Mini invite preview inside phone */}
                <div className={styles.phoneInvite}>
                  <div className={styles.phoneHero}>
                    <div className={styles.phoneOrnament}>✦ ✦ ✦</div>
                    <div className={styles.phoneEyebrow}>Вас приглашают</div>
                    <div className={styles.phoneNames}>Анна<br /><span>&amp;</span><br />Михаил</div>
                    <div className={styles.phoneDate}>14 июня 2025</div>
                  </div>
                  <div className={styles.phoneDetails}>
                    <div className={styles.phoneDetailRow}>
                      <span>📍</span>
                      <div>
                        <div className={styles.phoneDetailTitle}>Место</div>
                        <div className={styles.phoneDetailVal}>Усадьба «Белый сад»</div>
                      </div>
                    </div>
                    <div className={styles.phoneDetailRow}>
                      <span>🕐</span>
                      <div>
                        <div className={styles.phoneDetailTitle}>Начало</div>
                        <div className={styles.phoneDetailVal}>16:00</div>
                      </div>
                    </div>
                    <div className={styles.phoneDetailRow}>
                      <span>👗</span>
                      <div>
                        <div className={styles.phoneDetailTitle}>Дресс-код</div>
                        <div className={styles.phoneDetailVal}>White Tie</div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.phoneRsvp}>
                    <div className={styles.phoneRsvpTitle}>Анкета гостя</div>
                    <div className={styles.phoneRsvpBtns}>
                      <div className={styles.phoneRsvpYes}>✓ Буду</div>
                      <div className={styles.phoneRsvpNo}>✗ Нет</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.phoneHome} />
            </div>
            {/* Floating badges */}
            <div className={styles.phoneBadge1}>
              <span>🎉</span> RSVP отправлен!
            </div>
            <div className={styles.phoneBadge2}>
              <span>💌</span> 48 гостей
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={styles.howSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionBadge}>Как это работает</div>
            <h2 className={styles.sectionTitle}>Три шага до вашего сайта</h2>
          </div>
          <div className={styles.steps}>
            {[
              { num: '01', icon: '🎨', title: 'Выберите шаблон', desc: 'Выберите один из 6 красивых дизайнов под ваш стиль свадьбы' },
              { num: '02', icon: '✍️', title: 'Заполните данные', desc: 'Добавьте имена, дату, место, фотографии и историю пары' },
              { num: '03', icon: '🔗', title: 'Поделитесь ссылкой', desc: 'После оплаты вы получаете уникальную ссылку для гостей' },
            ].map((step, i) => (
              <div key={i} className={styles.step}>
                <div className={styles.stepNum}>{step.num}</div>
                <div className={styles.stepIcon}>{step.icon}</div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.desc}</p>
                {i < 2 && <div className={styles.stepArrow}>→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TEMPLATE PREVIEW */}
      <section className={styles.templatesSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionBadge}>Шаблоны</div>
            <h2 className={styles.sectionTitle}>Выберите свой стиль</h2>
            <p className={styles.sectionDesc}>Каждый шаблон — это полноценный сайт с анимациями, галереей и формой RSVP</p>
          </div>
          <div className={styles.templateGrid}>
            {TEMPLATES.map((tpl, i) => (
              <div key={tpl.id} className={styles.templateCard} style={{ animationDelay: `${i * 0.1}s` }}>
                <div className={styles.templatePreview} style={{ background: `linear-gradient(135deg, ${tpl.colors[0]}, ${tpl.colors[1]})` }}>
                  <div className={styles.templateMockup}>
                    <div className={styles.mockupHeader} style={{ color: tpl.colors[2] }}>✦ Приглашение</div>
                    <div className={styles.mockupNames} style={{ color: tpl.colors[2] }}>Анна & Михаил</div>
                    <div className={styles.mockupDate} style={{ color: tpl.colors[1] }}>14 · 06 · 2025</div>
                  </div>
                  <div className={styles.templateOverlay}>
                    <Link href={`/editor?template=${tpl.id}`} className="btn-primary">
                      Использовать
                    </Link>
                  </div>
                </div>
                <div className={styles.templateInfo}>
                  <h3 className={styles.templateName}>{tpl.name}</h3>
                  <p className={styles.templateDesc}>{tpl.description}</p>
                  <div className={styles.templateTags}>
                    {tpl.tags.map(tag => (
                      <span key={tag} className={styles.tag}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.templatesFooter}>
            <Link href="/templates" className="btn-primary">
              Смотреть все шаблоны
            </Link>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className={styles.pricingSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionBadge}>Тарифы</div>
            <h2 className={styles.sectionTitle}>Простые и честные цены</h2>
          </div>
          <div className={styles.pricingGrid}>
            {[
              { name: 'Базовый', price: '990', period: '6 мес', features: ['1 шаблон', 'До 3 фото', 'RSVP форма', 'Ссылка-приглашение'], popular: false },
              { name: 'Стандарт', price: '1 990', period: '1 год', features: ['Все шаблоны', 'До 10 фото', 'Карта и история', 'QR-код'], popular: true },
              { name: 'Премиум', price: '3 490', period: 'Бессрочно', features: ['Всё из Стандарта', 'Неограниченно фото', 'Музыка', 'Приоритетная поддержка'], popular: false },
            ].map((plan, i) => (
              <div key={i} className={`${styles.pricingCard} ${plan.popular ? styles.pricingPopular : ''}`}>
                {plan.popular && <div className={styles.popularBadge}>Популярный</div>}
                <div className={styles.planName}>{plan.name}</div>
                <div className={styles.planPrice}>
                  <span className={styles.planCurrency}>₽</span>
                  {plan.price}
                </div>
                <div className={styles.planPeriod}>{plan.period}</div>
                <ul className={styles.planFeatures}>
                  {plan.features.map(f => (
                    <li key={f} className={styles.planFeature}>
                      <span className={styles.checkmark}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/templates" className={plan.popular ? 'btn-primary' : 'btn-outline'} style={{ width: '100%' }}>
                  Начать
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Готовы создать свой сайт?</h2>
          <p className={styles.ctaDesc}>Займёт всего 5 минут. Никаких технических знаний не нужно.</p>
          <Link href="/templates" className="btn-primary" style={{ fontSize: '17px', padding: '16px 48px' }}>
            Начать бесплатно ✦
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className="container">
          <div className={styles.footerLogo}>✦ WeddingCraft</div>
          <p className={styles.footerText}>Создавайте воспоминания с любовью</p>
        </div>
      </footer>
    </div>
  );
}
