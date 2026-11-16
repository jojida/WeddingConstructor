import type { InviteData } from '@/components/TemplatePreview';
import { TEMPLATES, TEMPLATE_DEFAULTS, templateSampleDate, templateCustomDefaults, demoMapPoint, templateMusic } from './constants';

/* Приглашение-пример шаблона: имена-образцы, тексты, фото, программа дня и
   мелодия из его дизайна. Его показывают живое демо (/demo/<id>) и превью на
   первом шаге редактора («Расскажите о вашей свадьбе»), пока пара не ввела
   свои данные, — шаблон выглядит одинаково и там, и там. */
const SAMPLE = {
  brideName: 'Дарья',
  groomName: 'Вадим',
  weddingTime: '16:00',
  venue: 'Усадьба «Белый сад»',
  venueAddress: 'Москва, ул. Крымский Вал, 9',
  inviteText: 'Приглашаем вас разделить с нами радость нашего свадебного дня.',
  story: 'Мы встретились пять лет назад и с тех пор не расставались. Наш путь был полон приключений и любви.',
  dressCode: 'White Tie',
  dressCodeColors: [] as string[],
  dressCodePhoto: '',
  coverPhoto: '',
  galleryPhotos: [] as string[],
  mapLink: '',
  schedule: [
    { time: '15:00', title: 'Торжественная регистрация', icon: '💍' },
    { time: '16:00', title: 'Фотосессия', icon: '📸' },
    { time: '17:00', title: 'Фуршет', icon: '🍾' },
    { time: '18:00', title: 'Банкет', icon: '🍽️' },
    { time: '22:00', title: 'Танцы', icon: '💃' },
  ],
};

/** weddingDate — по умолчанию своя дата-пример шаблона (templateSampleDate). */
export function demoInviteData(templateId: string, weddingDate?: string): InviteData {
  const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
  const tpl = template as typeof template & { sampleBride?: string; sampleGroom?: string };
  const date = weddingDate || templateSampleDate(template);
  /* Реальный контент шаблона (тексты, фото и расписание с НАСТОЯЩИМИ
     иконками-SVG) — из TEMPLATE_DEFAULTS, иначе превью показывало бы
     общий эмодзи-плейсхолдер вместо иконок дизайна. */
  const defs = TEMPLATE_DEFAULTS[template.id] || {};
  const venueAddress = defs.venueAddress ?? SAMPLE.venueAddress;
  return {
    ...SAMPLE,
    brideName: tpl.sampleBride || SAMPLE.brideName,
    groomName: tpl.sampleGroom || SAMPLE.groomName,
    templateId: template.id,
    weddingDate: date,
    coverPhoto: template.defaultCover,
    galleryPhotos: template.defaultGallery,
    inviteText:      defs.inviteText      ?? SAMPLE.inviteText,
    venue:           defs.venue           ?? SAMPLE.venue,
    venueAddress,
    story:           defs.story           ?? SAMPLE.story,
    schedule:        defs.schedule        ?? SAMPLE.schedule,
    dressCodeColors: defs.dressCodeColors ?? SAMPLE.dressCodeColors,
    dressCodePhoto:  defs.dressCodePhoto  ?? SAMPLE.dressCodePhoto,
    musicUrl:        templateMusic(template.id),
    customData: {
      ...templateCustomDefaults(template.id, date),
      mapPoint: demoMapPoint(venueAddress),
    },
  };
}
