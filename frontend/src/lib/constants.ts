/** Публичный адрес сайта (канонические URL, sitemap, OG). */
import { STUDIO_TEMPLATES } from './studioTemplates';
import { SKETCH_DEMO_DEFAULTS } from './sketch-demo-photos';

export const SITE_URL = 'https://weddingcraft.ru';

/* ── Реквизиты исполнителя для оферты и политики конфиденциальности ──────────
   Единственное место с реквизитами — страницы /oferta и /privacy читают отсюда.
   При смене статуса (самозанятый → ИП) обновить sellerStatus и добавить ОГРНИП. */
export const LEGAL = {
  sellerName: 'Егиазаров Вадим Каренович',
  /** Родительный падеж — для фразы «офертой Самого-То Такого-То». */
  sellerNameGenitive: 'Егиазарова Вадима Кареновича',
  sellerStatus: 'индивидуальный предприниматель',
  sellerStatusGenitive: 'индивидуального предпринимателя',
  sellerInn: '773422060977',
  /** ОГРНИП — 15 цифр из листа записи ЕГРИП. Пусто — строка не печатается. */
  sellerOgrnip: '325774600364831',
  /** Основание, почему в ценах нет НДС, напр. 'в связи с применением УСН'.
      Пусто — утверждение про НДС в оферте не печатается (лучше молчать, чем соврать). */
  vatNote: '',
  contactEmail: 'support@weddingcraft.ru',
  effectiveDate: '28 августа 2026 г.',
};

/** Дата свадьбы для превью и демо: всегда впереди на ~3 месяца,
    чтобы таймеры обратного отсчёта в шаблонах не показывали ноль. */
export function sampleWeddingDate(daysAhead = 90): string {
  return new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10);
}

/** Дата свадьбы в демо и карточке шаблона: у шаблона может быть своя
    (sampleDaysAhead в TEMPLATES), чтобы демо не показывали одну и ту же. */
export function templateSampleDate(tpl?: unknown): string {
  const days = (tpl as { sampleDaysAhead?: number } | undefined)?.sampleDaysAhead;
  return sampleWeddingDate(typeof days === 'number' ? days : 90);
}

/** Дедлайн ответа гостей по умолчанию: за 3 недели до свадьбы, формат ДД.ММ.ГГ.
    Никогда не отдаёт дату в прошлом — иначе шаблон просит ответить «до вчера». */
export function rsvpDeadline(weddingDate?: string): string {
  const wedding = weddingDate ? new Date(`${weddingDate}T00:00:00`) : null;
  const valid = wedding && !Number.isNaN(wedding.getTime()) ? wedding : null;
  const soon = new Date(Date.now() + 7 * 86400000);
  const planned = valid ? new Date(valid.getTime() - 21 * 86400000) : new Date(Date.now() + 21 * 86400000);
  const d = planned.getTime() < Date.now() ? soon : planned;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
}

/** Дефолты customData шаблона с подставленными токенами ({{rsvpDate}}) и напитками.
    Единая точка для редактора, демо-страниц и превью — чтобы даты не расходились. */
export function templateCustomDefaults(templateId: string, weddingDate?: string): Record<string, any> {
  const defs = TEMPLATE_DEFAULTS[templateId];
  const custom: Record<string, any> = { ...(defs?.custom || {}) };
  const deadline = rsvpDeadline(weddingDate);
  for (const key of Object.keys(custom)) {
    if (typeof custom[key] === 'string') custom[key] = custom[key].replace(/\{\{rsvpDate\}\}/g, deadline);
  }
  if (defs?.drinks) custom.drinks = defs.drinks;
  // «Пока не знаю» — новым сайтам сразу; у сайтов без этого ключа вариант выключен
  custom.rsvpMaybe = true;
  return custom;
}

/* Координаты адресов демо-данных для карты (venue-map.js). У пар их находит
   редактор, у демо и превью редактора нет — без них виджет Яндекса в маленьком
   окне только центрирует карту, без метки. */
const DEMO_MAP_POINTS: Record<string, { lat: number; lon: number }> = {
  'Москва, ул. Крымский Вал, 9': { lat: 55.73144, lon: 37.60342 },   // главный вход Парка Горького
  'г. Сочи, ул. Приморская, 15': { lat: 43.57367, lon: 39.72640 },
  'Москва, ул. Дольская, 1': { lat: 55.61548, lon: 37.68214 },       // усадьба Царицыно («Айвори»)
  'Москва, ул. Юности, 2': { lat: 55.73494, lon: 37.80898 },         // усадьба Кусково («Туманный лес»)
  'Московская обл., Красногорск, пос. Архангельское': { lat: 55.78858, lon: 37.28593 }, // усадьба Архангельское («Ангелы»)
  'Санкт-Петербург, Английская наб., 28': { lat: 59.93379, lon: 30.29436 },             // Дворец бракосочетания №1 («Нежность»)
  'Санкт-Петербург, наб. реки Мойки, 94': { lat: 59.92926, lon: 30.29848 },             // Юсуповский дворец («Витраж»)
};
export function demoMapPoint(address?: string): { q: string; lat: number; lon: number } | undefined {
  const p = address ? DEMO_MAP_POINTS[address] : undefined;
  return p && address ? { q: address, ...p } : undefined;
}

const HANDMADE_TEMPLATES = [
  {
    id: 'vitrage',
    name: 'Витраж',
    description: 'Голубой витраж, мягкий снег и хрустальные детали для зимней свадьбы.',
    tags: ['Витраж', 'Зима', 'Голубой', 'Хрусталь', 'Анимация'],
    colors: ['#f0f7ff', '#556f95', '#45513c'],
    preview: '/invite/vitrage/assets/preview.jpg',
    defaultCover: '/invite/vitrage/assets/couple.jpg',
    defaultGallery: [] as string[],
    sampleBride: 'Александра',
    sampleGroom: 'Григорий',
    sampleDaysAhead: 212,
  },
  {
    id: 'tenderness',
    name: 'Нежность',
    description: 'Бежевая акварель, золотая печать и винтажные детали для нежного праздника.',
    tags: ['Акварель', 'Бежевый', 'Нежный', 'Конверт', 'Анимация'],
    colors: ['#f4f0ed', '#6b4f2f', '#cfaa8e'],
    preview: '/invite/tenderness/assets/preview.jpg',
    defaultCover: '/invite/tenderness/assets/photo.jpg',
    defaultGallery: [] as string[],
    sampleBride: 'Надежда',
    sampleGroom: 'Евгений',
    sampleDaysAhead: 315,
  },
  {
    id: 'angels',
    name: 'Ангелы',
    description: 'Ангелы, облака и небесно-голубые оттенки для романтичной свадьбы.',
    tags: ['Ангелы', 'Облака', 'Голубой', 'Романтика', 'Анимация'],
    colors: ['#ddf3ff', '#526c9f', '#f2efdd'],
    preview: '/invite/angels/assets/preview.jpg',
    defaultCover: '/invite/angels/assets/hero.jpg',
    defaultGallery: [] as string[],
    sampleBride: 'Ангелина',
    sampleGroom: 'Алексей',
    sampleDaysAhead: 260,
  },
  {
    id: 'forest',
    name: 'Туманный лес',
    description: 'Туманный лес, природные оттенки и винтажные рамки для свадьбы среди зелени.',
    tags: ['Лес', 'Природа', 'Винтаж', 'Зелёный', 'Анимация'],
    colors: ['#f7f2ed', '#4a552d', '#a0a496'],
    preview: '/invite/forest/assets/preview.jpg?v=3',
    defaultCover: '/invite/forest/assets/album-1.jpg',
    defaultGallery: [] as string[],
    sampleBride: 'Мария',
    sampleGroom: 'Антон',
    sampleDaysAhead: 140,
  },
  {
    id: 'garden-evening',
    name: 'Вечер в саду',
    description: 'Акварельный сад, тёплые огни и конверт с сургучом для уютного вечера.',
    tags: ['Акварель', 'Сад', 'Гирлянды', 'Конверт', 'Нежный'],
    colors: ['#f7f0e0', '#c3881e', '#9a824f'],
    preview: '/invite/garden-evening/assets/preview.jpg',
    defaultCover: '/invite/garden-evening/assets/preview.jpg',
    defaultGallery: [] as string[],
    sampleBride: 'Ольга',
    sampleGroom: 'Даниил',
  },
  {
    id: 'ivory',
    name: 'Айвори',
    description: 'Фактурная бумага, пионы и чёрно-белые фото для сдержанной элегантности.',
    tags: ['Конверт', 'Чёрно-белый', 'Элегантный', 'Каллиграфия', 'Видео'],
    colors: ['#000000', '#c9c9c9', '#f4efe6'],
    preview: '/invite/ivory/assets/couple.jpg',
    defaultCover: '/invite/ivory/assets/couple.jpg',
    defaultGallery: [] as string[],
    sampleBride: 'Алиса',
    sampleGroom: 'Марк',
    sampleDaysAhead: 200,
  },
  {
    id: 'calla',
    name: 'Каллы',
    description: 'Акварельные каллы, жемчуг и тёплая бежевая палитра.',
    tags: ['Каллы', 'Жемчуг', 'Нежный', 'Акварель', 'Бежевый'],
    colors: ['#d7d3cb', '#7c6a54', '#8c967b'],
    preview: '/invite/calla/assets/couple-photo.jpg',
    defaultCover: '/invite/calla/assets/couple-photo.jpg',
    defaultGallery: [] as string[],
    sampleBride: 'Дарья',
    sampleGroom: 'Вадим',
  },
  {
    id: 'sketch',
    name: 'Скетч',
    description: 'Рисованные детали, полароиды и яркие акценты для весёлой свадьбы.',
    tags: ['Рисованный', 'Игривый', 'Полароид', 'Пастель', 'Дудл'],
    colors: ['#e85d86', '#a3b8e6', '#f4cf45'],
    preview: '/invite/sketch/assets/couple.lossless.webp',
    defaultCover: '/invite/sketch/assets/couple.lossless.webp',
    defaultGallery: [] as string[],
    sampleBride: 'Екатерина',
    sampleGroom: 'Артем',
  },
  {
    id: 'floral',
    name: 'Флоральный',
    description: 'Акварельные цветы и кружево в мягких природных оттенках.',
    tags: ['Цветы', 'Нежный', 'Бохо', 'Кружево', 'Романтика'],
    colors: ['#d5d0c8', '#a29b88', '#947f57'],
    preview: '/invite/floral/assets/photos/couple3.jpg',
    defaultCover: '/invite/floral/assets/photos/cover.jpg',
    defaultGallery: [] as string[],
    sampleBride: 'Оливия',
    sampleGroom: 'Себастьян',
  },
  {
    id: 'garden-arch',
    name: 'Цветущая арка',
    description: 'Цветущая арка и нежная зелень для свадьбы в саду.',
    tags: ['Цветы', 'Акварель', 'Арка', 'Нежный', 'Зелень'],
    colors: ['#b89a6a', '#8fa07c', '#c98ba0'],
    preview: '/invite/garden-arch/assets/decor/couple_bouquet.png',
    defaultCover: '/invite/garden-arch/assets/decor/couple_bouquet.png',
    defaultGallery: [] as string[],
    sampleBride: 'Маргарита',
    sampleGroom: 'Елис',
  },
  {
    id: 'mediterranean',
    name: 'Средиземноморье',
    description: 'Синие ставни, морской вид и акварельные ветви для свадьбы у моря.',
    tags: ['Минимализм', 'Море', 'Синий', 'Цветы'],
    colors: ['#114e88', '#354366', '#dbebff'],
    preview: '/invite/assets/window.jpg',
    defaultCover: '/invite/assets/window.jpg',
    defaultGallery: [] as string[],
  },
  {
    id: 'vadimdarya',
    name: 'Тёмная элегантность',
    description: 'Тёмный фон, золото и ваши фотографии для торжественного вечера.',
    tags: ['Тёмный', 'Элегантный', 'Золото', 'Таймер'],
    colors: ['#0d0b09', '#c9a84c', '#f8f3e8'],
    preview: '/invite/vadimdarya/images/couple.jpg',
    defaultCover: '/invite/vadimdarya/images/couple.jpg',
    defaultGallery: [] as string[],
    sampleBride: 'Анна',
    sampleGroom: 'Александр',
  }
];

/* Каталог = рукописные шаблоны + собранные в «Верстаке».
   Второй список генерируется студией при экспорте, руками его не правят.
   Одноимённый шаблон студии замещает рукописный: так открытый в студии
   оригинал остаётся одной карточкой, а не двоится. */
export const TEMPLATES = [
  ...HANDMADE_TEMPLATES.filter((t) => !STUDIO_TEMPLATES.some((s) => s.id === t.id)),
  ...STUDIO_TEMPLATES,
];

