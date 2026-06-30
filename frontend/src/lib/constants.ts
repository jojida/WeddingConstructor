export const TEMPLATES = [
  {
    id: 'calla',
    name: 'Каллы',
    description: 'Акварельные каллы, жемчуг и тёплая бежевая палитра. Календарь дня, серпантинная программа с жемчужиной на треке, дресс-код с каруселью образов, таймер и RSVP-анкета.',
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
    description: 'Рисованный игривый стиль: чернильные дудлы, полароиды, пастельное конфетти и серпантинный тайм-лайн дня. Дресс-код со свотчами, программа с иконками и RSVP-анкета.',
    tags: ['Рисованный', 'Игривый', 'Полароид', 'Пастель', 'Дудл'],
    colors: ['#e85d86', '#a3b8e6', '#f4cf45'],
    preview: '/invite/sketch/assets/couple.png',
    defaultCover: '/invite/sketch/assets/couple.png',
    defaultGallery: [] as string[],
    sampleBride: 'Екатерина',
    sampleGroom: 'Артем',
  },
  {
    id: 'floral',
    name: 'Флоральный',
    description: 'Акварельные цветы, кружевные рамки, тауп-палитра. Таймер, расписание, дресс-код со свотчами ткани и RSVP-анкета.',
    tags: ['Цветы', 'Нежный', 'Бохо', 'Кружево', 'Романтика'],
    colors: ['#d5d0c8', '#a29b88', '#947f57'],
    preview: '/invite/floral/assets/photos/couple1.jpg',
    defaultCover: '/invite/floral/assets/photos/couple1.jpg',
    defaultGallery: [] as string[],
    sampleBride: 'Olivia',
    sampleGroom: 'Sebastian',
  },
  {
    id: 'garden-arch',
    name: 'Цветущая арка',
    description: 'Акварельная цветущая арка из роз, нежная сине-зелёная палитра. Иллюстрированная пара, сердце с датой, серпантинная программа дня, дресс-код с палитрой, таймер и RSVP-анкета.',
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
    description: 'Синие ставни, вид на море, акварельные цветы и ветви. Видео-интро с открытием окна, анимация сердечка по треку расписания.',
    tags: ['Минимализм', 'Море', 'Синий', 'Цветы'],
    colors: ['#114e88', '#354366', '#dbebff'],
    preview: '/invite/assets/window.jpg',
    defaultCover: '/invite/assets/window.jpg',
    defaultGallery: [] as string[],
  },
  {
    id: 'vadimdarya',
    name: 'Тёмная элегантность',
    description: 'Тёмный фон, золотые акценты, hero с параллаксом, мини-календарь, программа дня, дресс-код с палитрой и коллажами, таймер обратного отсчёта и RSVP-анкета',
    tags: ['Тёмный', 'Элегантный', 'Золото', 'Таймер'],
    colors: ['#0d0b09', '#c9a84c', '#f8f3e8'],
    preview: '/invite/vadimdarya/images/couple.jpg',
    defaultCover: '/invite/vadimdarya/images/couple.jpg',
    defaultGallery: [] as string[],
    sampleBride: 'Анна',
    sampleGroom: 'Александр',
  }
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

export const PLANS = [
  {
    id: 'basic',
    name: 'Базовый',
    price: 990,
    period: '6 месяцев',
    features: ['Сайт-приглашение', 'Форма RSVP', 'Уведомления в Telegram или на Email', 'Ссылка на нашем домене'],
    color: '#6b8f5c',
  },
  {
    id: 'standard',
    name: 'Стандарт',
    price: 1990,
    period: '1 год',
    features: ['Всё из Базового', 'Личный кабинет гостей', 'Персональные ссылки с именным обращением', 'Сбор ответов по каждому гостю', 'Привязка своего домена'],
    color: '#c9a96e',
    popular: true,
  },
  {
    id: 'premium',
    name: 'Премиум',
    price: 3490,
    period: 'Бессрочно',
    features: ['Всё из Стандарта', 'Неограниченно гостей и фото', 'Музыкальный фон', 'Приоритетная поддержка'],
    color: '#9c27b0',
  },
];

/** Продвинутый тариф: личный кабинет гостей + персональные ссылки. */
export const isAdvancedPlan = (plan?: string | null): boolean =>
  plan === 'standard' || plan === 'premium';

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

/** Ключ data-edit строки-приветствия в каждом шаблоне (для персонализации гостя). */
export const TEMPLATE_GREETING_KEY: Record<string, string> = {
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
  | 'text' | 'textarea' | 'image' | 'colorList' | 'schedule' | 'drinks';

export interface TemplateField {
  id: string;                 // data-edit ключ + ключ хранения
  type: FieldType;
  label: string;
  hint?: string;
  scope: 'data' | 'custom';   // где лежит значение
  iconSet?: string;           // для schedule — набор иконок-картинок (иначе ввод эмодзи)
  withDesc?: boolean;         // для schedule — показывать поле описания пункта
  maxLength?: number;         // ограничение длины для text/textarea
}

export interface TemplateSection {
  title: string;
  icon?: string;              // эмодзи в шапке панели
  fields: TemplateField[];
}

/* Наборы иконок для пикера в «Программе дня» */
export const ICON_SETS: Record<string, string[]> = {
  calla: [
    '/invite/calla/assets/couple-illustration.svg',
    '/invite/calla/assets/champagne.svg',
    '/invite/calla/assets/rings.svg',
    '/invite/calla/assets/bouquet.svg',
    '/invite/calla/assets/cake.svg',
    '/invite/calla/assets/car.svg',
    '/invite/calla/assets/doves.svg',
    '/invite/calla/assets/pearl-bead.png',
  ],
  sketch: [
    '/invite/sketch/assets/glasses-cheers.svg',
    '/invite/sketch/assets/rings.svg',
    '/invite/sketch/assets/polaroids-deco.svg',
    '/invite/sketch/assets/cake-slice.png',
    '/invite/sketch/assets/disco-ball.svg',
    '/invite/sketch/assets/cake-tiered.svg',
    '/invite/sketch/assets/heart-pink.svg',
    '/invite/sketch/assets/heart-location.png',
    '/invite/sketch/assets/car.svg',
    '/invite/sketch/assets/candle.svg',
    '/invite/sketch/assets/camera.png',
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
  '/invite/sketch/assets/polaroid-groom.png',
  '/invite/sketch/assets/polaroid-bride.png',
  '/invite/sketch/assets/couple.png',
  '/invite/sketch/assets/dress1.png',
  '/invite/sketch/assets/dress2.png',
  '/invite/assets/couple-beach.jpg',
  '/invite/assets/wedding-1.jpg',
  '/invite/assets/wedding-2.jpg',
  '/invite/assets/wedding-3.jpg',
  '/invite/assets/wedding-4.jpg',
  '/invite/assets/dresscode-bride.jpg',
  '/invite/assets/dresscode-guest.jpg',
];

/* Схема полей по шаблонам (имена/дата/время правятся в отдельном окне) */
export const TEMPLATE_FIELDS: Record<string, TemplateSection[]> = {
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
        { id: 'dressCodePhoto',  type: 'image',     label: 'Образ 1 (карусель)', scope: 'data' },
        { id: 'dressPhoto2',     type: 'image',     label: 'Образ 2 (карусель)', scope: 'custom' },
        { id: 'dressPhoto3',     type: 'image',     label: 'Образ 3 (карусель)', scope: 'custom' },
      ],
    },
    {
      title: 'Пожелания и детали', icon: '💌',
      fields: [
        { id: 'story', type: 'textarea', label: 'Текст в рамке', hint: 'Поместится в рамку', scope: 'data', maxLength: 240 },
      ],
    },
    {
      title: 'Анкета гостя (RSVP)', icon: '📝',
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
  ],

  sketch: [
    {
      title: 'Фото на обложке', icon: '📸',
      fields: [
        { id: 'groomPhoto', type: 'image', label: 'Фото жениха',  scope: 'custom' },
        { id: 'bridePhoto', type: 'image', label: 'Фото невесты', scope: 'custom' },
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
        { id: 'dressCodePhoto',  type: 'image',     label: 'Фото образа 1',       scope: 'data' },
        { id: 'dressPhoto2',     type: 'image',     label: 'Фото образа 2',       scope: 'custom' },
      ],
    },
    {
      title: 'Анкета гостя (RSVP)', icon: '📝',
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
        { id: 'dressCodeColors', type: 'colorList', label: 'Цвета палитры', scope: 'data' },
        { id: 'dressCodePhoto',  type: 'image',     label: 'Фото образа 1',  scope: 'data' },
        { id: 'dressPhoto2',     type: 'image',     label: 'Фото образа 2',  scope: 'custom' },
      ],
    },
    {
      title: 'Пожелания и детали', icon: '💌',
      fields: [
        { id: 'story', type: 'textarea', label: 'Текст в рамке', hint: 'Поместится в рамку', scope: 'data', maxLength: 180 },
      ],
    },
    {
      title: 'Анкета гостя (RSVP)', icon: '📝',
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
        { id: 'dressCodeColors', type: 'colorList', label: 'Цвета палитры', scope: 'data' },
        { id: 'dressCodePhoto',  type: 'image',     label: 'Фото образа 1',  scope: 'data' },
        { id: 'dressPhoto2',     type: 'image',     label: 'Фото образа 2',  scope: 'custom' },
      ],
    },
    {
      title: 'Анкета гостя (RSVP)', icon: '📝',
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
        { id: 'venue', type: 'text', label: 'Название места', hint: 'Например: СПА Отель', scope: 'data' },
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
        { id: 'dressCodePhoto', type: 'image', label: 'Образ невесты', scope: 'data' },
        { id: 'dressPhoto2',    type: 'image', label: 'Образ гостей',  scope: 'custom' },
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
      title: 'Анкета гостя (RSVP)', icon: '📝',
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
        { id: 'venue',        type: 'text', label: 'Название места', hint: '«Артурс Спа Отель»', scope: 'data' },
        { id: 'venueAddress', type: 'text', label: 'Адрес',          scope: 'data' },
        { id: 'mapLink',      type: 'text', label: 'Ссылка на карту', scope: 'data' },
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
  ],
};

