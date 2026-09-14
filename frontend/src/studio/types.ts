/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — модель документа.

   Документ-JSON здесь единственный источник правды: инспектор рисуется из
   него, экспорт обходит его, отмена сравнивает его снимки. DOM на холсте —
   отражение документа, а не наоборот.

   Файл проекта лежит рядом с шаблоном: public/invite/<slug>/_studio.json
   ═══════════════════════════════════════════════════════════════════════════ */

export type Uid = string;

/** Версия формата документа. Растёт, когда меняется структура. */
export const DOC_VERSION = 1;

/* ─── карточка в галерее шаблонов ─────────────────────────────────────────── */

export interface CatalogCard {
  name: string;
  description: string;
  tags: string[];
  colors: string[];
  sampleBride: string;
  sampleGroom: string;
  /** путь к обложке; заполняется на экспорте (headless-скриншот) */
  cover: string;
}

/* ─── ресурсы ─────────────────────────────────────────────────────────────── */

export interface FontDef {
  /** имя переменной в CSS: --font-<key> */
  key: string;
  /** полный стек, как он попадёт в CSS */
  stack: string;
  source: 'google' | 'local';
  /** для google — часть строки запроса, напр. «Marck+Script» */
  googleSpec?: string;
  /**
   * Запасные семейства из того же стека. Если первый шрифт не гугловский
   * (своя лицензия, локальный файл), без них браузер уйдёт сразу в родовой
   * cursive — и надпись потеряет характер.
   */
  googleExtra?: string[];
  /** для local — имена файлов внутри assets/fonts/ */
  files?: string[];
}

export interface Asset {
  id: Uid;
  /** имя файла внутри assets/ */
  file: string;
  kind: 'image' | 'svg';
  w: number;
  h: number;
  bytes: number;
  thumb?: string;
}

/* ─── секции ──────────────────────────────────────────────────────────────── */

export type SectionHeight =
  /** высота = ширина холста × value */
  | { mode: 'ratio'; value: number }
  /** высота по содержимому */
  | { mode: 'auto' };

export interface Fill {
  color?: string;
  /** id ассета-подложки */
  image?: Uid;
  /** вертикальная подсветка поверх заливки: две остановки сверху вниз */
  overlay?: { from: string; to: string };
}

export interface Section {
  id: Uid;
  name: string;
  /** Адрес секции в разметке шаблона — только для режима правки. */
  selector?: string;
  height: SectionHeight;
  background: Fill;
  /**
   * Обрезать ли содержимое по краям секции. По умолчанию да, но в дизайне
   * бывает наоборот: рамка или узор нарочно шире холста и выходит за него.
   * Обрезав такое, мы сузили бы рамку, а текст внутри полез бы наружу.
   */
  clip?: boolean;
  layers: Layer[];
}

/* ─── слои ────────────────────────────────────────────────────────────────── */

/** Пометка «пара правит это в кабинете» → data-edit + поле схемы. */
export interface EditHook {
  key: string;
  type: 'text' | 'textarea' | 'image' | 'colorList' | 'schedule' | 'drinks';
  label: string;
  hint?: string;
  maxLength?: number;
  /** заголовок раздела в панели кабинета */
  panelSection: string;
  scope: 'data' | 'custom';
  iconSet?: string;
}

export interface Reveal {
  /** up — со смещением, soft — только прозрачность (для слоёв со своим transform) */
  kind: 'up' | 'soft';
  delay: number;
}

/** Переопределения геометрии на других брейкпоинтах. Задел: пока пустует. */
export type Overrides = Partial<
  Pick<LayerBase, 'x' | 'y' | 'w' | 'h' | 'rotation' | 'opacity' | 'hidden'>
>;

/**
 * Что экспорт делает с проектом.
 *
 * build — собрать шаблон целиком: студия пишет index.html, styles.css и
 * script.js. Годится для нового шаблона с нуля или из PDF.
 *
 * patch — править существующий: студия дописывает только разницу отдельным
 * файлом, а разметку, стили и скрипт шаблона не трогает вовсе. Иначе правка
 * одной надписи стоила бы шаблону программы дня, календаря и анкеты — их
 * студия не воспроизводит.
 */