export const _TEMPLATES_LEGACY = [
  {
    id: 'classic',
    name: 'Classic Elegance (АРХИВ)',
    description: 'Элегантный классический стиль с золотыми акцентами и каллиграфным шрифтом',
    tags: ['Классика', 'Золото', 'Элегантность'],
    colors: ['#f5f0e8', '#c9a96e', '#2c2c2c'],
    preview: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=800&auto=format&fit=crop',
    defaultCover: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=2069&auto=format&fit=crop',
    defaultGallery: [
      'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1509927083803-4bd519298ac4?q=80&w=2070&auto=format&fit=crop'
    ],
  },
  {
    id: 'modern',
    name: 'Modern Minimal',
    description: 'Современный минимализм с чёрно-белой палитрой и крупной типографикой',
    tags: ['Минимализм', 'Современный', 'Монохром'],
    colors: ['#ffffff', '#111111', '#888888'],
    preview: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?q=80&w=800&auto=format&fit=crop',
    defaultCover: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?q=80&w=2070&auto=format&fit=crop',
    defaultGallery: [
      'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?q=80&w=2070&auto=format&fit=crop'
    ],
  },
  {
    id: 'bohemian',
    name: 'Bohemian Garden',
    description: 'Романтичный стиль с цветочными акцентами и тёплыми природными тонами',
    tags: ['Бохо', 'Цветы', 'Романтика'],
    colors: ['#fdf6ec', '#b5813d', '#6b8f5c'],
    preview: 'https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?q=80&w=800&auto=format&fit=crop',
    defaultCover: 'https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?q=80&w=2070&auto=format&fit=crop',
    defaultGallery: [
      'https://images.unsplash.com/photo-1520854221256-17451cc331bf?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1510076857177-7470076d4098?q=80&w=2072&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=2070&auto=format&fit=crop'
    ],
  },
  {
    id: 'luxury',
    name: 'Luxury Dark',
    description: 'Роскошный тёмный стиль с золотыми деталями и эффектом параллакса',
    tags: ['Люкс', 'Тёмный', 'Параллакс'],
    colors: ['#1a1a2e', '#c9a96e', '#e8e8e8'],
    preview: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?q=80&w=800&auto=format&fit=crop',
    defaultCover: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?q=80&w=2073&auto=format&fit=crop',
    defaultGallery: [
      'https://images.unsplash.com/photo-1530103043960-ef38714abb15?q=80&w=2069&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1478146896981-b80fe463b330?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1522057384400-681b4213fb5e?q=80&w=2069&auto=format&fit=crop'
    ],
  },
  {
    id: 'pastel',
    name: 'Pastel Dream',
    description: 'Нежный пастельный стиль с акварельными элементами и розовой гаммой',
    tags: ['Пастель', 'Нежный', 'Розовый'],
    colors: ['#fce4ec', '#f48fb1', '#ad1457'],
    preview: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=800&auto=format&fit=crop',
    defaultCover: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=2069&auto=format&fit=crop',
    defaultGallery: [
      'https://images.unsplash.com/photo-1456406644174-8ddd4cd52a06?q=80&w=2068&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1507504031003-b417219a0fde?q=80&w=2071&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?q=80&w=2050&auto=format&fit=crop'
    ],
  },
  {
    id: 'vintage',
    name: 'Vintage Rose',
    description: 'Винтажный романтичный стиль с пыльной розой, шалфеем и состаренными деталями',
    tags: ['Винтаж', 'Роза', 'Шалфей'],
    colors: ['#f7ede8', '#c4837a', '#6b8c7a'],
    preview: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=800&auto=format&fit=crop',
    defaultCover: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=2069&auto=format&fit=crop',
    defaultGallery: [
      'https://images.unsplash.com/photo-1520854221256-17451cc331bf?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1518049362265-d5b2a6467637?q=80&w=2074&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1470897655254-05feb2d2ab97?q=80&w=2070&auto=format&fit=crop'
    ],
  },
  {
    id: 'envelope',
    name: 'Конверт',
    description: 'Анимация открытия конверта с воском, летящие лепестки и элегантная кремовая палитра',
    tags: ['Конверт', 'Анимация', 'Классика'],
    colors: ['#faf6f1', '#c9a96e', '#2c2418'],
    preview: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=800&auto=format&fit=crop',
    defaultCover: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=2069&auto=format&fit=crop',
    defaultGallery: [
      'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1509927083803-4bd519298ac4?q=80&w=2070&auto=format&fit=crop',
    ],
  },
  {
    id: 'parchment',
    name: 'Пергамент',
    description: 'Классический стиль с текстурой пергамента, каллиграфией и мини-календарём',
    tags: ['Классика', 'Пергамент', 'Каллиграфия'],
    colors: ['#ede4d4', '#583434', '#1a1008'],
    preview: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?q=80&w=800&auto=format&fit=crop',
    defaultCover: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?q=80&w=2070&auto=format&fit=crop',
    defaultGallery: [
      'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1520854221256-17451cc331bf?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1530103043960-ef38714abb15?q=80&w=2069&auto=format&fit=crop',
    ],
  },
  {
    id: 'video',
    name: 'Animated Video',
    description: 'Премиум шаблон с фоновым видео, плавными анимациями и современным дизайном',
    tags: ['Видео', 'Анимация', 'Премиум'],
    colors: ['#2c2c2c', '#a0978f', '#f4f2ef'],
    preview: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=800&auto=format&fit=crop',
    defaultCover: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=2069&auto=format&fit=crop',
    defaultGallery: [
      'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1509927083803-4bd519298ac4?q=80&w=2070&auto=format&fit=crop',
    ],
  },
  {
    id: 'elegant',
    name: 'Elegant Romance',
    description: 'Изящный стиль с плавными анимациями, конфетти и минималистичной эстетикой',
    tags: ['Элегантность', 'Романтика', 'Минимализм'],
    colors: ['#faf8f5', '#d1bfae', '#3d3d3d'],
    preview: 'https://images.unsplash.com/photo-1522273400909-fd1a8f77637e?q=80&w=800&auto=format&fit=crop',
    defaultCover: 'https://images.unsplash.com/photo-1522273400909-fd1a8f77637e?q=80&w=2070&auto=format&fit=crop',
    defaultGallery: [
      'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=2069&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop',
    ],
  },
  {
    id: 'nautical',
    name: 'Nautical Romance',
    description: 'Морской стиль с синими полосками, якорями, ракушками, гирляндой флажков и анимированным таймером',
    tags: ['Море', 'Морской', 'Яхта'],
    colors: ['#e8eef3', '#3a5f7d', '#f5f0e8'],
    preview: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop',
    defaultCover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2070&auto=format&fit=crop',
    defaultGallery: [
      'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?q=80&w=2088&auto=format&fit=crop',
    ],
  },
];

export { PLANS, PLAN_TITLES, hasRsvp, hasResponseStats, hasNotifications, hasMusic, isAdvancedPlan, hasCustomDomain, hasPlanner } from './plans';

/** «гость» в нужной форме: 1 гость, 2 гостя, 5 гостей, 21 гость. */
export function guestsWord(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'гость';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'гостя';
  return 'гостей';
}

/** Варианты обращения к гостю (персональная ссылка). */
export const SALUTATIONS = [
  { value: 'дорогой', label: 'Дорогой (м)' },
  { value: 'дорогая', label: 'Дорогая (ж)' },
  { value: 'дорогие', label: 'Дорогие (неск.)' },
  { value: 'семья',   label: 'Семья' },
] as const;

/** Предпросмотр приветствия для кабинета (та же логика, что на бэкенде). */
export const previewGreeting = (salutation: string, names: string): string => {
  const n = (names || '').trim();
  if (salutation === 'семья') return n ? `Семья ${n}` : 'Семья';
  const cap = salutation ? salutation.charAt(0).toUpperCase() + salutation.slice(1) : 'Дорогие';
  return `${cap} ${n}`.trim();
};

/* ── Напитки: метки для статистики RSVP ──────────────────────────────────────
   Форма шаблона шлёт value ('sparkling'), а пара может переопределить список
   напитков в редакторе. Метку берём из своего списка (customData.drinks) с
   запасными значениями для стандартного набора. */
export const DEFAULT_DRINK_LABELS: Record<string, string> = {
  sparkling: 'Игристое',
  red: 'Красное вино',
  white: 'Белое вино',
  cognac: 'Коньяк',
  wine: 'Вино',
  champagne: 'Шампанское',
  juice: 'Сок',
  water: 'Вода',
  no_alcohol: 'Без алкоголя',
  other: 'Другое',
};

/** Карта value→label для приглашения: дефолты + свой список из customData. */
export const inviteDrinkLabels = (customData?: Record<string, any> | null): Record<string, string> => {
  const labels: Record<string, string> = { ...DEFAULT_DRINK_LABELS };
  const drinks = customData?.drinks;
  if (Array.isArray(drinks)) {
    for (const d of drinks) if (d && d.value) labels[String(d.value)] = String(d.label || d.value);
  }
  return labels;
};

/** "sparkling,red" → "Игристое, Красное вино" по карте меток. */
export const formatDrinkChoice = (choice: string, labels: Record<string, string>): string =>
  String(choice || '').split(',').map(s => s.trim()).filter(Boolean).map(v => labels[v] || v).join(', ');

/** Ключ data-edit строки-приветствия в каждом шаблоне (для персонализации гостя). */
export const TEMPLATE_GREETING_KEY: Record<string, string> = {
  vitrage: 'greetingTitle',
  tenderness: 'greetingTitle',
  angels: 'greetingTitle',
  forest: 'greetingTitle',
  'garden-evening': 'greetingTitle',
  ivory: 'greetingTitle',
  calla: 'greetingTitle',
  sketch: 'guestsTitle',
  floral: 'dearGuests',
  'garden-arch': 'dearGuests',
  mediterranean: 'greetingTitle',
};

/* ═══════════════════════════════════════════════════════════════════════════
   ДВИЖОК РЕДАКТИРОВАНИЯ ШАБЛОНОВ
   Схема полей описывает, какие панели/поля показывать в редакторе для каждого
   шаблона. Значение поля хранится либо в InviteData (scope: 'data', напр.
   inviteText, dressCodeColors, dressCodePhoto, schedule), либо в
   InviteData.customData[id] (scope: 'custom' — тексты/фото, специфичные для
   конкретного шаблона). id поля == data-edit ключ в статичном HTML шаблона.
   Дизайн не меняется — правится только текст, фото и цвета.
═══════════════════════════════════════════════════════════════════════════ */

export interface ScheduleItem { time: string; title: string; icon: string; desc?: string; }
export interface DrinkOption  { value: string; label: string; }

export type FieldType =
  | 'text' | 'textarea' | 'image' | 'audio' | 'colorList' | 'schedule' | 'drinks'
  | 'toggle'                  // галочка: значение true/false, по умолчанию включено (см. defaultOff)
  | 'choice'                  // выбор одного варианта из options (кружки-образцы цвета)
  | 'rsvpQuestions';          // список готовых вопросов анкеты (RSVP_QUESTIONS)

export interface ChoiceOption { value: string; label: string; color?: string; }

export interface TemplateField {
  id: string;                 // data-edit ключ + ключ хранения
  type: FieldType;
  label: string;
  hint?: string;
  removeBackground?: boolean; // бесплатное удаление фона у фото людей
  scope: 'data' | 'custom';   // где лежит значение
  iconSet?: string;           // для schedule — набор иконок-картинок (иначе ввод эмодзи)
  withDesc?: boolean;         // для schedule — показывать поле описания пункта
  noIcon?: boolean;           // для schedule — у пунктов нет иконок (не показывать ввод эмодзи)
  maxLength?: number;         // ограничение длины для text/textarea
  defaultOff?: boolean;       // для toggle — не задано значит выключено
  options?: ChoiceOption[];   // для choice — варианты; не задано = первый
}

/* Цвета сургучной печати 3D-конверта (../assets/envelope3d.js). value совпадают
   с WAXES движка (public/invite/assets/envelope3d/engine.js), color — образец
   в редакторе, близкий к тону воска на рендере. */
export const SEAL_COLORS: ChoiceOption[] = [
  { value: 'beige',    label: 'Бежевый', color: '#dbc7a3' },
  { value: 'ivory',    label: 'Айвори',  color: '#efe6d6' },
  { value: 'gold',     label: 'Золото',  color: '#d9b77c' },
  { value: 'burgundy', label: 'Бордо',   color: '#7a1f27' },
  { value: 'sage',     label: 'Шалфей',  color: '#a4b095' },
  { value: 'blue',     label: 'Голубой', color: '#9fb8d6' },
];

/* Цвета плашек обложки «Скетча»: цветные пятна за вырезанными фото и мазки-подписи.
   value — data-theme в public/invite/sketch/styles.css (.polaroids[data-theme]);
   образец в редакторе — два круга: пятно жениха и пятно невесты. */
export const PLAQUE_THEMES: ChoiceOption[] = [
  { value: 'bright', label: 'Яркая',          color: 'linear-gradient(135deg, #2f6bf0 50%, #ff5a4f 50%)' },
  { value: 'sunset', label: 'Закат',          color: 'linear-gradient(135deg, #ff8a3d 50%, #7b4fe0 50%)' },
  { value: 'mint',   label: 'Мята и лимон',   color: 'linear-gradient(135deg, #19c3a6 50%, #ffd23f 50%)' },
  { value: 'soft',   label: 'Нежная',         color: 'linear-gradient(135deg, #a3b8e6 50%, #f6b3c8 50%)' },
];

export interface TemplateSection {
  id?: string;               // стабильный ключ в enabledSections / data-wc-section
  required?: boolean;        // обложка, дата, место и завершение остаются всегда
  previewFields?: string[];  // точки прокрутки у разделов без редактируемых полей
  title: string;
  icon?: string;              // эмодзи в шапке панели
  fields: TemplateField[];
}

