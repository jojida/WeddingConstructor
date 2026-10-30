import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { SITE_URL } from '@/lib/constants';
import { PLANS } from '@/lib/plans';
import styles from '../blog/blog.module.css';

/* Посадочная под запрос «рассадка гостей на свадьбу онлайн» (30.10.26). Сама рассадка —
   в кабинете («Планировщик», тариф «Максимум»), здесь — что она умеет. Факты сверены
   с кодом планировщика: два круглых стола по 8 мест при первом входе, до 50 мест
   за столом, авторассадка не разделяет группы без нужды, 8 видов PDF, «Ваш стол»
   по личной ссылке. Адрес зарезервирован в backend/src/lib/slug.ts (RESERVED_SLUGS). */

const PATH = '/rassadka-gostey-na-svadbu';
const TITLE = 'Рассадка гостей на свадьбу онлайн';
const DESCRIPTION =
  'Рассадка гостей по столам онлайн: список собирается из ответов на анкету, столы — на схеме, авторассадка за минуту. ' +
  'Карточки, таблички на столы и план рассадки — в PDF. Гости видят свой стол по личной ссылке.';

export const metadata: Metadata = {
  title: `${TITLE}: схема столов, карточки и таблички`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: 'website',
    siteName: 'WeddingCraft',
    locale: 'ru_RU',
    url: PATH,
    title: TITLE,
    description: DESCRIPTION,
  },
};

const FAQ = [
  {
    q: 'Можно ли добавить гостей, которые не отвечали на анкету?',
    a: 'Да. Гостей можно добавить вручную по одному или вставить списком — например, из заметок или таблицы.',
  },
  {
    q: 'Что будет, если гость передумает?',
    a: 'Если гость ответит в анкете «не смогу», его место за столом освободится само, а в разделе рассадки появится уведомление.',
  },
  {
    q: 'Сколько гостей можно рассадить?',
    a: 'Отдельного ограничения на число гостей и столов нет. За одним столом — от 1 до 50 мест.',
  },
  {
    q: 'Можно ли выгрузить список в Excel?',
    a: 'Да: список гостей со столами выгружается в CSV — этот файл открывается в Excel и Google Таблицах.',
  },
];

/* Схема-иллюстрация: круглый стол на 8 мест с табличками «номер места + имя», как в кабинете */
const SEATS = ['Анна', 'Игорь', 'Ольга', 'Павел', 'Мария', 'Сергей', 'Елена', 'Дмитрий'];