export type ProjectMode = 'build' | 'patch';

/**
 * Значения элемента в оригинале. Экспорт в режиме правки сравнивает с ними и
 * выписывает только то, что действительно изменили.
 */
export interface LayerBaseline {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  opacity?: number;
  size?: number;
  lineHeight?: number;
  tracking?: number;
  color?: string;
  align?: string;
  content?: string;
}

export interface LayerBase {
  id: Uid;
  name: string;
  /** координаты в пикселях относительно ширины холста проекта */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
  /**
   * Высота задаётся содержимым, а не рамкой. Для текста это норма: рамка в
   * редакторе нужна для выделения, а в вёрстке высоту должна считать строка —
   * иначе текст обрежется, стоит паре ввести на пару слов больше.
   */
  autoHeight?: boolean;
  /**
   * Связка: слои с одним groupId выделяются, двигаются и удаляются вместе.
   * Это не вложенность — в документе и в разметке слой остаётся на своём
   * месте, поэтому связка ничего не меняет ни в экспорте, ни в единицах.
   */
  groupId?: string;
  reveal?: Reveal;
  at?: { mobile?: Overrides };

  /* ─── только для режима правки ─────────────────────────────────────────── */

  /** Адрес элемента в разметке шаблона, напр. `.canvas.farewell .title`. */
  selector?: string;
  /** Каким он был в оригинале — точка отсчёта для разницы. */
  baseline?: LayerBaseline;
  /**
   * Текст этого элемента подставляет script.js шаблона из данных пары.
   * Править его в студии бессмысленно: при открытии страницы он заменится.
   */
  boundText?: boolean;
}

export interface TextLayer extends LayerBase {
  kind: 'text';
  content: string;
  /** смысловой тег в разметке — порядок чтения важен для поиска и читалок */
  tag: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  font: string;
  size: number;
  lineHeight: number;
  tracking: number;
  align: 'left' | 'center' | 'right';
  color: string;
  shadow?: string;
  editable?: EditHook;
}

export interface ImageLayer extends LayerBase {
  kind: 'image';
  assetId: Uid | null;
  fit: 'cover' | 'contain' | 'fill';
  /** Точка кадрирования в долях рамки: куда смотреть, когда фото обрезается. */
  crop?: { x: number; y: number };
  radius: number;
  alt: string;
  /**
   * Перекрашивание вектора. SVG внутри <img> перекрасить нельзя, поэтому
   * такой слой выводится маской по цвету — приём из существующих шаблонов.
   */
  tint?: string;
  editable?: EditHook;
}

export interface ShapeLayer extends LayerBase {
  kind: 'shape';
  shape: 'rect' | 'ellipse';
  fill: string;
  stroke?: { color: string; width: number };
  radius: number;
}

/** Сложные блоки студия не рисует — рисует script.js шаблона. */
export type BlockKind =
  | 'schedule'
  | 'calendar'
  | 'dresscode'
  | 'countdown'
  | 'rsvp'
  | 'wishes';

export interface BlockLayer extends LayerBase {
  kind: 'block';
  block: BlockKind;
  params: Record<string, unknown>;
}

export interface GroupLayer extends LayerBase {
  kind: 'group';
  children: Layer[];
}

export type Layer = TextLayer | ImageLayer | ShapeLayer | BlockLayer | GroupLayer;

/* ─── проект ──────────────────────────────────────────────────────────────── */

export interface Project {
  version: number;
  id: Uid;
  /** Отсутствует у проектов, созданных до появления правщика: они всегда build. */
  mode?: ProjectMode;
  /** неизменяем после первого экспорта — от него зависят живые сайты пар */
  slug: string;
  /** width — эталонная ширина проектирования, maxWidth — потолок на широком экране */
  canvas: { width: number; maxWidth?: number };
  catalog: CatalogCard;
  fonts: FontDef[];
  assets: Asset[];
  sections: Section[];
  createdAt: string;
  updatedAt: string;
}