/* Наборы иконок для пикера в «Программе дня» */
export const ICON_SETS: Record<string, string[]> = {
  vitrage: [
    '/invite/vitrage/assets/ic-plate.webp',
    '/invite/vitrage/assets/ic-bottle.webp',
    '/invite/vitrage/assets/ic-cake.webp',
    '/invite/vitrage/assets/lantern.webp',
    '/invite/vitrage/assets/snowflake.webp',
    '/invite/vitrage/assets/cake.webp',
    '/invite/vitrage/assets/glasses.webp',
    '/invite/vitrage/assets/key.webp',
    '/invite/vitrage/assets/locks.webp',
    '/invite/vitrage/assets/bow.webp',
  ],
  tenderness: [
    '/invite/tenderness/assets/ic-cake.webp',
    '/invite/tenderness/assets/ic-champagne.webp',
    '/invite/tenderness/assets/ic-bouquet-s.webp',
    '/invite/tenderness/assets/ic-car.webp',
    '/invite/tenderness/assets/ic-ringbox.webp',
    '/invite/tenderness/assets/ic-rings.webp',
    '/invite/tenderness/assets/ic-arch.webp',
    '/invite/tenderness/assets/ic-dress.webp',
    '/invite/tenderness/assets/ic-tuxedo.webp',
    '/invite/tenderness/assets/ic-veil.webp',
    '/invite/tenderness/assets/ic-shoes.webp',
    '/invite/tenderness/assets/ic-pearls.webp',
    '/invite/tenderness/assets/ic-bottle.webp',
    '/invite/tenderness/assets/ic-letter.webp',
    '/invite/tenderness/assets/ic-dove.webp',
  ],
  angels: [
    '/invite/angels/assets/icon-rings.webp',
    '/invite/angels/assets/icon-champagne.webp',
    '/invite/angels/assets/icon-plate.webp',
    '/invite/angels/assets/icon-cake.webp',
    '/invite/angels/assets/icon-camera.webp',
    '/invite/angels/assets/bow.webp',
    '/invite/angels/assets/dove.webp',
    '/invite/angels/assets/cupid-bow.webp',
    '/invite/angels/assets/cherub-harp.webp',
  ],
  'garden-evening': [
    '/invite/garden-evening/assets/icon-champagne.webp',
    '/invite/garden-evening/assets/icon-rings.webp',
    '/invite/garden-evening/assets/icon-bouquet.webp',
    '/invite/garden-evening/assets/icon-candelabra.webp',
    '/invite/garden-evening/assets/icon-cake.webp',
    '/invite/garden-evening/assets/icon-lamp.webp',
    '/invite/garden-evening/assets/icon-signpost.webp',
    '/invite/garden-evening/assets/doves.webp',
    '/invite/garden-evening/assets/swans.webp',
  ],
  calla: [
    '/invite/calla/assets/couple-illustration.webp',
    '/invite/calla/assets/champagne.webp',
    '/invite/calla/assets/rings.webp',
    '/invite/calla/assets/bouquet.svg',
    '/invite/calla/assets/cake.webp',
    '/invite/calla/assets/car.webp',
    '/invite/calla/assets/doves.webp',
    '/invite/calla/assets/pearl-bead.png',
  ],
  sketch: [
    '/invite/sketch/assets/glasses-cheers.svg',
    '/invite/sketch/assets/rings.svg',
    '/invite/sketch/assets/polaroids-deco.svg',
    '/invite/sketch/assets/cake-slice.lossless.webp',
    '/invite/sketch/assets/disco-ball.svg',
    '/invite/sketch/assets/cake-tiered.svg',
    '/invite/sketch/assets/heart-pink.svg',
    '/invite/sketch/assets/heart-location.lossless.webp',
    '/invite/sketch/assets/car.svg',
    '/invite/sketch/assets/candle.svg',
    '/invite/sketch/assets/camera.lossless.webp',
  ],
  floral: [
    '/invite/floral/assets/icons/icon(6).svg',
    '/invite/floral/assets/icons/photo.svg',
    '/invite/floral/assets/icons/icon(5).svg',
    '/invite/floral/assets/icons/icon(8).svg',
    '/invite/floral/assets/icons/icon(7).svg',
    '/invite/floral/assets/icons/icon(2).svg',
    '/invite/floral/assets/icons/icon(4).svg',
    '/invite/floral/assets/icons/icon(13).svg',
    '/invite/floral/assets/icons/table.svg',
  ],
  'garden-arch': [
    '/invite/garden-arch/assets/icons/ic_bikes.png',
    '/invite/garden-arch/assets/icons/ic_rings.png',
    '/invite/garden-arch/assets/icons/ic_arch.png',
    '/invite/garden-arch/assets/icons/ic_cake.png',
  ],
  mediterranean: [
    '/invite/assets/icons/church.svg',
    '/invite/assets/icons/rings.svg',
    '/invite/assets/icons/plate.svg',
    '/invite/assets/icons/botles.svg',
    '/invite/assets/icons/globe.svg',
    '/invite/assets/icons/chair.svg',
    '/invite/assets/icons/gift.svg',
    '/invite/assets/icons/two-rings.svg',
    '/invite/assets/icons/anchor.svg',
    '/invite/assets/icons/heart.svg',
  ],
};

/* Встроенная галерея изображений (засеяна ассетами шаблонов).
   Позже можно заменить/дополнить своими фото. */
export const BUILTIN_GALLERY: string[] = [
  '/invite/floral/assets/photos/couple1.jpg',
  '/invite/floral/assets/photos/couple2.jpg',
  '/invite/floral/assets/photos/couple3.jpg',
  '/invite/floral/assets/photos/dress1.jpg',
  '/invite/floral/assets/photos/dress2.jpg',
  '/invite/floral/assets/photos/bouquet.jpg',
  '/invite/garden-arch/assets/photos/couple1.jpg',
  '/invite/garden-arch/assets/photos/couple2.jpg',
  '/invite/garden-arch/assets/photos/dress1.jpg',
  '/invite/garden-arch/assets/photos/dress2.jpg',
  '/invite/sketch/assets/photo-groom.webp',
  '/invite/sketch/assets/photo-bride.webp',
  '/invite/sketch/assets/couple.lossless.webp',
  '/invite/sketch/assets/dress1.lossless.webp',
  '/invite/sketch/assets/dress2.lossless.webp',
  '/invite/assets/couple-beach.jpg',
  '/invite/assets/wedding-1.jpg',
  '/invite/assets/wedding-2.jpg',
  '/invite/assets/wedding-3.jpg',
  '/invite/assets/wedding-4.jpg',
  '/invite/assets/dresscode-bride.jpg',
  '/invite/assets/dresscode-guest.jpg',
  '/invite/assets/dresscode-man1.jpg',
  '/invite/assets/dresscode-man2.jpg',
];

/* ─── Фоновая музыка: готовые мелодии ─────────────────────────────────
   Записи в общественном достоянии и CC0 с Wikimedia Commons, источники —
   public/invite/assets/music/SOURCES.txt. Путь /invite/… отдаёт фронтенд,
   так их понимают imageUrl() в скриптах шаблонов. */
export interface MusicTrack {
  id: string;
  title: string;
  author: string;
  kind: string;
  duration: string;
  url: string;
}

export const MUSIC_LIBRARY: MusicTrack[] = [
  { id: 'canon',    title: 'Канон ре мажор',          author: 'Пахельбель', kind: 'струнные',   duration: '3:00', url: '/invite/assets/music/canon-pachelbel.mp3' },
  { id: 'air',      title: 'Ария',                    author: 'Бах',        kind: 'струнные',   duration: '2:55', url: '/invite/assets/music/air-bach.mp3' },
  { id: 'clair',    title: 'Лунный свет',             author: 'Дебюсси',    kind: 'фортепиано', duration: '3:18', url: '/invite/assets/music/clair-de-lune-debussy.mp3' },
  { id: 'nocturne', title: 'Ноктюрн ми-бемоль мажор', author: 'Шопен',      kind: 'фортепиано', duration: '3:19', url: '/invite/assets/music/nocturne-chopin.mp3' },
  { id: 'wagner',   title: 'Свадебный хор',           author: 'Вагнер',     kind: 'оркестр',    duration: '1:44', url: '/invite/assets/music/bridal-chorus-wagner.mp3' },
];

/** Мелодии, доступные только в своём шаблоне: в общей библиотеке их нет,
    в редакторе они показываются лишь у этого шаблона. */
const TEMPLATE_ONLY_MUSIC: Record<string, MusicTrack[]> = {
  forest: [
    { id: 'thousand', title: 'A Thousand Years', author: 'Christina Perri', kind: 'песня', duration: '4:00', url: '/invite/assets/music/a-thousand-years-perri.mp3' },
  ],
};

/** Готовые мелодии для выбора в редакторе: своя мелодия шаблона + общая библиотека */
export function musicLibraryFor(templateId?: string): MusicTrack[] {
  return [...((templateId && TEMPLATE_ONLY_MUSIC[templateId]) || []), ...MUSIC_LIBRARY];
}

/** Мелодия, с которой шаблон открывается у новой пары (остальные — «Канон») */
const TEMPLATE_MUSIC: Record<string, string> = {
  vitrage: 'clair',
  tenderness: 'nocturne',
  angels: 'air',
  forest: 'thousand',
  'garden-evening': 'canon',
  ivory: 'clair',
  calla: 'nocturne',
  sketch: 'air',
  floral: 'air',
  'garden-arch': 'canon',
  mediterranean: 'clair',
  vadimdarya: 'nocturne',
};

export function templateMusic(templateId: string): string {
  const id = TEMPLATE_MUSIC[templateId] || 'canon';
  return (musicLibraryFor(templateId).find((t) => t.id === id) || MUSIC_LIBRARY[0]).url;
}

export function musicTrackByUrl(url: string | undefined): MusicTrack | undefined {
  return url ? [...Object.values(TEMPLATE_ONLY_MUSIC).flat(), ...MUSIC_LIBRARY].find((t) => t.url === url) : undefined;
}

/* Схема полей по шаблонам (имена/дата/время правятся в отдельном окне) */
/** Фоновая мелодия — секция одинаковая во всех шаблонах. */
const MUSIC_SECTION: TemplateSection = {
  title: 'Музыка', icon: '🎵',
  fields: [
    { id: 'musicUrl', type: 'audio', label: 'Фоновая мелодия', hint: 'Своя мелодия — MP3 до 15 МБ. Музыка включится, когда гость коснётся экрана, выключить её можно кнопкой в углу', scope: 'data' },
  ],
};

/** Карта места (Яндекс, public/invite/assets/venue-map.js) — строится по адресу;
    ссылка на место в Яндекс Картах ставит метку точно. Поля добавляются в
    секцию места каждого шаблона (то, чего там ещё нет). */
const MAP_ADDRESS: TemplateField = {
  id: 'venueAddress', type: 'text', label: 'Адрес', hint: 'Появится меткой на карте. Например: Москва, ул. Тверская, 7', scope: 'data', maxLength: 90,
};
const MAP_LINK: TemplateField = {
  id: 'mapLink', type: 'text', label: 'Ссылка на место в Яндекс Картах (необязательно)', hint: 'Метка на карте встанет точно на место', scope: 'data',
};

/** Готовые вопросы анкеты. Сами вопросы и варианты ответа гость видит такими,
    как их задаёт общий модуль public/invite/assets/rsvp-count.js (QUESTIONS) —
    id держать одинаковыми. Здесь — подписи для галочек в редакторе. */
export const RSVP_QUESTIONS: { id: string; label: string; hint: string }[] = [
  { id: 'ceremony', label: 'Регистрация', hint: 'Будет ли гость на регистрации или только на банкете' },
  { id: 'menu',     label: 'Горячее',     hint: 'Мясо, рыба или вегетарианское' },
  { id: 'allergy',  label: 'Аллергии',    hint: 'Ограничения в еде — свободный ответ' },
  { id: 'transfer', label: 'Трансфер',    hint: 'До площадки и обратно' },
  { id: 'stay',     label: 'Жильё',       hint: 'Нужна ли помощь с размещением' },
  { id: 'parking',  label: 'Парковка',    hint: 'Приедет ли гость на машине' },
  { id: 'song',     label: 'Песня',       hint: 'Под какую песню гость выйдет танцевать' },
  { id: 'seat',     label: 'Рассадка',    hint: 'С кем гость хотел бы сидеть рядом' },
  { id: 'toast',    label: 'Тост',        hint: 'Хочет ли гость сказать тост' },
  { id: 'wishes',   label: 'Пожелания',   hint: 'Тёплые слова молодожёнам' },
];

/** Что ещё спросить у гостей — одинаково во всех шаблонах, встаёт в их раздел
    анкеты (withRsvpFields). «Пока не знаю» новым сайтам включено в
    templateCustomDefaults, у уже опубликованных анкета не меняется сама. */
const RSVP_FIELDS: TemplateField[] = [
  { id: 'rsvpMaybe',     type: 'toggle', label: 'Вариант ответа «Пока не знаю»', scope: 'custom', defaultOff: true },
  { id: 'rsvpChildren',  type: 'toggle', label: 'Спрашивать отдельно про детей', scope: 'custom', defaultOff: true },
  { id: 'rsvpQuestions', type: 'rsvpQuestions', label: 'Дополнительные вопросы', scope: 'custom' },
  { id: 'rsvpCustomQ',   type: 'text', label: 'Свой вопрос', hint: 'Например: Нужна ли вам няня на вечер?', scope: 'custom', maxLength: 120 },
];

/** Поля анкеты — в раздел шаблона со списком напитков / текстом к анкете;
    если такого раздела нет, отдельный раздел перед «Музыкой». */
function withRsvpFields(sections: TemplateSection[]): TemplateSection[] {
  const isRsvp = (s: TemplateSection) => s.fields.some((f) => f.id === 'drinks' || f.id === 'surveyText');
  if (sections.some(isRsvp)) {
    return sections.map((s) => (isRsvp(s) ? { ...s, fields: [...s.fields, ...RSVP_FIELDS] } : s));
  }
  const at = sections.findIndex((s) => s.fields.some((f) => f.id === 'musicUrl'));
  const rsvp: TemplateSection = { title: 'Анкета гостя', icon: '📝', fields: RSVP_FIELDS };
  return at < 0 ? [...sections, rsvp] : [...sections.slice(0, at), rsvp, ...sections.slice(at)];
}

