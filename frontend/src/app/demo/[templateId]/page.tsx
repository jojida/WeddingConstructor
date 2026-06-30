import { notFound } from 'next/navigation';
import TemplatePreview from '@/components/TemplatePreview';
import { TEMPLATES, TEMPLATE_DEFAULTS } from '@/lib/constants';
import DemoActions from './DemoActions';

interface Props {
  params: Promise<{ templateId: string }>;
}

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

  return (
    <div style={{ minHeight: '100vh', background: '#000', position: 'relative', display: 'flex', justifyContent: 'center' }}>
      {/* Единая ширина превью для всех шаблонов (как у «Скетч» / «Цветущая арка»).
          На десктопе — центрированная колонка, на телефоне — на всю ширину экрана. */}
      <div style={{ width: '100%', maxWidth: 500, boxShadow: '0 0 80px rgba(0,0,0,0.6)' }}>
      <TemplatePreview
        data={{
          ...SAMPLE_DATA,
          brideName: (template as any).sampleBride || SAMPLE_DATA.brideName,
          groomName: (template as any).sampleGroom || SAMPLE_DATA.groomName,
          templateId: template.id,
          coverPhoto: template.defaultCover,
          galleryPhotos: template.defaultGallery,
          inviteText:      defs.inviteText      ?? SAMPLE_DATA.inviteText,
          venue:           defs.venue           ?? SAMPLE_DATA.venue,
          story:           defs.story           ?? SAMPLE_DATA.story,
          schedule:        defs.schedule        ?? SAMPLE_DATA.schedule,
          dressCodeColors: defs.dressCodeColors ?? SAMPLE_DATA.dressCodeColors,
          dressCodePhoto:  defs.dressCodePhoto  ?? SAMPLE_DATA.dressCodePhoto,
          customData: { ...(defs.custom || {}), ...(defs.drinks ? { drinks: defs.drinks } : {}) },
        }}
        apiBase={apiBase}
        fullPage
      />
      </div>

      <DemoActions templateId={template.id} />
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { templateId } = await params;
  const template = TEMPLATES.find(t => t.id === templateId);
  return {
    title: template ? `Превью шаблона: ${template.name}` : 'Превью шаблона',
  };
}