/* ─── помощники ───────────────────────────────────────────────────────────── */

export const uid = (): Uid =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** Ширины холста на выбор при создании. 430 — де-факто в текущих шаблонах. */
export const CANVAS_PRESETS = [375, 430, 680, 1200];

/** Потолок ширины на широком экране — как `--col` в существующих шаблонах. */
export const DEFAULT_MAX_WIDTH = 680;

export function emptySection(name = 'Новая секция'): Section {
  return {
    id: uid(),
    name,
    height: { mode: 'ratio', value: 1.6 },
    background: { color: '#ffffff' },
    layers: [],
  };
}

export function emptyProject(
  slug: string,
  name: string,
  width: number,
  mode: ProjectMode = 'build',
): Project {
  const now = new Date().toISOString();
  return {
    version: DOC_VERSION,
    id: uid(),
    mode,
    slug,
    canvas: { width, maxWidth: DEFAULT_MAX_WIDTH },
    catalog: {
      name,
      description: '',
      tags: [],
      colors: [],
      sampleBride: 'Невеста',
      sampleGroom: 'Жених',
      cover: '',
    },
    fonts: [],
    assets: [],
    sections: [emptySection('Обложка')],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Высота секции в пикселях холста — без округления: на неё опирается и
 * редактор, и экспорт, а округление до целого пикселя даёт расхождение
 * в полпикселя при растяжении макета на широкий экран.
 * Округлять нужно только там, где число показывают человеку.
 */
export function sectionHeightPx(section: Section, canvasWidth: number): number {
  if (section.height.mode === 'ratio') {
    return canvasWidth * section.height.value;
  }
  const bottom = section.layers.reduce(
    (max, l) => (l.hidden ? max : Math.max(max, l.y + l.h)),
    0,
  );
  return Math.max(120, bottom + 48);
}

/** Плоский список слоёв секции — пока без вложенности групп. */
export function findLayer(project: Project, layerId: string): Layer | null {
  for (const section of project.sections) {
    const found = section.layers.find((l) => l.id === layerId);
    if (found) return found;
  }
  return null;
}

export function sectionOfLayer(project: Project, layerId: string): Section | null {
  return project.sections.find((s) => s.layers.some((l) => l.id === layerId)) ?? null;
}

/** Слой по умолчанию — общая часть для всех видов. */
export function baseLayer(name: string, x: number, y: number, w: number, h: number): LayerBase {
  return {
    id: uid(),
    name,
    x, y, w, h,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
  };
}

export function newTextLayer(x: number, y: number, w: number, size: number): TextLayer {
  return {
    ...baseLayer('Текст', x, y, w, Math.round(size * 1.3)),
    kind: 'text',
    autoHeight: true,
    content: 'Новый текст',
    tag: 'p',
    font: 'var(--font-body, serif)',
    size,
    lineHeight: 1.3,
    tracking: 0,
    align: 'center',
    color: '#2b2b2b',
  };
}

export function newImageLayer(
  asset: Asset,
  x: number,
  y: number,
  w: number,
  h: number,
  name: string,
): ImageLayer {
  return {
    ...baseLayer(name, Math.round(x), Math.round(y), Math.round(w), Math.round(h)),
    kind: 'image',
    assetId: asset.id,
    fit: 'cover',
    radius: 0,
    alt: '',
  };
}

export function newShapeLayer(
  shape: 'rect' | 'ellipse',
  x: number,
  y: number,
  w: number,
  h: number,
): ShapeLayer {
  return {
    ...baseLayer(shape === 'rect' ? 'Прямоугольник' : 'Овал', x, y, w, h),
    kind: 'shape',
    shape,
    fill: '#c9c2b6',
    radius: 0,
  };
}