const HANDMADE_TEMPLATE_FIELDS: Record<string, TemplateSection[]> = {
  vitrage: [
    {
      // полей нет: инициалы на медальоне — из имён; раздел включает/выключает двери,
      // а превью при открытии раздела показывает, как они раздвинутся
      title: 'Витражные двери', icon: '🚪', fields: [],
    },
    {
      title: 'Обложка', icon: '🖼',
      fields: [
        { id: 'heroTitle', type: 'text',     label: 'Надпись над именами', hint: 'Например: Свадьба', scope: 'custom', maxLength: 30 },
        { id: 'heroText',  type: 'textarea', label: 'Текст под именами', scope: 'custom', maxLength: 90 },
      ],
    },
    {
      title: 'Приветствие', icon: '✍️',
      fields: [
        { id: 'greetingTitle', type: 'text',     label: 'Обращение', hint: 'Первое слово — рукописным шрифтом, остальное — строкой ниже. По персональной ссылке здесь будет обращение к гостю', scope: 'custom', maxLength: 40 },
        { id: 'inviteText',    type: 'textarea', label: 'Текст приглашения (абзацы с новой строки)', scope: 'data', maxLength: 300 },
      ],
    },
    {
      title: 'Место проведения', icon: '📍',
      fields: [
        { id: 'venue', type: 'text', label: 'Место проведения', hint: 'Например: Юсуповский дворец', scope: 'data', maxLength: 50 },
        MAP_ADDRESS, MAP_LINK,
      ],
    },
    {
      title: 'Фото места', icon: '🏛',
      fields: [
        { id: 'hallTitle', type: 'text',  label: 'Заголовок', hint: 'Например: Место проведения', scope: 'custom', maxLength: 30 },
        { id: 'hallPhoto', type: 'image', label: 'Фото зала', hint: 'Лучше горизонтальное: края рвутся, как бумага', scope: 'custom' },
      ],
    },
    {
      title: 'Наш вечер', icon: '✨',
      fields: [
        { id: 'menuTitle',  type: 'text', label: 'Заголовок', scope: 'custom', maxLength: 32 },
        { id: 'menuText',   type: 'textarea', label: 'Короткий текст к иллюстрациям', scope: 'custom', maxLength: 400 },
        { id: 'menu1Title', type: 'text', label: 'Подпись 1 (фонари)',  hint: 'Пусто — без подписи', scope: 'custom', maxLength: 24 },
        { id: 'menu2Title', type: 'text', label: 'Подпись 2 (снежинка)', scope: 'custom', maxLength: 24 },
        { id: 'menu3Title', type: 'text', label: 'Подпись 3 (торт)',    scope: 'custom', maxLength: 24 },
        { id: 'menu4Title', type: 'text', label: 'Подпись 4 (бокалы)',  scope: 'custom', maxLength: 24 },
      ],
    },
    {
      title: 'Программа дня', icon: '⏱',
      fields: [
        { id: 'schedule', type: 'schedule', label: 'Пункты программы', hint: 'Гости листают пункты, как карусель', scope: 'data', iconSet: 'vitrage' },
      ],
    },
    {
      title: 'Жених и невеста', icon: '💑',
      fields: [
        { id: 'groomPhoto', type: 'image',    label: 'Фото жениха', hint: 'Лучше горизонтальное', scope: 'custom' },
        { id: 'groomTitle', type: 'text',     label: 'Подпись под фото жениха', scope: 'custom', maxLength: 30 },
        { id: 'groomText',  type: 'textarea', label: 'О женихе', scope: 'custom', maxLength: 300 },
        { id: 'bridePhoto', type: 'image',    label: 'Фото невесты', hint: 'Лучше горизонтальное', scope: 'custom' },
        { id: 'brideTitle', type: 'text',     label: 'Подпись под фото невесты', scope: 'custom', maxLength: 30 },
        { id: 'brideText',  type: 'textarea', label: 'О невесте', scope: 'custom', maxLength: 300 },
      ],
    },
    {
      title: 'Дресс-код', icon: '👗',
      fields: [
        { id: 'dressStyle',      type: 'text',      label: 'Стиль', hint: 'Например: White Tie, Black Tie, Коктейль', scope: 'custom', maxLength: 30 },
        { id: 'dressText',       type: 'textarea',  label: 'Описание дресс-кода', scope: 'custom', maxLength: 160 },
        { id: 'dressCodeColors', type: 'colorList', label: 'Цвета палитры', scope: 'data' },
        { id: 'dressCodePhoto',  type: 'image',     label: 'Женщины: фото-пример 1', scope: 'data' },
        { id: 'dressPhoto2',     type: 'image',     label: 'Женщины: фото-пример 2', scope: 'custom' },
        { id: 'dressMan1',       type: 'image',     label: 'Мужчины: фото-пример 1', scope: 'custom' },
        { id: 'dressMan2',       type: 'image',     label: 'Мужчины: фото-пример 2', scope: 'custom' },
      ],
    },
    {
      title: 'Фото пары', icon: '📸',
      fields: [
        { id: 'coverPhoto', type: 'image', label: 'Фото пары', hint: 'Лучше горизонтальное: края рвутся, как бумага', scope: 'data' },
      ],
    },
    {
      title: 'Пожелания', icon: '💌',
      fields: [
        { id: 'wishTitle', type: 'text',     label: 'Заголовок', scope: 'custom', maxLength: 40 },
        { id: 'story',     type: 'textarea', label: 'Текст пожеланий (абзацы с новой строки)', scope: 'data', maxLength: 400 },
      ],
    },
    {
      title: 'Анкета гостя', icon: '📝',
      fields: [
        { id: 'surveyText', type: 'textarea', label: 'Текст-приглашение к анкете', scope: 'custom' },
        { id: 'drinks',     type: 'drinks',   label: 'Список напитков',            scope: 'custom' },
      ],
    },
    {
      title: 'Завершение', icon: '💍',
      fields: [
        { id: 'closingTitle', type: 'text', label: 'Финальная надпись', hint: 'Рукописным шрифтом', scope: 'custom', maxLength: 30 },
      ],
    },
    MUSIC_SECTION,
  ],

  tenderness: [
    {
      title: 'Конверт', icon: '✉️',
      fields: [
        { id: 'envelopeHint', type: 'text', label: 'Надпись над печатью', hint: 'Например: Нажмите, чтобы открыть', scope: 'custom', maxLength: 32 },
      ],
    },
    {
      title: 'Обложка', icon: '🖼',
      fields: [
        { id: 'heroTitle', type: 'text', label: 'Надпись над именами', hint: 'Например: Приглашение на свадьбу', scope: 'custom', maxLength: 40 },
      ],
    },
    {
      title: 'Приветствие', icon: '✍️',
      fields: [
        { id: 'greetingTitle', type: 'text',     label: 'Обращение', hint: 'По персональной ссылке здесь будет обращение к гостю', scope: 'custom', maxLength: 40 },
        { id: 'inviteText',    type: 'textarea', label: 'Текст приглашения (абзацы с новой строки)', scope: 'data', maxLength: 420 },
      ],
    },
    {
      title: 'Место проведения', icon: '📍',
      fields: [
        { id: 'venue', type: 'text', label: 'Место проведения', hint: 'Например: Дворец бракосочетания №1', scope: 'data', maxLength: 50 },
        MAP_ADDRESS, MAP_LINK,
      ],
    },
    {
      title: 'Фото в рамке', icon: '📸',
      fields: [
        { id: 'coverPhoto', type: 'image', label: 'Фото в овальной рамке', hint: 'Лучше вертикальное', scope: 'data' },
      ],
    },
    {
      title: 'Детали праздника', icon: '✨',
      fields: [
        { id: 'forecastQuote',  type: 'text', label: 'Девиз', scope: 'custom', maxLength: 70 },
        { id: 'forecast1Title', type: 'text', label: 'Сумочка: заголовок', scope: 'custom', maxLength: 24 },
        { id: 'forecast1Text',  type: 'text', label: 'Сумочка: подпись', hint: 'Пусто — без подписи', scope: 'custom', maxLength: 50 },
        { id: 'forecast2Title', type: 'text', label: 'Чашка: заголовок', scope: 'custom', maxLength: 24 },
        { id: 'forecast2Text',  type: 'text', label: 'Чашка: подпись', scope: 'custom', maxLength: 50 },
        { id: 'forecast3Title', type: 'text', label: 'Шкатулка: заголовок', scope: 'custom', maxLength: 24 },
        { id: 'forecast3Text',  type: 'text', label: 'Шкатулка: подпись', scope: 'custom', maxLength: 50 },
        { id: 'forecast4Title', type: 'text', label: 'Духи: заголовок', scope: 'custom', maxLength: 24 },
        { id: 'forecast4Text',  type: 'text', label: 'Духи: подпись', scope: 'custom', maxLength: 50 },
      ],
    },
    {
      title: 'Меню', icon: '🍽',
      fields: [
        { id: 'menuText', type: 'textarea', label: 'Текст о меню (абзацы с новой строки)', scope: 'custom', maxLength: 400 },
      ],
    },
    {
      title: 'Программа дня', icon: '⏱',
      fields: [
        { id: 'schedule', type: 'schedule', label: 'Пункты программы', scope: 'data', iconSet: 'tenderness' },
      ],
    },
    {
      title: 'Дресс-код', icon: '👗',
      fields: [
        { id: 'dressCodeColors', type: 'colorList', label: 'Женщины: цвета платьев', scope: 'data' },
        { id: 'dressCodePhoto',  type: 'image',     label: 'Женщины: фото-пример 1', scope: 'data' },
        { id: 'dressPhoto2',     type: 'image',     label: 'Женщины: фото-пример 2', scope: 'custom' },
        { id: 'menColors',       type: 'colorList', label: 'Мужчины: цвета рубашек', scope: 'custom' },
        { id: 'dressMan1',       type: 'image',     label: 'Мужчины: фото-пример 1', scope: 'custom' },
        { id: 'dressMan2',       type: 'image',     label: 'Мужчины: фото-пример 2', scope: 'custom' },
        { id: 'dressText',       type: 'textarea',  label: 'Описание дресс-кода', scope: 'custom', maxLength: 160 },
      ],
    },
    {
      title: 'Пожелания', icon: '💌',
      fields: [
        { id: 'story', type: 'textarea', label: 'Текст пожеланий (абзацы с новой строки)', scope: 'data', maxLength: 400 },
      ],
    },
    {
      title: 'Анкета гостя', icon: '📝',
      fields: [
        { id: 'surveyText', type: 'textarea', label: 'Текст-приглашение к анкете', scope: 'custom' },
        { id: 'drinks',     type: 'drinks',   label: 'Список напитков',            scope: 'custom' },
      ],
    },
    {
      title: 'Завершение', icon: '💍',
      fields: [
        { id: 'closingTitle', type: 'text', label: 'Финальный заголовок', scope: 'custom', maxLength: 40 },
        { id: 'closingSign',  type: 'text', label: 'Подпись', hint: 'Пусто — ваши имена', scope: 'custom', maxLength: 60 },
      ],
    },
    MUSIC_SECTION,
  ],

  angels: [
    {
      title: 'Конверт', icon: '✉️',
      fields: [
        { id: 'sealColor', type: 'choice', label: 'Цвет печати', hint: 'Буквы на печати — первые буквы ваших имён', scope: 'custom', options: SEAL_COLORS },
      ],
    },
    {
      title: 'Обложка', icon: '🖼',
      fields: [
        { id: 'coverPhoto', type: 'image', label: 'Фото на обложке', hint: 'Лучше вертикальное: снизу его закрывают облака с лентой', scope: 'data' },
      ],
    },
    {
      title: 'Приветствие', icon: '✍️',
      fields: [
        { id: 'greetingTitle', type: 'text',     label: 'Обращение', hint: 'По персональной ссылке здесь будет обращение к гостю', scope: 'custom', maxLength: 40 },
        { id: 'inviteText',    type: 'textarea', label: 'Текст на свитке (абзацы с новой строки)', scope: 'data', maxLength: 420 },
      ],
    },
    {
      title: 'Фото в полароиде', icon: '📷',
      fields: [
        { id: 'polaroidPhoto', type: 'image', label: 'Фото в портике', scope: 'custom' },
      ],
    },
    {
      title: 'Место проведения', icon: '📍',
      fields: [
        { id: 'venue', type: 'text', label: 'Место проведения', hint: 'Например: Усадьба «Архангельское»', scope: 'data', maxLength: 50 },
        MAP_ADDRESS, MAP_LINK,
        { id: 'dateIntro', type: 'text', label: 'Надпись над датой', hint: 'Например: Наша свадьба состоится', scope: 'custom', maxLength: 40 },
      ],
    },
    {
      title: 'Программа дня', icon: '⏱',
      fields: [
        { id: 'schedule', type: 'schedule', label: 'Пункты программы', scope: 'data', iconSet: 'angels' },
      ],
    },
    {
      title: 'Пожелания', icon: '💌',
      fields: [
        { id: 'story', type: 'textarea', label: 'Текст пожеланий (абзацы с новой строки)', scope: 'data', maxLength: 400 },
      ],
    },
    {
      title: 'Анкета гостя', icon: '📝',
      fields: [
        { id: 'surveyText', type: 'textarea', label: 'Текст-приглашение к анкете', scope: 'custom' },
        { id: 'drinks',     type: 'drinks',   label: 'Список напитков',            scope: 'custom' },
      ],
    },
    {
      title: 'Дресс-код', icon: '👗',
      fields: [
        { id: 'dressCodeColors', type: 'colorList', label: 'Цвета палитры', scope: 'data' },
        { id: 'dressText',       type: 'textarea',  label: 'Описание дресс-кода', scope: 'custom', maxLength: 160 },
        { id: 'dressCodePhoto',  type: 'image',     label: 'Образ для дам 1',     scope: 'data' },
        { id: 'dressPhoto2',     type: 'image',     label: 'Образ для дам 2',     scope: 'custom' },
        { id: 'dressMan1',       type: 'image',     label: 'Образ для джентльменов 1', scope: 'custom' },
        { id: 'dressMan2',       type: 'image',     label: 'Образ для джентльменов 2', scope: 'custom' },
      ],
    },
    {
      title: 'Завершение', icon: '💍',
      fields: [
        { id: 'closingTitle', type: 'text', label: 'Финальный заголовок', scope: 'custom', maxLength: 40 },
        { id: 'closingSign',  type: 'text', label: 'Подпись', hint: 'Пусто — ваши имена', scope: 'custom', maxLength: 60 },
      ],
    },
    MUSIC_SECTION,
  ],

  forest: [
    {
      title: 'Приветствие', icon: '✍️',
      fields: [
        { id: 'greetingTitle', type: 'text',     label: 'Обращение', hint: 'По персональной ссылке здесь будет обращение к гостю', scope: 'custom', maxLength: 40 },
        { id: 'inviteText',    type: 'textarea', label: 'Текст приглашения (абзацы с новой строки)', scope: 'data', maxLength: 420 },
      ],
    },
    {
      title: 'Фото в рамке', icon: '🖼',
      fields: [
        { id: 'coverPhoto',  type: 'image', label: 'Фото 1', hint: 'Фото в овальной рамке листаются стрелками. Лучше вертикальные', scope: 'data' },
        { id: 'albumPhoto2', type: 'image', label: 'Фото 2', scope: 'custom' },
        { id: 'albumPhoto3', type: 'image', label: 'Фото 3', scope: 'custom' },
      ],
    },
    {
      title: 'Место проведения', icon: '📍',
      fields: [
        { id: 'venue', type: 'text', label: 'Место проведения', hint: 'Например: Усадьба Кусково', scope: 'data', maxLength: 50 },
        MAP_ADDRESS, MAP_LINK,
      ],
    },
    {
      title: 'Программа дня', icon: '⏱',
      fields: [
        { id: 'schedule', type: 'schedule', label: 'Пункты программы', scope: 'data', noIcon: true },
      ],
    },
    {
      title: 'Дресс-код', icon: '👗',
      fields: [
        { id: 'dressCodeColors', type: 'colorList', label: 'Цвета палитры (мазки кистью)', scope: 'data' },
        { id: 'dressText',       type: 'textarea',  label: 'Описание дресс-кода', scope: 'custom', maxLength: 160 },
        { id: 'dressCodePhoto',  type: 'image',     label: 'Образ для дам 1',     scope: 'data' },
        { id: 'dressPhoto2',     type: 'image',     label: 'Образ для дам 2',     scope: 'custom' },
        { id: 'dressMan1',       type: 'image',     label: 'Образ для джентльменов 1', scope: 'custom' },
        { id: 'dressMan2',       type: 'image',     label: 'Образ для джентльменов 2', scope: 'custom' },
      ],
    },
    {
      title: 'Пожелания', icon: '💌',
      fields: [
        { id: 'story', type: 'textarea', label: 'Текст пожеланий (абзацы с новой строки)', scope: 'data', maxLength: 400 },
      ],
    },
    {
      title: 'Анкета гостя', icon: '📝',
      fields: [
        { id: 'surveyText', type: 'textarea', label: 'Текст-приглашение к анкете', scope: 'custom' },
        { id: 'drinks',     type: 'drinks',   label: 'Список напитков',            scope: 'custom' },
      ],
    },
    {
      title: 'Завершение', icon: '💍',
      fields: [
        { id: 'finalPhoto1',  type: 'image', label: 'Фото пары слева', scope: 'custom' },
        { id: 'finalPhoto2',  type: 'image', label: 'Фото пары в центре', scope: 'custom' },
        { id: 'finalPhoto3',  type: 'image', label: 'Фото пары справа', scope: 'custom' },
        { id: 'closingTitle', type: 'text', label: 'Финальный заголовок', scope: 'custom', maxLength: 40 },
        { id: 'closingSign',  type: 'text', label: 'Подпись', hint: 'Пусто — «Ваши …» из ваших имён', scope: 'custom', maxLength: 60 },
      ],
    },
    MUSIC_SECTION,
  ],

  'garden-evening': [
    {
      title: 'Обложка', icon: '🖼',
      fields: [
        { id: 'heroTitle', type: 'text', label: 'Надпись над именами', scope: 'custom', maxLength: 40 },
      ],
    },
    {
      title: 'Приветствие', icon: '✍️',
      fields: [
        { id: 'greetingTitle', type: 'text',     label: 'Обращение', hint: 'По персональной ссылке здесь будет обращение к гостю', scope: 'custom', maxLength: 40 },
        { id: 'inviteText',    type: 'textarea', label: 'Текст приглашения (абзацы с новой строки)', scope: 'data', maxLength: 420 },
      ],
    },
    {
      title: 'Место проведения', icon: '📍',
      fields: [
        { id: 'venue', type: 'text', label: 'Место проведения', hint: 'Например: Дворцовая усадьба', scope: 'data', maxLength: 50 },
        MAP_ADDRESS, MAP_LINK,
      ],
    },
    {
      title: 'Программа дня', icon: '⏱',
      fields: [
        { id: 'schedule', type: 'schedule', label: 'Пункты программы', scope: 'data', iconSet: 'garden-evening' },
      ],
    },
    {
      title: 'Дресс-код', icon: '👗',
      fields: [
        { id: 'dressCodeColors', type: 'colorList', label: 'Цвета палитры',       scope: 'data' },
        { id: 'dressText',       type: 'textarea',  label: 'Описание дресс-кода', scope: 'custom', maxLength: 160 },
        { id: 'dressCodePhoto',  type: 'image',     label: 'Образ для дам 1',     scope: 'data' },
        { id: 'dressPhoto2',     type: 'image',     label: 'Образ для дам 2',     scope: 'custom' },
        { id: 'dressMan1',       type: 'image',     label: 'Образ для джентльменов 1', scope: 'custom' },
        { id: 'dressMan2',       type: 'image',     label: 'Образ для джентльменов 2', scope: 'custom' },
      ],
    },
    {
      title: 'Пожелания и детали', icon: '💌',
      fields: [
        { id: 'story', type: 'textarea', label: 'Текст в свитке (абзацы с новой строки)', hint: 'Поместится в свиток', scope: 'data', maxLength: 380 },
      ],
    },
    {
      title: 'Анкета гостя', icon: '📝',
      fields: [
        { id: 'surveyText', type: 'textarea', label: 'Текст-приглашение к анкете', scope: 'custom' },
        { id: 'drinks',     type: 'drinks',   label: 'Список напитков',            scope: 'custom' },
      ],
    },
    {
      title: 'Завершение', icon: '💍',
      fields: [
        { id: 'closingTitle', type: 'text', label: 'Финальный заголовок', scope: 'custom', maxLength: 40 },
        { id: 'closingLove',  type: 'text', label: 'Надпись над подписью', scope: 'custom', maxLength: 30 },
        { id: 'closingSign',  type: 'text', label: 'Подпись', hint: 'Пусто — ваши имена', scope: 'custom', maxLength: 60 },
      ],
    },
    MUSIC_SECTION,
  ],

  ivory: [
    {
      title: 'Обложка', icon: '🖼',
      fields: [
        { id: 'coverPhoto', type: 'image', label: 'Фото на обложке', hint: 'Лучше вертикальное — в дизайне оно чёрно-белое', scope: 'data' },
        { id: 'heroTitle',  type: 'text',  label: 'Надпись над фото', scope: 'custom', maxLength: 40 },
      ],
    },
    {
      title: 'Приветствие', icon: '✍️',
      fields: [
        { id: 'greetingTitle', type: 'text',     label: 'Обращение', hint: 'По персональной ссылке здесь будет обращение к гостю', scope: 'custom', maxLength: 40 },
        { id: 'inviteText',    type: 'textarea', label: 'Текст приглашения', scope: 'data', maxLength: 220 },
      ],
    },
    {
      title: 'Место проведения', icon: '📍',
      fields: [
        { id: 'venueLabel', type: 'text', label: 'Надпись над местом', hint: 'Например: Ждем вас в', scope: 'custom', maxLength: 30 },
        { id: 'venue',      type: 'text', label: 'Место проведения', hint: 'Например: Белая роща — кавычки добавятся сами', scope: 'data', maxLength: 50 },
        MAP_ADDRESS, MAP_LINK,
        { id: 'venuePhoto', type: 'image', label: 'Фото места', scope: 'custom' },
      ],
    },
    {
      title: 'Программа дня', icon: '⏱',
      fields: [
        { id: 'schedule', type: 'schedule', label: 'Пункты программы', scope: 'data', withDesc: true, noIcon: true },
      ],
    },
    {
      title: 'Дресс-код', icon: '👗',
      fields: [
        { id: 'dressText',       type: 'textarea',  label: 'Описание дресс-кода', scope: 'custom', maxLength: 160 },
        { id: 'dressCodeColors', type: 'colorList', label: 'Цвета палитры',       scope: 'data' },
        { id: 'dressCodePhoto',  type: 'image',     label: 'Образ для дам 1',     scope: 'data' },
        { id: 'dressPhoto2',     type: 'image',     label: 'Образ для дам 2',     scope: 'custom' },
        { id: 'dressMan1',       type: 'image',     label: 'Образ для джентльменов 1', scope: 'custom' },
        { id: 'dressMan2',       type: 'image',     label: 'Образ для джентльменов 2', scope: 'custom' },
      ],
    },
    {
      title: 'Пожелания и детали', icon: '💌',
      fields: [
        { id: 'story', type: 'textarea', label: 'Текст в рамке (абзацы с новой строки)', scope: 'data', maxLength: 400 },
      ],
    },
    {
      title: 'Анкета гостя', icon: '📝',
      fields: [
        { id: 'surveyText', type: 'textarea', label: 'Текст-приглашение к анкете', scope: 'custom' },
        { id: 'drinks',     type: 'drinks',   label: 'Список напитков',            scope: 'custom' },
      ],
    },
    {
      title: 'Завершение', icon: '💍',
      fields: [
        { id: 'finalPhoto',   type: 'image', label: 'Фото в финале',       scope: 'custom' },
        { id: 'closingTitle', type: 'text',  label: 'Финальный заголовок', scope: 'custom', maxLength: 40 },
        { id: 'closingSign',  type: 'text',  label: 'Подпись (Ваши …)', hint: 'Пусто — подпись из ваших имён', scope: 'custom', maxLength: 60 },
      ],
    },
    MUSIC_SECTION,
  ],

  calla: [
    {
      title: 'Приветствие', icon: '✍️',
      fields: [
        { id: 'inviteText',    type: 'textarea',  label: 'Текст приглашения',          scope: 'data' },
      ],
    },
    {
      title: 'Место проведения', icon: '📍',
      fields: [
        { id: 'venue', type: 'text', label: 'Место проведения', hint: 'Например: Дворцовая усадьба 12', scope: 'data' },
        MAP_ADDRESS, MAP_LINK,
      ],
    },
    {
      title: 'Программа дня', icon: '⏱',
      fields: [
        { id: 'schedule', type: 'schedule', label: 'Пункты программы', scope: 'data', iconSet: 'calla' },
      ],
    },
    {
      title: 'Дресс-код', icon: '👗',
      fields: [
        { id: 'dressCodeColors', type: 'colorList', label: 'Цвета палитры', scope: 'data' },
        { id: 'dressCodePhoto',  type: 'image',     label: 'Женский образ 1', scope: 'data' },
        { id: 'dressPhoto2',     type: 'image',     label: 'Женский образ 2', scope: 'custom' },
        { id: 'dressPhoto3',     type: 'image',     label: 'Женский образ 3', scope: 'custom' },
        { id: 'dressMan1',       type: 'image',     label: 'Мужской образ 1', scope: 'custom' },
        { id: 'dressMan2',       type: 'image',     label: 'Мужской образ 2', scope: 'custom' },
        { id: 'dressMan3',       type: 'image',     label: 'Мужской образ 3', scope: 'custom' },
      ],
    },
    {
      title: 'Пожелания и детали', icon: '💌',
      fields: [
        { id: 'story', type: 'textarea', label: 'Текст в рамке', hint: 'Поместится в рамку', scope: 'data', maxLength: 240 },
      ],
    },
    {
      title: 'Анкета гостя', icon: '📝',
      fields: [
        { id: 'surveyText', type: 'textarea', label: 'Текст-приглашение к анкете', scope: 'custom' },
        { id: 'drinks',     type: 'drinks',   label: 'Список напитков',            scope: 'custom' },
      ],
    },
    {
      title: 'Завершение', icon: '💍',
      fields: [
        { id: 'closingTitle', type: 'text',  label: 'Финальный заголовок', scope: 'custom' },
        { id: 'closingSign',  type: 'text',  label: 'Подпись (Ваши …)',     scope: 'custom' },
        { id: 'finalPhoto',   type: 'image', label: 'Фото в полароиде',     scope: 'custom' },
      ],
    },
    MUSIC_SECTION,
  ],

  sketch: [
    {
      title: 'Фото на обложке', icon: '📸',
      fields: [
        { id: 'groomPhoto', type: 'image', label: 'Фото жениха',  scope: 'custom', removeBackground: true },
        { id: 'bridePhoto', type: 'image', label: 'Фото невесты', scope: 'custom', removeBackground: true },
        { id: 'groomCaption', type: 'text', label: 'Подпись под фото жениха',  scope: 'custom', maxLength: 24 },
        { id: 'brideCaption', type: 'text', label: 'Подпись под фото невесты', scope: 'custom', maxLength: 24 },
        { id: 'plaqueTheme', type: 'choice', label: 'Цвета плашек', hint: 'Цветные пятна за вырезанными фото и подписи', scope: 'custom', options: PLAQUE_THEMES },
      ],
    },
    {
      title: 'Приветствие', icon: '✍️',
      fields: [
        { id: 'inviteText',  type: 'textarea',  label: 'Текст приглашения',         scope: 'data' },
      ],
    },
    {
      title: 'Локация', icon: '📍',
      fields: [
        { id: 'locationText', type: 'textarea', label: 'Текст локации', hint: 'Например: Праздник пройдёт на базе отдыха «Барвиха»', scope: 'custom' },
        MAP_ADDRESS, MAP_LINK,
      ],
    },
    {
      title: 'Программа дня', icon: '⏱',
      fields: [
        { id: 'schedule', type: 'schedule', label: 'Пункты программы', scope: 'data', iconSet: 'sketch' },
      ],
    },
    {
      title: 'Дресс-код', icon: '👗',
      fields: [
        { id: 'dressText',       type: 'textarea',  label: 'Описание дресс-кода', scope: 'custom' },
        { id: 'dressCodeColors', type: 'colorList', label: 'Цвета палитры',       scope: 'data' },
        { id: 'dressCodePhoto',  type: 'image',     label: 'Женский образ 1',     scope: 'data' },
        { id: 'dressPhoto2',     type: 'image',     label: 'Женский образ 2',     scope: 'custom' },
        { id: 'dressMan1',       type: 'image',     label: 'Мужской образ 1',     scope: 'custom' },
        { id: 'dressMan2',       type: 'image',     label: 'Мужской образ 2',     scope: 'custom' },
      ],
    },
    {
      title: 'Анкета гостя', icon: '📝',
      fields: [
        { id: 'surveyText', type: 'textarea', label: 'Текст-приглашение к анкете', scope: 'custom' },
        { id: 'drinks',     type: 'drinks',   label: 'Список напитков',            scope: 'custom' },
      ],
    },
    {
      title: 'Пожелания', icon: '💌',
      fields: [
        { id: 'wishesText', type: 'textarea', label: 'Текст пожеланий', scope: 'custom' },
      ],
    },
    {
      title: 'Финальное фото', icon: '🖼',
      fields: [
        { id: 'finalPhoto', type: 'image', label: 'Фото в рамке (До новых встреч)', scope: 'custom' },
      ],
    },
    MUSIC_SECTION,
  ],

  floral: [
    {
      title: 'Обложка', icon: '🖼',
      fields: [
        { id: 'coverPhoto', type: 'image', label: 'Главное фото в арке', scope: 'data' },
      ],
    },
    {
      title: 'Приветствие', icon: '✍️',
      fields: [
        { id: 'inviteText', type: 'textarea', label: 'Текст приглашения',          scope: 'data' },
        { id: 'weAwait',    type: 'text',     label: 'Подпись над датой (Мы ждём вас)', scope: 'custom' },
      ],
    },
    {
      title: 'Локация', icon: '📍',
      fields: [
        { id: 'venue',        type: 'text',  label: 'Место проведения', hint: 'Например: Дворец бракосочетания 12/8', scope: 'data' },
        MAP_ADDRESS, MAP_LINK,
        { id: 'locationPhoto', type: 'image', label: 'Фото в рамке локации', scope: 'custom' },
      ],
    },
    {
      title: 'Расписание', icon: '⏱',
      fields: [
        { id: 'schedule', type: 'schedule', label: 'Пункты расписания', scope: 'data', iconSet: 'floral' },
      ],
    },
    {
      title: 'Дресс-код', icon: '👗',
      fields: [
        { id: 'dressCodeColors', type: 'colorList', label: 'Цвета палитры',   scope: 'data' },
        { id: 'dressCodePhoto',  type: 'image',     label: 'Женский образ 1', scope: 'data' },
        { id: 'dressPhoto2',     type: 'image',     label: 'Женский образ 2', scope: 'custom' },
        { id: 'dressMan1',       type: 'image',     label: 'Мужской образ 1', scope: 'custom' },
        { id: 'dressMan2',       type: 'image',     label: 'Мужской образ 2', scope: 'custom' },
      ],
    },
    {
      title: 'Пожелания и детали', icon: '💌',
      fields: [
        { id: 'story', type: 'textarea', label: 'Текст в рамке', hint: 'Поместится в рамку', scope: 'data', maxLength: 180 },
      ],
    },
    {
      title: 'Анкета гостя', icon: '📝',
      fields: [
        { id: 'surveyText', type: 'textarea', label: 'Текст-приглашение к анкете', scope: 'custom' },
        { id: 'drinks',     type: 'drinks',   label: 'Список напитков',            scope: 'custom' },
      ],
    },
    {
      title: 'Фото в рамке', icon: '📸',
      fields: [
        { id: 'polaroid1', type: 'image', label: 'Полароид 1', scope: 'custom' },
        { id: 'polaroid2', type: 'image', label: 'Полароид 2', scope: 'custom' },
      ],
    },
    {
      title: 'Завершение', icon: '💍',
      fields: [
        { id: 'closing', type: 'text', label: 'Финальная подпись', scope: 'custom' },
      ],
    },
    MUSIC_SECTION,
  ],

  'garden-arch': [
    {
      title: 'Приветствие', icon: '✍️',
      fields: [
        { id: 'inviteText', type: 'textarea', label: 'Текст приглашения',          scope: 'data' },
      ],
    },
    {
      title: 'Фото в рамке (приветствие)', icon: '📸',
      fields: [
        { id: 'polaroid1', type: 'image', label: 'Полароид 1', scope: 'custom' },
        { id: 'polaroid2', type: 'image', label: 'Полароид 2', scope: 'custom' },
      ],
    },
    {
      title: 'Место проведения', icon: '📍',
      fields: [
        { id: 'venue', type: 'text', label: 'Место проведения', hint: 'Например: Хвойный 17', scope: 'data' },
        MAP_ADDRESS, MAP_LINK,
      ],
    },
    {
      title: 'Программа дня', icon: '⏱',
      fields: [
        { id: 'schedule', type: 'schedule', label: 'Пункты программы', scope: 'data', iconSet: 'garden-arch' },
      ],
    },
    {
      title: 'Дресс-код', icon: '👗',
      fields: [
        { id: 'dressCodeColors', type: 'colorList', label: 'Цвета палитры',   scope: 'data' },
        { id: 'dressCodePhoto',  type: 'image',     label: 'Женский образ 1', scope: 'data' },
        { id: 'dressPhoto2',     type: 'image',     label: 'Женский образ 2', scope: 'custom' },
        { id: 'dressMan1',       type: 'image',     label: 'Мужской образ 1', scope: 'custom' },
        { id: 'dressMan2',       type: 'image',     label: 'Мужской образ 2', scope: 'custom' },
      ],
    },
    {
      title: 'Анкета гостя', icon: '📝',
      fields: [
        { id: 'surveyText', type: 'textarea', label: 'Текст-приглашение к анкете', scope: 'custom' },
        { id: 'drinks',     type: 'drinks',   label: 'Список напитков',            scope: 'custom' },
      ],
    },
    {
      title: 'Пожелания и детали', icon: '💌',
      fields: [
        { id: 'story', type: 'textarea', label: 'Текст в цветочной рамке', hint: 'Поместится в рамку', scope: 'data', maxLength: 260 },
      ],
    },
    {
      title: 'Завершение', icon: '💍',
      fields: [
        { id: 'closing', type: 'text', label: 'Финальная подпись', scope: 'custom' },
      ],
    },
    MUSIC_SECTION,
  ],

  mediterranean: [
    {
      title: 'Приветствие', icon: '✍️',
      fields: [
        { id: 'greetingSub',   type: 'text', label: 'Подзаголовок',                scope: 'custom' },
      ],
    },
    {
      title: 'Место проведения', icon: '📍',
      fields: [
        { id: 'venue',        type: 'text', label: 'Название места', hint: 'Например: СПА Отель',            scope: 'data' },
        { id: 'venueAddress', type: 'text', label: 'Адрес',          hint: 'Появится меткой на карте. Например: г. Сочи, ул. Приморская, 15', scope: 'data', maxLength: 90 },
        MAP_LINK,
      ],
    },
    {
      title: 'Программа дня', icon: '⏱',
      fields: [
        { id: 'schedule', type: 'schedule', label: 'Пункты (до 5)', scope: 'data', iconSet: 'mediterranean' },
      ],
    },
    {
      title: 'Дресс-код', icon: '👗',
      fields: [
        { id: 'dressCodePhoto', type: 'image', label: 'Женский образ 1', scope: 'data' },
        { id: 'dressPhoto2',    type: 'image', label: 'Женский образ 2', scope: 'custom' },
        { id: 'dressMan1',      type: 'image', label: 'Мужской образ 1', scope: 'custom' },
        { id: 'dressMan2',      type: 'image', label: 'Мужской образ 2', scope: 'custom' },
      ],
    },
    {
      title: 'Пожелания и детали', icon: '💌',
      fields: [
        { id: 'story', type: 'textarea', label: 'Текст (абзацы с новой строки)', scope: 'data' },
      ],
    },
    {
      title: 'Организатор', icon: '📞',
      fields: [
        { id: 'organizerText',  type: 'text', label: 'Подпись', scope: 'custom' },
        { id: 'organizerPhone', type: 'text', label: 'Телефон', scope: 'custom' },
      ],
    },
    {
      title: 'Анкета гостя', icon: '📝',
      fields: [
        { id: 'surveyText', type: 'textarea', label: 'Текст-приглашение к анкете', scope: 'custom' },
        { id: 'drinks',     type: 'drinks',   label: 'Список напитков',            scope: 'custom' },
      ],
    },
    {
      title: 'Фотоколлаж', icon: '📸',
      fields: [
        { id: 'photo1', type: 'image', label: 'Фото 1', scope: 'custom' },
        { id: 'photo2', type: 'image', label: 'Фото 2', scope: 'custom' },
        { id: 'photo3', type: 'image', label: 'Фото 3', scope: 'custom' },
        { id: 'photo4', type: 'image', label: 'Фото 4', scope: 'custom' },
      ],
    },
    {
      title: 'Завершение', icon: '💍',
      fields: [
        { id: 'closingTitle', type: 'text', label: 'Финальный заголовок', scope: 'custom' },
      ],
    },
    MUSIC_SECTION,
  ],

  vadimdarya: [
    {
      title: 'Обложка', icon: '🖼',
      fields: [
        { id: 'coverPhoto', type: 'image', label: 'Главное фото (hero)', scope: 'data' },
      ],
    },
    {
      title: 'Приветствие', icon: '✍️',
      fields: [
        { id: 'inviteText', type: 'textarea', label: 'Текст приглашения', scope: 'data' },
      ],
    },
    {
      title: 'Локация', icon: '📍',
      fields: [
        { id: 'venue',        type: 'text', label: 'Название места', hint: '«Артурс Спа Отель»', scope: 'data', maxLength: 50 },
        { id: 'venueAddress', type: 'text', label: 'Адрес',          hint: 'Появится меткой на карте', scope: 'data', maxLength: 90 },
        MAP_LINK,
      ],
    },
    {
      title: 'Программа дня', icon: '⏱',
      fields: [
        { id: 'schedule', type: 'schedule', label: 'Пункты программы', scope: 'data', withDesc: true },
      ],
    },
    {
      title: 'Дресс-код', icon: '👗',
      fields: [
        { id: 'dressCode',       type: 'text',      label: 'Подпись дресс-кода', scope: 'data' },
        { id: 'dressCodeColors', type: 'colorList', label: 'Цвета палитры (заменяют именованную)', scope: 'data' },
        { id: 'dressCodePhoto',  type: 'image',     label: 'Фото образа',        scope: 'data' },
      ],
    },
    {
      title: 'Пожелания и детали', icon: '💌',
      fields: [
        { id: 'story', type: 'textarea', label: 'Текст (абзацы с новой строки)', scope: 'data' },
      ],
    },
    MUSIC_SECTION,
  ],
};

