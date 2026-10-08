import { notFound } from 'next/navigation';
import Link from 'next/link';
import TemplatePreview from '@/components/TemplatePreview';
import { TEMPLATES, TEMPLATE_DEFAULTS, sampleWeddingDate, templateSampleDate, templateCustomDefaults, demoMapPoint, templateMusic } from '@/lib/constants';
import { PLANS } from '@/lib/plans';
import DemoActions from './DemoActions';

interface Props {
  params: Promise<{ templateId: string }>;
}

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

/* Поисковая формулировка стиля шаблона — под запросы вида «приглашение на
   свадьбу в лесном стиле». Новый шаблон без строки здесь просто остаётся без
   подзаголовка — блок под демо всё равно выводится. */
const STYLE_PHRASE: Record<string, string> = {
  vitrage: 'Зимнее свадебное приглашение с витражом и снегом',
  tenderness: 'Нежное приглашение на свадьбу в бежевых тонах с конвертом',
  angels: 'Приглашение на свадьбу с ангелами и облаками',
  forest: 'Приглашение на свадьбу в лесном стиле',
  'garden-evening': 'Приглашение на свадьбу в саду с гирляндами',
  ivory: 'Элегантное приглашение на свадьбу с конвертом и сургучом',
  calla: 'Приглашение на свадьбу с каллами и жемчугом',
  sketch: 'Весёлое рисованное приглашение на свадьбу',
  floral: 'Цветочное приглашение на свадьбу в стиле бохо',
  'garden-arch': 'Приглашение на свадьбу с цветочной аркой',
  mediterranean: 'Приглашение на свадьбу в средиземноморском стиле',
  vadimdarya: 'Тёмное элегантное приглашение на свадьбу с золотом',
};

type Tpl = (typeof TEMPLATES)[number];

/* Похожие шаблоны: сначала с общими тегами, затем остальные по порядку каталога.
   «Анимация» и «Видео» есть почти у всех — по ним похожесть не считаем. */