/* Значения по умолчанию = текущее содержимое дизайна. Используются, чтобы
   при первом входе в редактор поля были заполнены реальным текстом/фото
   (визуально идентично оригиналу), и пользователю было что редактировать. */
export interface TemplateDefaults {
  inviteText?: string;
  venue?: string;
  story?: string;
  schedule?: ScheduleItem[];
  dressCodeColors?: string[];
  dressCodePhoto?: string;
  drinks?: DrinkOption[];
  custom?: Record<string, any>;
}

export const TEMPLATE_DEFAULTS: Record<string, TemplateDefaults> = {
  calla: {
    inviteText:
      'Мы безмерно рады пригласить вас разделить с нами одно из самых значимых и счастливых ' +
      'событий в нашей жизни — торжество нашей любви',
    venue: 'Дворцовая усадьба 12',
    story:
      'Если вы хотите подарить нам ценный и нужный подарок, мы будем очень благодарны за вклад в бюджет нашей молодой семьи.\n' +
      'Просим не дарить букеты, так как мы не успеем насладиться ими в полной мере.',
    schedule: [
      { time: '12:00', title: 'Дворцовая усадьба 12', icon: '/invite/calla/assets/couple-illustration.svg' },
      { time: '13:00', title: 'Дворцовая усадьба 12', icon: '/invite/calla/assets/champagne.svg' },
      { time: '14:00', title: 'Дворцовая усадьба 12', icon: '/invite/calla/assets/rings.svg' },
      { time: '15:00', title: 'Дворцовая усадьба 12', icon: '/invite/calla/assets/bouquet.svg' },
      { time: '16:00', title: 'Дворцовая усадьба 12', icon: '/invite/calla/assets/cake.svg' },
      { time: '17:00', title: 'Дворцовая усадьба 12', icon: '/invite/calla/assets/car.svg' },
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
      surveyText:    'Чтобы мы знали сколько стульев и бокалов готовить, заполните анкету до 01.08.26',
      closingTitle:  'Будем ждать вас с нетерпением!',
      closingSign:   'Ваши Дарья и Вадим',
      dressPhoto2:   '/invite/calla/assets/dress2.jpg',
      dressPhoto3:   '/invite/calla/assets/dress3.jpg',
      finalPhoto:    '/invite/calla/assets/couple-photo.jpg',
    },
  },

  sketch: {
    inviteText:
      'Если вы читаете это приглашение — значит, вы часть нашей истории. ' +
      'Спасибо, что были с нами всё это время — рядом, мысленно, в воспоминаниях. ' +
      'Спасибо за тепло, за слова, за молчание, за просто быть.\n\n' +
      'Мы с радостью приглашаем вас стать частью нового воспоминания — нашей свадьбы.',
    schedule: [
      { time: '15:30', title: 'Сбор гостей', icon: '/invite/sketch/assets/glasses-cheers.svg' },
      { time: '16:00', title: 'Церемония',   icon: '/invite/sketch/assets/rings.svg' },
      { time: '17:00', title: 'Церемония',   icon: '/invite/sketch/assets/polaroids-deco.svg' },
      { time: '18:00', title: 'Банкет',      icon: '/invite/sketch/assets/cake-slice.png' },
      { time: '20:00', title: 'Дискотека',   icon: '/invite/sketch/assets/disco-ball.svg' },
    ],
    dressCodeColors: ['#c79bd6', '#ceb48a', '#ab311a', '#df5d84', '#f5eedf'],
    dressCodePhoto: '/invite/sketch/assets/dress1.png',
    drinks: [
      { value: 'sparkling', label: 'Игристое' },
      { value: 'red',       label: 'Красное вино' },
      { value: 'white',     label: 'Белое вино' },
      { value: 'cognac',    label: 'Коньяк' },
    ],
    custom: {
      guestsTitle:  'Дорогие гости',
      locationText: 'Праздник пройдёт на базе отдыха «Барвиха»',
      dressText:    'Одевайтесь в пастельных тонах, пожалуйста, избегайте ярких насыщенных цветов',
      surveyText:   'Чтобы мы знали, сколько стульев и бокалов готовить, заполните анкету до 01.08.26',
      wishesText:   'Будем рады вашим тёплым словам и пожеланиям — они для нас самый дорогой подарок',
      dressPhoto2:  '/invite/sketch/assets/dress2.png',
      finalPhoto:   '/invite/sketch/assets/couple.png',
      groomPhoto:   '/invite/sketch/assets/polaroid-groom.png',
      bridePhoto:   '/invite/sketch/assets/polaroid-bride.png',
    },
  },

  floral: {
    inviteText:
      'СПЕШИМ СООБЩИТЬ РАДОСТНУЮ НОВОСТЬ — МЫ ЖЕНИМСЯ! ' +
      'В ЭТОТ ДЕНЬ МЫ ХОТИМ, ЧТОБЫ ВЫ ПРИСУТСТВОВАЛИ НА НАШЕМ ПРАЗДНИКЕ',
    venue: 'Дворец бракосочетания 12/8',
    story:
      'ДОРОГИЕ ГОСТИ, ВАШ ВЕЧЕР\nБУДЕТ ОСОБЕННЫМ.\nНАША ПРОСЬБА — НЕ ДАРИТЬ\n' +
      'ЦВЕТЫ, МЫ НЕ УСПЕЕМ\nНАСЛАДИТЬСЯ ИХ КРАСОТОЙ',
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
      surveyText: 'Чтобы мы знали сколько стульев и бокалов готовить, заполните анкету до 01.08.26',
      closing:    'Будем рады видеть вас',
      dressPhoto2: '/invite/floral/assets/photos/dress2.jpg',
      polaroid1:   '/invite/floral/assets/photos/couple3.jpg',
      polaroid2:   '/invite/floral/assets/photos/bouquet.jpg',
      locationPhoto: '/invite/floral/assets/photos/couple2.jpg',
    },
  },

  'garden-arch': {
    inviteText:
      'Приглашаем вас разделить с нами это чудесное событие. Очень ждём вас на нашей свадьбе!',
    venue: 'Хвойный 17',
    story:
      'Если вы хотите подарить нам ценный и нужный подарок, мы будем очень благодарны за вклад в бюджет нашей молодой семьи. ' +
      'Просим не дарить букеты, так как мы не успеем насладиться ими в полной мере.',
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
      surveyText: 'Чтобы мы знали сколько стульев и бокалов готовить, заполните анкету до 01.08.26',
      closing:    'Ждём вас на нашей свадьбе!',
      dressPhoto2: '/invite/garden-arch/assets/photos/dress2.jpg',
      polaroid1:   '/invite/garden-arch/assets/photos/couple1.jpg',
      polaroid2:   '/invite/garden-arch/assets/photos/couple2.jpg',
    },
  },

  mediterranean: {
    venue: 'СПА Отель',
    story:
      'Если вы хотите подарить нам ценный и нужный подарок, мы будем очень благодарны за вклад в бюджет нашей молодой семьи.\n' +
      'Просим не дарить букеты, так как мы не успеем насладиться ими в полной мере.',
    schedule: [
      { time: '11:00', title: 'Ceremony at the church', icon: '/invite/assets/icons/church.svg' },
      { time: '12:00', title: 'Say yes, I do!',         icon: '/invite/assets/icons/rings.svg' },
      { time: '13:00', title: 'Wedding lunch',          icon: '/invite/assets/icons/plate.svg' },
      { time: '14:00', title: 'Cheer for the couple',   icon: '/invite/assets/icons/botles.svg' },
      { time: '18:00', title: 'Evening party',          icon: '/invite/assets/icons/globe.svg' },
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
      greetingSub:   'приглашаем вас на нашу свадьбу',
      surveyText:    'Чтобы мы знали сколько стульев и бокалов готовить, заполните анкету до 01.08.26',
      closingTitle:  'Ждем вас на нашей\nсвадьбе!',
      organizerText: 'По всем вопросам обращайтесь к нашему организатору',
      organizerPhone: '+7 922 222 22 22',
      dressPhoto2: '/invite/assets/dresscode-guest.jpg',
      photo1: '/invite/assets/wedding-1.jpg',
      photo2: '/invite/assets/wedding-3.jpg',
      photo3: '/invite/assets/wedding-2.jpg',
      photo4: '/invite/assets/wedding-4.jpg',
    },
  },

  vadimdarya: {
    inviteText:
      'Мы безмерно рады пригласить вас разделить с нами одно из самых значимых и счастливых ' +
      'событий в нашей жизни — торжество нашей любви.',
    story:
      'Если вы хотите подарить нам ценный и нужный подарок, мы будем очень благодарны за вклад в бюджет нашей молодой семьи.\n' +
      'Просим не дарить букеты, так как мы не успеем насладиться ими в полной мере.',
    schedule: [
      { time: '15:00', title: 'Welcome',           icon: '', desc: 'Ведущий знакомится и общается с гостями, помогает сориентироваться на площадке.' },
      { time: '16:00', title: 'Церемония',          icon: '', desc: 'Собираемся у арки, гости располагаются на стулья.' },
      { time: '17:00', title: 'Начало банкета',     icon: '', desc: 'Вступительное слово ведущего, приветствие и анонс вечера, поднимаем бокалы за молодожёнов.' },
      { time: '23:00', title: 'Завершение вечера',  icon: '', desc: 'Яркий финал праздника, тёплые слова и прощание с гостями.' },
    ],
  },
};