/* Значения по умолчанию = текущее содержимое дизайна. Используются, чтобы
   при первом входе в редактор поля были заполнены реальным текстом/фото
   (визуально идентично оригиналу), и пользователю было что редактировать. */
export interface TemplateDefaults {
  inviteText?: string;
  venue?: string;
  venueAddress?: string;
  story?: string;
  schedule?: ScheduleItem[];
  dressCodeColors?: string[];
  dressCodePhoto?: string;
  drinks?: DrinkOption[];
  custom?: Record<string, any>;
}

/* Схема панели для шаблонов «Верстака» собирается студией из пометок на слоях.
   Общий раздел с музыкой добавляется здесь, чтобы он был у всех одинаковый. */
export const TEMPLATE_FIELDS: Record<string, TemplateSection[]> = Object.fromEntries(
  Object.entries({
    ...HANDMADE_TEMPLATE_FIELDS,
    ...Object.fromEntries(
      STUDIO_TEMPLATES.map((t) => [t.id, [...(t.fields ?? []), MUSIC_SECTION]]),
    ),
  }).map(([id, sections]) => [id, withSectionControls(id, withRsvpFields(sections))]),
);

/** Границы проверены в HTML каждого активного дизайна. Фото coverPhoto у
    «Леса» — отдельный альбом, а полароиды «Флорального» — часть финала. */