const GENERIC_TAGS = new Set(['Анимация', 'Видео']);
function similarTemplates(template: Tpl, count = 4): Tpl[] {
  const tags = new Set(template.tags.filter(tag => !GENERIC_TAGS.has(tag)));
  return TEMPLATES
    .filter(t => t.id !== template.id)
    .map((t, i) => ({ t, i, score: t.tags.filter(tag => tags.has(tag)).length }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, count)
    .map(x => x.t);
}

/* Текст под живым демо: без него страница для поисковика пустая — всё
   приглашение живёт внутри iframe, а его содержимое странице не засчитывается. */
function DemoAbout({ template }: { template: Tpl }) {
  const phrase = STYLE_PHRASE[template.id];
  const paid = PLANS.filter(p => p.price > 0).map(p => p.price);
  const minPrice = paid.length ? Math.min(...paid) : 0;
  const p: React.CSSProperties = { fontSize: 16, lineHeight: 1.7, color: '#5b554c', margin: '0 0 14px' };
  const h2: React.CSSProperties = { fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 400, fontSize: 24, color: '#0e1d26', margin: '32px 0 12px' };
  const chip: React.CSSProperties = { fontSize: 13, color: '#685d4a', background: '#f4efe6', borderRadius: 50, padding: '5px 12px' };
  const card: React.CSSProperties = { display: 'block', padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(206,197,186,0.6)', textDecoration: 'none', color: '#0e1d26', background: '#fff' };

  return (
    <section style={{ width: '100%', background: '#faf8f4', padding: '56px 16px 140px', fontFamily: 'var(--font-inter), Inter, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 400, fontSize: 'clamp(26px, 5vw, 36px)', lineHeight: 1.2, color: '#0e1d26', margin: '0 0 10px' }}>
          Шаблон свадебного приглашения «{template.name}»
        </h1>
        {phrase && <p style={{ ...p, fontSize: 18, color: '#685d4a' }}>{phrase}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '4px 0 20px' }}>
          {template.tags.map(tag => <span key={tag} style={chip}>{tag}</span>)}
        </div>
        <p style={p}>{template.description}</p>

        <h2 style={h2}>Что можно настроить</h2>
        <p style={p}>
          Замените имена, дату, тексты, фото и музыку. Лишние разделы можно скрыть.
        </p>
        <p style={p}>
          Редактор без регистрации, публикация от 0 ₽.
          {minPrice > 0 && <> Платные тарифы — от {minPrice.toLocaleString('ru-RU')} ₽, без подписки.</>}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '24px 0 8px' }}>
          <a href={`/editor?template=${template.id}`} style={{ padding: '14px 32px', borderRadius: 50, background: 'linear-gradient(135deg, #d3c5ad, #685d4a)', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 15 }}>
            Выбрать этот шаблон
          </a>
          <Link href="/templates" style={{ padding: '14px 28px', borderRadius: 50, border: '1px solid #c9bda9', color: '#685d4a', textDecoration: 'none', fontSize: 15 }}>
            Все шаблоны
          </Link>
        </div>

        <h2 style={h2}>Похожие шаблоны</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
          {similarTemplates(template).map(t => (
            <Link key={t.id} href={`/demo/${t.id}`} style={card}>
              <div style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 18, marginBottom: 4 }}>«{t.name}»</div>
              <div style={{ fontSize: 13, color: '#8a8378' }}>{t.tags.slice(0, 3).join(' · ')}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function DemoPage({ params }: Props) {
  const { templateId } = await params;
  
  const template = TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    notFound();
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  /* Реальный контент шаблона (тексты, фото и расписание с НАСТОЯЩИМИ
     иконками-SVG) берём из TEMPLATE_DEFAULTS — иначе превью показывало бы
     общий эмодзи-плейсхолдер вместо иконок дизайна. */
  const defs = TEMPLATE_DEFAULTS[template.id] || {};
  const weddingDate = templateSampleDate(template);

  return (
    <>
    <div style={{ minHeight: '100vh', background: '#ececec', position: 'relative', display: 'flex', justifyContent: 'center' }}>
      {/* Единая ширина превью для всех шаблонов (как у «Скетч» / «Цветущая арка»).
          На десктопе — центрированная колонка, на телефоне — на всю ширину экрана. */}
      <div style={{ width: '100%', maxWidth: 500, isolation: 'isolate', zIndex: 0, boxShadow: '0 10px 50px rgba(60,48,32,0.18)' }}>
      <TemplatePreview
        data={{
          ...SAMPLE_DATA,
          brideName: (template as any).sampleBride || SAMPLE_DATA.brideName,
          groomName: (template as any).sampleGroom || SAMPLE_DATA.groomName,
          templateId: template.id,
          weddingDate,
          coverPhoto: template.defaultCover,
          galleryPhotos: template.defaultGallery,
          inviteText:      defs.inviteText      ?? SAMPLE_DATA.inviteText,
          venue:           defs.venue           ?? SAMPLE_DATA.venue,
          venueAddress:    defs.venueAddress    ?? SAMPLE_DATA.venueAddress,
          story:           defs.story           ?? SAMPLE_DATA.story,
          schedule:        defs.schedule        ?? SAMPLE_DATA.schedule,
          dressCodeColors: defs.dressCodeColors ?? SAMPLE_DATA.dressCodeColors,
          dressCodePhoto:  defs.dressCodePhoto  ?? SAMPLE_DATA.dressCodePhoto,
          musicUrl:        templateMusic(template.id),
          customData: {
            ...templateCustomDefaults(template.id, weddingDate),
            mapPoint: demoMapPoint(defs.venueAddress ?? SAMPLE_DATA.venueAddress),
          },
        }}
        apiBase={apiBase}
        fullPage
      />
      </div>

      <DemoActions templateId={template.id} />
    </div>
    <DemoAbout template={template} />
    </>
  );
}

export async function generateMetadata({ params }: Props) {
  const { templateId } = await params;
  const template = TEMPLATES.find(t => t.id === templateId);
  if (!template) return { title: 'Превью шаблона' };
  return {
    title: `Шаблон «${template.name}» — сайт-приглашение на свадьбу`,
    description: `${template.description} Живое демо шаблона свадебного сайта-приглашения с анкетой для гостей.`,
    alternates: { canonical: `/demo/${template.id}` },
    openGraph: {
      title: `Шаблон «${template.name}» — сайт-приглашение на свадьбу`,
      description: template.description,
      url: `/demo/${template.id}`,
      images: [{ url: template.preview, alt: `Шаблон свадебного приглашения «${template.name}»` }],
    },
  };
}
