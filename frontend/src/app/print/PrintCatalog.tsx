'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Check, FileDown, Printer, Sparkles } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { PRINT_TEMPLATES, PRINT_PRICE, printDimensions } from '@/lib/print';
import styles from './print.module.css';

export default function PrintCatalog() {
  const [filter, setFilter] = useState('Все дизайны');
  return <><Navbar /><main className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.heroText}><span className={styles.eyebrow}>WEDDINGCRAFT · БУМАЖНАЯ КОЛЛЕКЦИЯ</span>
        <h1>Ваша история.<br /><em>На красивой бумаге.</em></h1>
        <p>Приглашение на память о вашем дне.<br />Добавьте ваши слова и скачайте макет для печати.</p>
        <div className={styles.heroActions}><a className={styles.primary} href="#collection">Выбрать приглашение <ArrowDown size={17} /></a><span><b>{PRINT_PRICE} ₽</b> за готовый макет</span></div>
        <div className={styles.benefits}><span><Check size={14} /> PDF для печати</span><span><Check size={14} /> Без подписки</span><span><Check size={14} /> Любой тираж</span></div>
      </div>
      <div className={styles.heroArt} aria-label="Примеры печатных приглашений"><div className={styles.paperBack}><img src="/print/boarding.svg" alt="Приглашение-билет Рейс в счастье" /></div><div className={styles.paperFront}><img src="/print/petals.svg" alt="Приглашение с объёмными цветами Шёпот лепестков" /></div><span className={styles.seal}>с любовью<br />к деталям</span><span className={styles.artCaption}>маленькая деталь большого дня</span></div>
    </section>
    <section className={styles.steps} aria-label="Как это работает">{[
      ['01', 'Найдите ваш дизайн', 'От первой полосы до билета в счастье.', Sparkles],
      ['02', 'Добавьте ваши слова', 'Имена, дата и место — в простом редакторе.', Check],
      ['03', 'Скачайте и распечатайте', 'Оплатите 290 ₽ и получите готовый PDF.', FileDown],
    ].map(([n, title, description, Icon]) => <div key={String(n)}><span className={styles.stepNumber}>{String(n)}</span><div><h3>{String(title)}</h3><p>{String(description)}</p></div>{typeof Icon !== 'string' && <Icon size={22} strokeWidth={1} />}</div>)}</section>
    <section id="collection" className={styles.collection}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>ВЫБЕРИТЕ ВАШЕ НАСТРОЕНИЕ</span><h2>Бумага. Чувства. Вы.</h2></div><p>Один дизайн — {PRINT_PRICE} ₽<br /><span>Редактирование и предпросмотр бесплатно</span></p></div>
      <div className={styles.filters} aria-label="Стиль приглашения">{['Все дизайны', 'Минимализм', 'Ботаника', 'Романтика', 'Классика', 'Редакционный', 'Путешествия'].map(f => <button key={f} aria-pressed={filter === f} className={filter === f ? styles.selected : ''} onClick={() => setFilter(f)}>{f}</button>)}</div>
      <div className={styles.grid}>{PRINT_TEMPLATES.filter(t => filter === 'Все дизайны' || t.category === filter).map(t => <Link href={`/print/editor?template=${t.id}`} key={t.id} className={styles.card}><div className={styles.cardArt} style={{ background: t.color }}><span className={styles.tag}>{t.category}</span><img src={`/print/${t.id}.svg`} alt={`Печатное приглашение «${t.name}»`} loading="lazy" /><span className={styles.cardHint}>Настроить приглашение <ArrowUpRight size={17} /></span></div><div className={styles.cardTitle}><h3>{t.name}</h3><span>{PRINT_PRICE} ₽</span></div><p>{t.description}</p><span className={styles.cardMeta}>A6 · {printDimensions(t.id)} · PDF <span>{String(PRINT_TEMPLATES.indexOf(t) + 1).padStart(2, '0')}</span></span></Link>)}</div>
    </section>
    <section className={styles.printNote}><Printer size={38} strokeWidth={1} /><div><span className={styles.eyebrow}>ОТ ЭКРАНА К ТЁПЛЫМ ВСТРЕЧАМ</span><h2>Красиво в руках.<br /><em>Просто в печати.</em></h2></div><div><p>Два PDF без водяного знака: A6 для дома и макет с вылетами 3 мм для типографии.</p><p>Текст можно менять, файлы — скачивать повторно. Бумага, печать и доставка оплачиваются отдельно.</p></div></section>
    <section className={styles.faq}><h2>Осталось несколько вопросов?</h2>{[
      ['Что входит в 290 ₽?', 'Один дизайн, правки текста и повторное скачивание PDF. Тираж для вашей свадьбы не ограничен.'],
      ['Можно посмотреть до оплаты?', 'Да. Предпросмотр бесплатный; оплачивается скачивание PDF.'],
      ['Какую бумагу выбрать?', 'Матовую, 250–300 г/м². Уточните допустимую плотность у типографии или в инструкции принтера и сделайте пробный отпечаток.'],
      ['Как правильно распечатать?', 'Дома: A6, масштаб 100%, без подгонки. В типографии: PDF с вылетами 3 мм. Перед тиражом проверьте пробный отпечаток.'],
      ['Нужно ли покупать сайт-приглашение?', 'Нет, макет покупается отдельно. Войдите по email, чтобы сохранить покупку и скачивать PDF повторно.'],
    ].map(([q, a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</section>
    <footer className={styles.footer}><Link href="/">WeddingCraft</Link><Link href="/print/orders">Мои печатные приглашения</Link><Link href="/oferta">Оферта</Link><Link href="/contacts">Контакты</Link><a href="mailto:support@weddingcraft.ru">Помощь</a></footer>
  </main></>;
}