function withSectionControls(templateId: string, sections: TemplateSection[]): TemplateSection[] {
  if (!(templateId in HANDMADE_TEMPLATE_FIELDS)) return sections;
  const required = new Set(['cover', 'date', 'venue', 'closing']);
  const ids: Record<string, string> = {
    'Конверт': 'envelope', 'Обложка': 'cover', 'Фото на обложке': 'cover',
    'Приветствие': 'greeting', 'Фото в полароиде': 'photos',
    'Фото в рамке': templateId === 'floral' ? 'closing' : 'photos',
    'Фото в рамке (приветствие)': 'photos', 'Место проведения': 'venue', 'Локация': 'venue',
    'Программа дня': 'schedule', 'Расписание': 'schedule', 'Дресс-код': 'dresscode',
    'Пожелания': 'wishes', 'Пожелания и детали': 'wishes', 'Анкета гостя': 'rsvp',
    'Организатор': 'organizer', 'Завершение': 'closing', 'Финальное фото': 'closing',
    'Фотоколлаж': 'closing', 'Музыка': 'music',
    'Детали праздника': 'forecast', 'Наш вечер': 'menu', 'Меню': 'menu',
    'Фото места': 'hall', 'Жених и невеста': 'couple', 'Фото пары': 'photos', 'Витражные двери': 'envelope',
  };
  const result: TemplateSection[] = [];
  if (!sections.some(s => ids[s.title] === 'cover')) {
    result.push({ id: 'cover', required: true, title: 'Обложка', icon: '🖼', fields: [], previewFields: ['names', 'heroDate', 'groomName'] });
  }
  for (const section of sections) {
    const id = ids[section.title];
    result.push({ ...section, id, required: required.has(id), fields: section.fields.filter(f => f.id !== 'showMap' && f.id !== 'mapLink') });
    if (id === 'greeting') {
      result.push({ id: 'date', required: true, title: 'Дата', icon: '📅', fields: [], previewFields: ['calendar', 'heroDate', 'letterDate', 'dateLine', 'calMonth'] });
    }
    if (id === 'venue') {
      result.push({ id: 'map', title: 'Карта', icon: '🗺', fields: [MAP_LINK], previewFields: ['venueAddress'] });
    }
    if (id === 'schedule' && templateId !== 'sketch') {
      result.push({ id: 'countdown', title: 'Таймер', icon: '⏳', fields: [], previewFields: ['countdownTitle'] });
    }
  }
  if (!result.some(s => s.id === 'closing')) {
    const at = result.findIndex(s => s.id === 'music');
    result.splice(at < 0 ? result.length : at, 0, { id: 'closing', required: true, title: 'Завершение', icon: '💍', fields: [], previewFields: ['closingTitle', 'footerNames'] });
  }
  return result;
}