function TableSketch() {
  const cx = 180, cy = 150, r = 110;
  return (
    <svg viewBox="0 0 360 300" role="img" aria-label="Пример схемы: круглый стол на 8 гостей с табличками имён"
      style={{ width: '100%', maxWidth: 420, display: 'block', margin: '0 auto' }}>
      <circle cx={cx} cy={cy} r={62} fill="#f4efe6" stroke="#c9bda9" strokeWidth={1.5} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={15} fill="#685d4a" fontFamily="var(--font-playfair), Georgia, serif">Стол 1</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize={11} fill="#8a8378">8 из 8 мест</text>
      {SEATS.map((name, i) => {
        const a = (i * 45 - 90) * Math.PI / 180;
        const x = Math.round(cx + r * Math.cos(a));
        const y = Math.round(cy + r * Math.sin(a));
        return (
          <g key={name}>
            <rect x={x - 46} y={y - 13} width={92} height={26} rx={13} fill="#fff" stroke="#d3c5ad" />
            <circle cx={x - 33} cy={y} r={8} fill="#685d4a" />
            <text x={x - 33} y={y + 3.5} textAnchor="middle" fontSize={10} fill="#fff">{i + 1}</text>
            <text x={x - 20} y={y + 4.5} fontSize={12.5} fill="#3d3830">{name}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function SeatingLandingPage() {
  const maximum = PLANS.find(p => p.id === 'maximum');
  const url = `${SITE_URL}${PATH}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: TITLE, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
  };
  const h3: React.CSSProperties = { fontSize: 17, fontWeight: 600, color: 'var(--on-surface)', margin: '22px 0 6px' };

  return (
    <div className={styles.page}>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className={styles.container}>
        <nav className={styles.crumbs} aria-label="Навигация">
          <Link href="/">Главная</Link><span>/</span><span>Рассадка гостей</span>
        </nav>
        <h1 className={styles.title}>{TITLE}</h1>
        <p className={styles.lead}>
          Список гостей собирается сам — из ответов на анкету в вашем приглашении. Вы ставите столы, сажаете гостей
          вручную или авторассадкой и скачиваете готовые карточки, таблички и план рассадки для печати.
        </p>

        <figure style={{ margin: '28px 0 8px', padding: '22px 12px 14px', background: 'var(--surface-container-low)', borderRadius: 20 }}>
          <TableSketch />
          <figcaption style={{ fontSize: 14, color: 'var(--outline)', textAlign: 'center', marginTop: 8 }}>
            Стол в кабинете: на табличках номер места и имя гостя, гостей можно пересаживать
          </figcaption>
        </figure>

        <div className={styles.body}>
          <h2>Как это работает</h2>
          <ol>
            <li>
              <strong>Гости отвечают на анкету</strong> в сайте-приглашении: придут ли, сколько человек будет с ними, есть ли дети.
              Каждый ответ сразу попадает в список для рассадки.
            </li>
            <li>
              <strong>Вы ставите столы.</strong> Два круглых стола по 8 мест уже стоят — добавьте нужные: круглые или длинные,
              на нужное число мест.
            </li>
            <li>
              <strong>Сажаете гостей.</strong> Перетащите гостя на свободное место или нажмите «Посадить». Авторассадка разложит
              всех по свободным местам и без нужды не разделит тех, кто пришёл вместе.
            </li>
            <li>
              <strong>Печатаете.</strong> Карточки, таблички и план рассадки скачиваются в PDF, оформление можно подобрать под шаблон приглашения.
            </li>
          </ol>

          <h2>Что можно распечатать</h2>
          <ul>
            <li>карточки гостей с именем и номером стола;</li>
            <li>таблички с номером стола «домиком»;</li>
            <li>план рассадки для входа в зал — плакат нужного размера;</li>
            <li>список гостей по алфавиту — каждый быстро найдёт свой стол;</li>
            <li>списки по столам и сводку для ресторана;</li>
            <li>меню и бланк для пожеланий.</li>
          </ul>

          <h2>Гости видят свой стол</h2>
          <p>
            Если отправить гостям персональные ссылки, на сайте-приглашении появится плашка «Ваш стол» — гость заранее
            узнает, где сидит. Показывать её или нет, решаете вы.
          </p>

          <h2>Меню и выбор блюд</h2>
          <p>
            В анкете гость выбирает горячее — для себя и для каждого, кто придёт с ним. Сколько порций какого блюда нужно,
            считается само, а сводку можно отдать ресторану.
          </p>

          <h2>Сколько стоит</h2>
          <p>
            Рассадка, меню, печатные материалы и напоминание гостям за неделю до свадьбы входят в тариф «Максимум»
            {maximum && <> — {maximum.price.toLocaleString('ru-RU')} ₽ один раз, без подписки</>}. В нём же всё из «Премиума»:
            анкета для гостей, место с картой, программа дня и персональные ссылки. <Link href="/#pricing">Сравнить тарифы</Link>
          </p>
        </div>

        <div className={styles.cta}>
          <div className={styles.ctaTitle}>Начните с приглашения</div>
          <p className={styles.ctaText}>
            Выберите шаблон и добавьте анкету для гостей — по их ответам соберётся список для рассадки.
          </p>
          <div className={styles.ctaRow}>
            <Link href="/templates" className={styles.ctaBtn}>Выбрать шаблон</Link>
            <span className={styles.ctaNote}>Рассадка — в тарифе «Максимум»</span>
          </div>
        </div>

        <div className={styles.body}>
          <h2>Вопросы</h2>
          {FAQ.map(f => (
            <div key={f.q}>
              <h3 style={h3}>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </div>

        <h2 className={styles.relatedTitle}>Ещё по теме</h2>
        <div className={styles.cards}>
          <Link href="/blog/kak-rassadit-gostey-na-svadbe" className={styles.card}>
            <span className={styles.cardTitle}>Как рассадить гостей на свадьбе</span>
            <span className={styles.cardMore}>Читать →</span>
          </Link>
          <Link href="/blog/anketa-dlya-gostey-na-svadbu" className={styles.card}>
            <span className={styles.cardTitle}>Анкета для гостей на свадьбу</span>
            <span className={styles.cardMore}>Читать →</span>
          </Link>
        </div>
      </article>
    </div>
  );
}