const HANDMADE_TEMPLATE_DEFAULTS: Record<string, TemplateDefaults> = {
  vitrage: {
    inviteText: 'Пусть за окном зима — этот день согреют любовь и ваши улыбки. Приходите на нашу свадьбу!',
    venue: 'Юсуповский дворец',
    venueAddress: 'Санкт-Петербург, наб. реки Мойки, 94',
    story:
      'Ваше присутствие — лучший подарок. Вместо букетов будем рады вкладу в наши семейные мечты.',
    schedule: [
      { time: '12:00', title: 'Фуршет', icon: '/invite/vitrage/assets/ic-plate.webp' },
      { time: '15:00', title: 'Банкет', icon: '/invite/vitrage/assets/ic-bottle.webp' },
      { time: '18:00', title: 'Торт', icon: '/invite/vitrage/assets/ic-cake.webp' },
    ],
    dressCodeColors: ['#ffffff', '#dbe8f6', '#b7cde6', '#8eaad0', '#556f95'],
    dressCodePhoto: '/invite/vitrage/assets/dress-w1.jpg',
    drinks: [
      { value: 'sparkling',  label: 'Шампанское' },
      { value: 'white',      label: 'Белое вино' },
      { value: 'red',        label: 'Красное вино' },
      { value: 'cognac',     label: 'Коньяк или виски' },
      { value: 'no_alcohol', label: 'Без алкоголя' },
    ],
    custom: {
      menuTitle: 'Наш вечер',
      heroTitle:     'Свадьба',
      heroText:      'Самый тёплый день этой зимы — вместе с вами',
      greetingTitle: 'Дорогие гости',
      venueTitle:    'Место встречи',
      hallTitle:     'Здесь будет праздник',
      hallPhoto:     '/invite/vitrage/assets/hall.jpg',
      menuText:      'За окном — зима. Внутри — тепло, угощения и любимые люди.',
      menu1Title: 'Тепло встреч', menu2Title: 'Зимняя сказка', menu3Title: 'Сладкий момент', menu4Title: 'За любовь!',
      groomPhoto:    '/invite/vitrage/assets/groom.jpg',
      groomTitle:    'Жених',
      groomText:     'Любит горы и хороший кофе. Рядом с ним спокойно и тепло.',
      bridePhoto:    '/invite/vitrage/assets/bride.jpg',
      brideTitle:    'Невеста',
      brideText:     'Влюблена в искусство, книги и зиму. Умеет превращать встречи в праздник.',
      dressStyle:    'Вечерний наряд',
      dressText:     'Выбирайте наряды в мягких голубых оттенках нашей палитры.',
      dressPhoto2:   '/invite/vitrage/assets/dress-w2.jpg',
      dressMan1:     '/invite/vitrage/assets/dress-m1.jpg',
      dressMan2:     '/invite/vitrage/assets/dress-m2.jpg',
      wishTitle:     'Пожелания',
      surveyText:    'Подтвердите участие и выберите напитки до {{rsvpDate}}.',
      closingTitle:  'Ждём встречи!',
    },
  },

  tenderness: {
    inviteText: 'Мы женимся! Приглашаем вас на день, полный нежности, улыбок и тёплых встреч.',
    venue: 'Дворец бракосочетания №1',
    venueAddress: 'Санкт-Петербург, Английская наб., 28',
    story:
      'Будем рады подарку в конверте — на мечты нашей семьи. Просим обойтись без букетов.',
    schedule: [
      { time: '12:00', title: 'Церемония', icon: '/invite/tenderness/assets/ic-ringbox.webp' },
      { time: '14:00', title: 'Фуршет', icon: '/invite/tenderness/assets/ic-champagne.webp' },
      { time: '15:00', title: 'Фотосессия', icon: '/invite/tenderness/assets/ic-bouquet-s.webp' },
      { time: '17:00', title: 'Банкет', icon: '/invite/tenderness/assets/ic-bottle.webp' },
      { time: '23:00', title: 'Завершение вечера', icon: '/invite/tenderness/assets/ic-car.webp' },
    ],
    dressCodeColors: ['#fcfcf8', '#fff8f3', '#e4c49c', '#ffe9e9', '#ffe4c7', '#b0887c'],
    dressCodePhoto: '/invite/tenderness/assets/dress-w1.jpg',
    drinks: [
      { value: 'red',        label: 'Красное вино' },
      { value: 'white',      label: 'Белое вино' },
      { value: 'sparkling',  label: 'Шампанское' },
      { value: 'cognac',     label: 'Виски или коньяк' },
      { value: 'vodka',      label: 'Водка' },
      { value: 'no_alcohol', label: 'Не буду пить алкоголь' },
    ],
    custom: {
      envelopeHint:   'Нажмите, чтобы открыть',
      heroTitle:      'Приглашение на свадьбу',
      greetingTitle:  'Дорогие гости',
      forecastQuote:  'Маленькие детали большого счастья',
      forecast1Title: 'С собой — улыбку',   forecast1Text: 'Остальное оставьте в сумочке',
      forecast2Title: 'Чашка тепла',     forecast2Text: 'За разговоры с теми, кто дорог',
      forecast3Title: 'Драгоценные моменты', forecast3Text: 'Главное сокровище — вы рядом',
      forecast4Title: 'Аромат счастья',       forecast4Text: 'Этот день останется с нами',
      menuText:
        'Сообщите об аллергиях и пожеланиях к еде в анкете — учтём их в меню.',
      menColors:      ['#957a5d', '#d2aa97', '#dbd3cc', '#f2e8d9', '#e3ccba', '#daaa7b'],
      dressMan1:      '/invite/tenderness/assets/dress-m1.jpg',
      dressMan2:      '/invite/tenderness/assets/dress-m2.jpg',
      dressPhoto2:    '/invite/tenderness/assets/dress-w2.jpg',
      dressText:      'Выбирайте оттенки нашей палитры. Просим избегать чисто белого и чёрного.',
      surveyText:     'Подтвердите участие и выберите напитки до {{rsvpDate}}.',
      rsvpChildren:   true,
      rsvpQuestions:  ['menu'],
      closingTitle:   'С любовью, ваши',
      closingSign:    '', // Пустое поле — имена пары.
    },
  },

  angels: {
    inviteText:
      'Скоро у нашей истории начнётся новая глава. Хотим разделить её первый день с вами!',
    venue: 'Усадьба «Архангельское»',
    venueAddress: 'Московская обл., Красногорск, пос. Архангельское',
    story:
      'Пусть подарком станет вклад в нашу семейную мечту. Букеты просим оставить в цветочных магазинах.',
    schedule: [
      { time: '12:00', title: 'Церемония', icon: '/invite/angels/assets/icon-rings.webp' },
      { time: '15:00', title: 'Фуршет', icon: '/invite/angels/assets/icon-champagne.webp' },
      { time: '18:00', title: 'Банкет', icon: '/invite/angels/assets/icon-plate.webp' },
      { time: '20:00', title: 'Торт', icon: '/invite/angels/assets/icon-cake.webp' },
      { time: '22:00', title: 'Фотосессия', icon: '/invite/angels/assets/icon-camera.webp' },
    ],
    dressCodeColors: ['#f4dec2', '#c2a07d', '#867c5e', '#d69a67'],
    dressCodePhoto: '/invite/angels/assets/dress-w1.jpg',
    drinks: [
      { value: 'sparkling',  label: 'Игристое' },
      { value: 'red',        label: 'Красное вино' },
      { value: 'white',      label: 'Белое вино' },
      { value: 'cognac',     label: 'Коньяк' },
      { value: 'no_alcohol', label: 'Без алкоголя' },
    ],
    custom: {
      sealColor:     'beige',
      greetingTitle: 'Дорогие гости!',
      polaroidPhoto: '/invite/angels/assets/polaroid.jpg',
      dressPhoto2:   '/invite/angels/assets/dress-w2.jpg',
      dressMan1:     '/invite/angels/assets/dress-m1.jpg',
      dressMan2:     '/invite/angels/assets/dress-m2.jpg',
      dateIntro:     'Наша свадьба состоится',
      dressText:     'Добавьте в ваш образ нежные оттенки нашей палитры.',
      surveyText:    'Подтвердите участие и выберите напитки до {{rsvpDate}}.',
      closingTitle:  'До встречи на свадьбе!',
      closingSign:   '', // Пустое поле — имена пары.
    },
  },

  forest: {
    inviteText:
      'Среди зелени и любимых людей мы скажем друг другу «да». Будем счастливы видеть вас рядом!',
    venue: 'Усадьба Кусково',
    venueAddress: 'Москва, ул. Юности, 2',
    story:
      'Приезжайте с добрыми пожеланиями, без букетов. Подарок в конверте поможет воплотить наши планы.',
    schedule: [
      { time: '15:00', title: 'Сбор гостей',      icon: '' },
      { time: '16:00', title: 'Церемония',        icon: '' },
      { time: '17:00', title: 'Фуршет',           icon: '' },
      { time: '21:00', title: 'Торт',             icon: '' },
      { time: '22:00', title: 'Танцы',            icon: '' },
      { time: '23:00', title: 'Окончание вечера', icon: '' },
    ],
    dressCodeColors: ['#738445', '#4a552d', '#b39c7e', '#925c2d', '#44200d'],
    dressCodePhoto: '/invite/forest/assets/dress-w1.jpg',
    drinks: [
      { value: 'sparkling',  label: 'Игристое' },
      { value: 'red',        label: 'Красное вино' },
      { value: 'white',      label: 'Белое вино' },
      { value: 'cognac',     label: 'Коньяк' },
      { value: 'no_alcohol', label: 'Без алкоголя' },
    ],
    custom: {
      greetingTitle: 'Дорогие гости',
      albumPhoto2:   '/invite/forest/assets/album-2.jpg',
      albumPhoto3:   '/invite/forest/assets/album-3.jpg',
      dressText:     'Природные оттенки нашей палитры помогут создать настроение праздника.',
      dressPhoto2:   '/invite/forest/assets/dress-w2.jpg',
      dressMan1:     '/invite/forest/assets/dress-m1.jpg',
      dressMan2:     '/invite/forest/assets/dress-m2.jpg',
      finalPhoto1:   '/invite/forest/assets/final-1.jpg',
      finalPhoto2:   '/invite/forest/assets/final-2.jpg',
      finalPhoto3:   '/invite/forest/assets/final-3.jpg',
      surveyText:    'Подтвердите участие и выберите напитки до {{rsvpDate}}.',
      closingTitle:  'Встретимся в нашем лесу!',
      closingSign:   '', // Пустое поле — «Ваши …» из имён пары.
    },
  },

  'garden-evening': {
    inviteText:
      'Огни в саду, музыка и близкие рядом. Приглашаем вас провести этот вечер на нашей свадьбе!',
    venue: 'Дворцовая усадьба',
    story:
      'Вместо цветов будем рады вкладу в наше свадебное путешествие. А главное — приезжайте сами!',
    schedule: [
      { time: '15:00', title: 'Сбор гостей', icon: '/invite/garden-evening/assets/icon-champagne.webp' },
      { time: '17:00', title: 'Церемония', icon: '/invite/garden-evening/assets/icon-rings.webp' },
      { time: '19:00', title: 'Банкет', icon: '/invite/garden-evening/assets/icon-bouquet.webp' },
      { time: '21:00', title: 'Танцы', icon: '/invite/garden-evening/assets/icon-candelabra.webp' },
      { time: '22:00', title: 'Торт', icon: '/invite/garden-evening/assets/icon-cake.webp' },
      { time: '23:00', title: 'Завершение вечера', icon: '/invite/garden-evening/assets/icon-lamp.webp' },
    ],
    dressCodeColors: ['#e09ba2', '#9a824f', '#af8162', '#c3881e'],
    dressCodePhoto: '/invite/garden-evening/assets/dress-w1.jpg',
    drinks: [
      { value: 'sparkling',  label: 'Игристое' },
      { value: 'red',        label: 'Красное вино' },
      { value: 'white',      label: 'Белое вино' },
      { value: 'cognac',     label: 'Коньяк' },
      { value: 'no_alcohol', label: 'Без алкоголя' },
    ],
    custom: {
      heroTitle:     'приглашение на свадьбу',
      greetingTitle: 'Дорогие друзья',
      dressText:     'Выберите для вашего образа один из оттенков нашей палитры.',
      dressPhoto2:   '/invite/garden-evening/assets/dress-w2.jpg',
      dressMan1:     '/invite/garden-evening/assets/dress-m1.jpg',
      dressMan2:     '/invite/garden-evening/assets/dress-m2.jpg',
      surveyText:    'Подтвердите участие и выберите напитки до {{rsvpDate}}.',
      closingTitle:  'До встречи в саду!',
      closingLove:   'С любовью!',
      closingSign:   '', // Пустое поле — имена пары.
    },
  },

  ivory: {
    inviteText:
      'Начинается наша семейная история. Приглашаем вас разделить этот день с нами.',
    venue: 'Белая роща',
    venueAddress: 'Москва, ул. Дольская, 1',
    story:
      'Подарок в конверте станет вкладом в нашу новую главу. Просим не дарить букеты.',
    schedule: [
      { time: '15:00', title: 'Сбор гостей', icon: '', desc: 'Знакомимся и наслаждаемся фуршетом' },
      { time: '16:00', title: 'Церемония', icon: '', desc: 'Скажем друг другу самое важное «да»' },
      { time: '17:00', title: 'Банкет', icon: '', desc: 'Ужин, тосты и танцы в кругу близких' },
    ],
    dressCodeColors: ['#f4efe6', '#e3d9c9', '#c8b8a2', '#9c8b78', '#8e8e8e', '#2b2b2b'],
    dressCodePhoto: '/invite/ivory/assets/dress-w1.jpg',
    drinks: [
      { value: 'sparkling',  label: 'Игристое' },
      { value: 'red',        label: 'Красное вино' },
      { value: 'white',      label: 'Белое вино' },
      { value: 'cognac',     label: 'Коньяк' },
      { value: 'no_alcohol', label: 'Без алкоголя' },
    ],
    custom: {
      heroTitle:     'Приглашение на свадьбу',
      greetingTitle: 'Дорогие гости!',
      venueLabel:    'Место встречи',
      venuePhoto:    '/invite/ivory/assets/venue.jpg',
      dressText:     'Поддержите спокойные оттенки нашей палитры.',
      dressPhoto2:   '/invite/ivory/assets/dress-w2.jpg',
      dressMan1:     '/invite/ivory/assets/dress-m1.jpg',
      dressMan2:     '/invite/ivory/assets/dress-m2.jpg',
      surveyText:    'Подтвердите участие и выберите напитки до {{rsvpDate}}.',
      closingTitle:  'До встречи в наш день!',
      closingSign:   '', // Пустое поле — подпись из имён пары.
      finalPhoto:    '/invite/ivory/assets/final.jpg',
    },
  },

  calla: {
    inviteText:
      'Мы скажем друг другу «да». И очень хотим, чтобы в этот момент вы были рядом.',
    venue: 'Дворцовая усадьба 12',
    story:
      'Ваши улыбки дороже цветов. Если захотите сделать подарок, будем рады вкладу в планы нашей семьи.',
    schedule: [
      { time: '12:00', title: 'Сбор гостей', icon: '/invite/calla/assets/couple-illustration.webp' },
      { time: '13:00', title: 'Фуршет', icon: '/invite/calla/assets/champagne.webp' },
      { time: '14:00', title: 'Церемония', icon: '/invite/calla/assets/rings.webp' },
      { time: '15:00', title: 'Поздравления', icon: '/invite/calla/assets/bouquet.svg' },
      { time: '16:00', title: 'Торт', icon: '/invite/calla/assets/cake.webp' },
      { time: '17:00', title: 'Завершение вечера', icon: '/invite/calla/assets/car.webp' },
    ],
    dressCodeColors: ['#d7bca4', '#e1d5c6', '#8c967b', '#7b9365', '#c9985e', '#eccb90', '#916743', '#bec9d0'],
    dressCodePhoto: '/invite/calla/assets/dress1.jpg',
    drinks: [
      { value: 'sparkling', label: 'Игристое' },
      { value: 'red',       label: 'Красное Вино' },
      { value: 'white',     label: 'Белое Вино' },
      { value: 'cognac',    label: 'Коньяк' },
    ],
    custom: {
      greetingTitle: 'Дорогие гости',
      surveyText:    'Подтвердите участие и выберите напитки до {{rsvpDate}}.',
      closingTitle:  'Ждём вас в наш день!',
      closingSign:   '', // Пустое поле — автоматическая подпись с именами пары.
      dressPhoto2:   '/invite/calla/assets/dress2.jpg',
      dressPhoto3:   '/invite/calla/assets/dress3.jpg',
      dressMan1:     '/invite/calla/assets/man1.jpg',
      dressMan2:     '/invite/calla/assets/man2.jpg',
      dressMan3:     '/invite/calla/assets/man3.jpg',
      finalPhoto:    '/invite/calla/assets/couple-photo.jpg',
    },
  },

  sketch: {
    inviteText:
      'Мы женимся! Будут объятия, тосты и танцы. Не хватает только вас.',
    schedule: [
      { time: '15:30', title: 'Сбор гостей', icon: '/invite/sketch/assets/glasses-cheers.svg' },
      { time: '16:00', title: 'Церемония', icon: '/invite/sketch/assets/rings.svg' },
      { time: '17:00', title: 'Фотосессия', icon: '/invite/sketch/assets/polaroids-deco.svg' },
      { time: '18:00', title: 'Банкет', icon: '/invite/sketch/assets/cake-slice.lossless.webp' },
      { time: '20:00', title: 'Танцы', icon: '/invite/sketch/assets/disco-ball.svg' },
    ],
    dressCodeColors: ['#c79bd6', '#ceb48a', '#ab311a', '#df5d84', '#f5eedf'],
    dressCodePhoto: '/invite/sketch/assets/dress1.lossless.webp',
    drinks: [
      { value: 'sparkling', label: 'Игристое' },
      { value: 'red',       label: 'Красное вино' },
      { value: 'white',     label: 'Белое вино' },
      { value: 'cognac',    label: 'Коньяк' },
    ],
    custom: {
      guestsTitle:  'Дорогие гости',
      locationText: 'Праздник пройдёт на базе отдыха «Барвиха»',
      dressText:    'Смело выбирайте оттенки нашей палитры — от нежных до ярких.',
      surveyText:   'Подтвердите участие и выберите напитки до {{rsvpDate}}.',
      wishesText:   'Приносите тёплые слова и хорошее настроение — остальное мы подготовим.',
      dressPhoto2:  '/invite/sketch/assets/dress2.lossless.webp',
      dressMan1:    '/invite/sketch/assets/man1.jpg',
      dressMan2:    '/invite/sketch/assets/man2.jpg',
      finalPhoto:   '/invite/sketch/assets/couple.lossless.webp',
      ...SKETCH_DEMO_DEFAULTS,
      groomCaption: 'Жених',
      brideCaption: 'Невеста',
    },
  },

  floral: {
    inviteText:
      'МЫ ЖЕНИМСЯ! ПРИХОДИТЕ РАЗДЕЛИТЬ С НАМИ РАДОСТЬ ЭТОГО ДНЯ.',
    venue: 'Дворец бракосочетания 12/8',
    story:
      'ВАШИ УЛЫБКИ — ЛУЧШЕ ЛЮБЫХ БУКЕТОВ. ПРОСИМ НЕ ДАРИТЬ ЦВЕТЫ.',
    schedule: [
      { time: '14:00', title: 'РЕГИСТРАЦИЯ', icon: '/invite/floral/assets/icons/icon(6).svg' },
      { time: '15:00', title: 'ФОТОСЕССИЯ',  icon: '/invite/floral/assets/icons/photo.svg' },
      { time: '17:00', title: 'ФУРШЕТ',      icon: '/invite/floral/assets/icons/icon(5).svg' },
      { time: '19:00', title: 'БАНКЕТ',      icon: '/invite/floral/assets/icons/table.svg' },
      { time: '22:00', title: 'ТАНЦЫ',       icon: '/invite/floral/assets/icons/icon(7).svg' },
    ],
    dressCodeColors: ['#e3c4bd', '#cabfd6', '#e8dcc0', '#b2a288'],
    dressCodePhoto: '/invite/floral/assets/photos/dress1.jpg',
    drinks: [
      { value: 'sparkling', label: 'Игристое' },
      { value: 'red',       label: 'Красное Вино' },
      { value: 'white',     label: 'Белое Вино' },
      { value: 'cognac',    label: 'Коньяк' },
    ],
    custom: {
      dearGuests: 'Дорогие гости',
      weAwait:    'Мы ждём вас',
      surveyText: 'Подтвердите участие и выберите напитки до {{rsvpDate}}.',
      closing:    'Будем рады видеть вас',
      dressPhoto2: '/invite/floral/assets/photos/dress2.jpg',
      dressMan1:   '/invite/floral/assets/photos/man1.jpg',
      dressMan2:   '/invite/floral/assets/photos/man2.jpg',
      polaroid1:   '/invite/floral/assets/photos/couple1.jpg',
      polaroid2:   '/invite/floral/assets/photos/bouquet.jpg',
      locationPhoto: '/invite/floral/assets/photos/couple2.jpg',
    },
  },

  'garden-arch': {
    inviteText:
      'Под цветущей аркой начнётся наша семейная история. Приглашаем вас стать частью этого дня!',
    venue: 'Хвойный 17',
    story:
      'Цветы уже украсят наш праздник. Вместо букета будем рады подарку в конверте на семейные планы.',
    schedule: [
      { time: '12:00', title: 'Встреча',   icon: '/invite/garden-arch/assets/icons/ic_bikes.png' },
      { time: '14:00', title: 'Церемония', icon: '/invite/garden-arch/assets/icons/ic_rings.png' },
      { time: '16:00', title: 'Банкет',    icon: '/invite/garden-arch/assets/icons/ic_arch.png' },
      { time: '18:00', title: 'Торт',      icon: '/invite/garden-arch/assets/icons/ic_cake.png' },
    ],
    dressCodeColors: ['#d6c0a0', '#e6dcc6', '#8e9c70', '#5d7242', '#cf9a57', '#e7c97e', '#97683c', '#bcd2dd'],
    dressCodePhoto: '/invite/garden-arch/assets/photos/dress1.jpg',
    drinks: [
      { value: 'sparkling', label: 'Игристое' },
      { value: 'red',       label: 'Красное Вино' },
      { value: 'white',     label: 'Белое Вино' },
      { value: 'cognac',    label: 'Коньяк' },
    ],
    custom: {
      dearGuests: 'Дорогие друзья',
      surveyText: 'Подтвердите участие и выберите напитки до {{rsvpDate}}.',
      closing:    'Ждём вас на нашей свадьбе!',
      dressPhoto2: '/invite/garden-arch/assets/photos/dress2.jpg',
      dressMan1:   '/invite/garden-arch/assets/photos/man1.jpg',
      dressMan2:   '/invite/garden-arch/assets/photos/man2.jpg',
      polaroid1:   '/invite/garden-arch/assets/photos/couple1.jpg',
      polaroid2:   '/invite/garden-arch/assets/photos/couple2.jpg',
    },
  },

  mediterranean: {
    venue: 'СПА Отель',
    venueAddress: 'г. Сочи, ул. Приморская, 15',
    story:
      'Пусть вместо букета будет вклад в наше свадебное путешествие. Спасибо, что разделите с нами этот день!',
    schedule: [
      { time: '11:00', title: 'Венчание', icon: '/invite/assets/icons/church.svg' },
      { time: '12:00', title: 'Церемония', icon: '/invite/assets/icons/rings.svg' },
      { time: '13:00', title: 'Свадебный обед', icon: '/invite/assets/icons/plate.svg' },
      { time: '14:00', title: 'Тосты за любовь', icon: '/invite/assets/icons/botles.svg' },
      { time: '18:00', title: 'Танцы', icon: '/invite/assets/icons/globe.svg' },
    ],
    dressCodePhoto: '/invite/assets/dresscode-bride.jpg',
    drinks: [
      { value: 'sparkling', label: 'Игристое' },
      { value: 'red',       label: 'Красное Вино' },
      { value: 'white',     label: 'Белое Вино' },
      { value: 'cognac',    label: 'Коньяк' },
    ],
    custom: {
      greetingTitle: 'Любимые друзья!',
      greetingSub:   'Море, любовь и вы рядом. Приглашаем на нашу свадьбу!',
      surveyText:    'Подтвердите участие и выберите напитки до {{rsvpDate}}.',
      closingTitle:  'До встречи у моря!',
      organizerText: 'По вопросам праздника — наш организатор',
      organizerPhone: '+7 922 222 22 22',
      dressPhoto2: '/invite/assets/dresscode-guest.jpg',
      dressMan1:   '/invite/assets/dresscode-man1.jpg',
      dressMan2:   '/invite/assets/dresscode-man2.jpg',
      photo1: '/invite/assets/wedding-1.jpg',
      photo2: '/invite/assets/wedding-3.jpg',
      photo3: '/invite/assets/wedding-2.jpg',
      photo4: '/invite/assets/wedding-4.jpg',
    },
  },

  vadimdarya: {
    inviteText:
      'Один особенный вечер, два счастливых сердца и самые близкие рядом. Приглашаем вас на нашу свадьбу.',
    story:
      'Будем рады вкладу в наши семейные планы. Просим не дарить букеты — ваше присутствие важнее.',
    schedule: [
      { time: '15:00', title: 'Сбор гостей', icon: '', desc: 'Знакомимся и наслаждаемся фуршетом' },
      { time: '16:00', title: 'Церемония', icon: '', desc: 'Встречаемся у арки, чтобы услышать наше «да»' },
      { time: '17:00', title: 'Банкет', icon: '', desc: 'Ужинаем, поднимаем бокалы и танцуем' },
      { time: '23:00', title: 'Завершение вечера', icon: '', desc: 'Обнимаемся и говорим друг другу до встречи' },
    ],
  },
};

/* Значения по умолчанию для шаблонов «Верстака»: то, что стоит в дизайне.
   Пара открывает кабинет и видит заполненные поля, а не пустые. */
export const TEMPLATE_DEFAULTS: Record<string, TemplateDefaults> = {
  ...HANDMADE_TEMPLATE_DEFAULTS,
  ...Object.fromEntries(STUDIO_TEMPLATES.map((t) => [t.id, t.defaults ?? {}])),
};
