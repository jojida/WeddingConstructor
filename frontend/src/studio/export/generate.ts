/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — генератор шаблона.

   Документ → index.html + styles.css. Пиксели, в которых удобно работать в
   редакторе, здесь делятся на ширину холста и становятся контейнерными
   единицами: макет, собранный один раз, пропорционально садится на любой экран.

   Этот же модуль питает холст редактора: правила слоёв там ровно те, что уйдут
   в файл, — поэтому «холст = результат» не декларация, а одна общая функция.

   Вывод обязан быть читаемым — его будут править руками.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  Project,
  Layer,
  TextLayer,
  ImageLayer,
  ShapeLayer,
  BlockLayer,
  Fill,
  DEFAULT_MAX_WIDTH,
  sectionHeightPx,
} from '../types';
import { uniqueSlug } from '../slug';

export interface GeneratedFiles {
  html: string;
  css: string;
  script: string;
}

/** Имена классов, выданные секциям и слоям. Нужны и разметке, и редактору. */
export interface Naming {
  sections: Map<string, string>;
  layers: Map<string, string>;
}

export type AssetUrl = (id: string) => string | null;

export interface CssOptions {
  /** Префикс перед каждым селектором — редактор ограничивает правила холстом. */
  scope?: string;
  /** Откуда брать файлы: в шаблоне «assets/», в редакторе абсолютный путь. */
  assetBase?: string;
}

/* ─── единицы ─────────────────────────────────────────────────────────────── */

const num = (value: number, digits = 4): string =>
  String(Number(value.toFixed(digits)));

/**
 * Пиксели эталонной ширины → контейнерные единицы.
 * Пять знаков: на четырёх остаточная ошибка округления доходила до 0.02px
 * при растяжении макета с 430 до 680.
 */
const cq = (px: number, canvasWidth: number): string =>
  `${num((px / canvasWidth) * 100, 5)}cqw`;

/* ─── мелочи ──────────────────────────────────────────────────────────────── */

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escAttr = (s: string): string => esc(s).replace(/"/g, '&quot;');

const hasDigits = (s: string): boolean => /\d/.test(s);

/* ─── имена ───────────────────────────────────────────────────────────────── */

export function nameThings(project: Project): Naming {
  const naming: Naming = { sections: new Map(), layers: new Map() };
  const takenSection = new Set<string>();

  project.sections.forEach((section, index) => {
    const base = uniqueSlug(section.name, takenSection, `section-${index + 1}`);
    naming.sections.set(section.id, `s-${base}`);

    const takenLayer = new Set<string>();
    section.layers.forEach((layer, li) => {
      const leaf = uniqueSlug(layer.name, takenLayer, `l${li + 1}`);
      naming.layers.set(layer.id, `${base}__${leaf}`);
    });
  });

  return naming;
}

/* ─── правила слоя ────────────────────────────────────────────────────────── */

export function fillCss(fill: Fill, assetUrl: (id: string) => string | null): string {
  const parts: string[] = [];
  if (fill.overlay) parts.push(`linear-gradient(${fill.overlay.from}, ${fill.overlay.to})`);
  const image = fill.image && assetUrl(fill.image);
  if (image) parts.push(`url("${image}") center / cover no-repeat`);
  if (fill.color) parts.push(fill.color);
  return parts.join(',\n    ');
}

/**
 * Класс появления. Слою с собственным поворотом обычный вариант не подходит:
 * он сбрасывает transform, и элемент прыгает на место из другой точки, теряя
 * поворот. Такому слою правило выдаётся мягкое — помнить об этом не нужно.
 */
export function revealClass(layer: Layer): string {
  if (!layer.reveal) return '';
  const kind = layer.rotation ? 'soft' : layer.reveal.kind;
  return kind === 'soft' ? 'wc-soft' : 'wc-up';
}

function baseRules(layer: Layer, w: number): string[] {
  const out = [
    'position: absolute',
    `left: ${cq(layer.x, w)}`,
    `top: ${cq(layer.y, w)}`,
    `width: ${cq(layer.w, w)}`,
  ];
  // Высоту текста считает строка: рамка в редакторе нужна для выделения,
  // а в вёрстке жёсткая высота обрезала бы содержимое.
  out.push(layer.autoHeight ? 'height: auto' : `height: ${cq(layer.h, w)}`);
  if (layer.rotation) out.push(`transform: rotate(${num(layer.rotation, 2)}deg)`);
  if (layer.opacity !== 1) out.push(`opacity: ${num(layer.opacity, 3)}`);
  if (layer.reveal?.delay) out.push(`--d: ${Math.round(layer.reveal.delay)}ms`);
  return out;
}

/** Блок рисует рантайм; из студии он получает только палитру и кегль. */
function blockRules(layer: BlockLayer, w: number): string[] {
  const out = [...baseRules(layer, w)];
  const p = layer.params as Record<string, unknown>;
  if (typeof p.ink === 'string') out.push(`--wcb-ink: ${p.ink}`);
  if (typeof p.accent === 'string') out.push(`--wcb-accent: ${p.accent}`);
  if (typeof p.font === 'string') out.push(`--wcb-font: ${p.font}`);
  if (typeof p.size === 'number') out.push(`--wcb-size: ${cq(p.size, w)}`);
  if (typeof p.gap === 'number') out.push(`--wcb-gap: ${cq(p.gap, w)}`);
  return out;
}

function textRules(layer: TextLayer, w: number): string[] {
  const out = [...baseRules(layer, w), 'margin: 0'];
  out.push(`font-family: ${layer.font}`);
  out.push(`font-size: ${cq(layer.size, w)}`);
  out.push(`line-height: ${num(layer.lineHeight, 3)}`);
  if (layer.tracking) out.push(`letter-spacing: ${cq(layer.tracking, w)}`);
  out.push(`text-align: ${layer.align}`);
  out.push(`color: ${layer.color}`);
  if (layer.shadow) out.push(`text-shadow: ${layer.shadow}`);
  // Цифры многих антикв по умолчанию старостильные — в вёрстке это выглядит
  // ошибкой. Правило ставится само, помнить о нём не нужно.
  if (hasDigits(layer.content)) out.push('font-feature-settings: "lnum"');
  return out;
}

function imageRules(layer: ImageLayer, w: number, assetUrl: AssetUrl): string[] {
  const out = [...baseRules(layer, w)];

  // Перекрашенный вектор не может быть <img>: цвет внутри картинки не
  // достаётся из CSS. Выводим его маской по цвету — тем же приёмом, что уже
  // используют свотчи дресс-кода в существующих шаблонах.
  const url = layer.assetId ? assetUrl(layer.assetId) : null;
  if (layer.tint && url) {
    out.push(`background-color: ${layer.tint}`);
    out.push(`-webkit-mask: url("${url}") center / ${layer.fit} no-repeat`);
    out.push(`mask: url("${url}") center / ${layer.fit} no-repeat`);
  } else {
    out.push(`object-fit: ${layer.fit}`);
    if (layer.crop) {
      out.push(
        `object-position: ${num(layer.crop.x * 100, 2)}% ${num(layer.crop.y * 100, 2)}%`,
      );
    }
  }

  if (layer.radius) out.push(`border-radius: ${cq(layer.radius, w)}`);
  return out;
}

function shapeRules(layer: ShapeLayer, w: number): string[] {
  const out = [...baseRules(layer, w)];
  out.push(`background: ${layer.fill}`);
  if (layer.stroke) out.push(`border: ${num(layer.stroke.width, 2)}px solid ${layer.stroke.color}`);
  out.push(
    layer.shape === 'ellipse' ? 'border-radius: 50%' : `border-radius: ${cq(layer.radius, w)}`,
  );
  return out;
}

export function layerDeclarations(
  layer: Layer,
  canvasWidth: number,
  assetUrl: AssetUrl = () => null,
): string[] {
  switch (layer.kind) {
    case 'text':
      return textRules(layer, canvasWidth);
    case 'image':
      return imageRules(layer, canvasWidth, assetUrl);
    case 'shape':
      return shapeRules(layer, canvasWidth);
    case 'block':
      return blockRules(layer, canvasWidth);
    default:
      return baseRules(layer, canvasWidth);
  }
}

/* ─── таблица стилей секций и слоёв ───────────────────────────────────────── */

export function rulesCss(project: Project, naming: Naming, options: CssOptions = {}): string {
  const w = project.canvas.width;
  const scope = options.scope ?? '';
  const base = options.assetBase ?? 'assets/';

  const byId = new Map(project.assets.map((a) => [a.id, a]));
  const assetUrl = (id: string): string | null => {
    const asset = byId.get(id);
    return asset ? `${base}${asset.file}` : null;
  };

  const rules: string[] = [];

  for (const section of project.sections) {
    const secCls = naming.sections.get(section.id)!;

    const secRules =
      section.height.mode === 'ratio'
        ? [`aspect-ratio: 1 / ${num(section.height.value, 6)}`]
        : [`min-height: ${cq(sectionHeightPx(section, w), w)}`];

    const bg = fillCss(section.background, assetUrl);
    if (bg) secRules.push(`background: ${bg}`);
    // Базовое правило .canvas обрезает содержимое; секции, где элемент
    // намеренно шире холста, отменяют это.
    if (section.clip === false) secRules.push('overflow: visible');
    rules.push(`${scope}.${secCls} {\n  ${secRules.join(';\n  ')};\n}`);

    for (const layer of section.layers) {
      if (layer.hidden) continue;
      const cls = naming.layers.get(layer.id)!;
      rules.push(
        `${scope}.${cls} {\n  ${layerDeclarations(layer, w, assetUrl).join(';\n  ')};\n}`,
      );
    }
  }

  return rules.join('\n\n');
}

/* ─── разметка ────────────────────────────────────────────────────────────── */

export function layerHtml(
  layer: Layer,
  className: string,
  assetUrl: (id: string) => string | null,
): string {
  const edit = 'editable' in layer && layer.editable ? ` data-edit="${layer.editable.key}"` : '';
  const reveal = revealClass(layer);
  const cls = reveal ? `${className} ${reveal}` : className;

  switch (layer.kind) {
    case 'text':
      return `<${layer.tag} class="${cls}"${edit}>${esc(layer.content)}</${layer.tag}>`;
    case 'image': {
      const src = layer.assetId ? assetUrl(layer.assetId) : null;
      if (layer.tint) {
        return `<div class="${cls}"${edit} role="img" aria-label="${escAttr(layer.alt)}"></div>`;
      }
      return `<img class="${cls}"${edit} src="${escAttr(src ?? '')}" alt="${escAttr(layer.alt)}" />`;
    }
    case 'shape':
      return `<div class="${cls}" aria-hidden="true"></div>`;
    case 'block': {
      // Сложные блоки студия не рисует: разметку разворачивает общий рантайм.
      // Здесь — только якорь с параметрами.
      const params = escAttr(JSON.stringify(layer.params ?? {}));
      return `<div class="${cls}" data-block="${layer.block}" data-params="${params}"></div>`;
    }
    case 'group':
      return `<div class="${cls}"></div>`;
  }
}

/* ─── схема полей кабинета ────────────────────────────────────────────────── */

export interface GeneratedField {
  id: string;
  type: string;
  label: string;
  hint?: string;
  scope: 'data' | 'custom';
  maxLength?: number;
  iconSet?: string;
}

export interface GeneratedSection {
  title: string;
  icon?: string;
  fields: GeneratedField[];
}

/** Поля, которые добавляет сам блок: их значения правит пара, а не студия. */
const BLOCK_FIELDS: Partial<Record<string, GeneratedField[]>> = {
  schedule: [
    { id: 'schedule', type: 'schedule', label: 'Пункты программы', scope: 'data' },
  ],
  dresscode: [
    { id: 'dressCodeColors', type: 'colorList', label: 'Цвета палитры', scope: 'data' },
    { id: 'dressCodePhoto', type: 'image', label: 'Фото образа', scope: 'data' },
  ],
  rsvp: [{ id: 'drinks', type: 'drinks', label: 'Список напитков', scope: 'custom' }],
};

const BLOCK_SECTION_TITLE: Record<string, string> = {
  schedule: 'Программа дня',
  dresscode: 'Дресс-код',
  rsvp: 'Анкета гостя',
  calendar: 'Календарь',
  countdown: 'Отсчёт',
  wishes: 'Пожелания',
};

/**
 * Схема панели кабинета собирается из пометок на слоях: раздел — это
 * panelSection, порядок — порядок слоёв в документе. Ничего дописывать
 * руками в constants.ts не нужно.
 */
export function buildFields(project: Project): GeneratedSection[] {
  const sections: GeneratedSection[] = [];
  const byTitle = new Map<string, GeneratedSection>();

  const put = (title: string, field: GeneratedField) => {
    let section = byTitle.get(title);
    if (!section) {
      section = { title, fields: [] };
      byTitle.set(title, section);
      sections.push(section);
    }
    if (!section.fields.some((f) => f.id === field.id)) section.fields.push(field);
  };

  for (const section of project.sections) {
    for (const layer of section.layers) {
      if ((layer.kind === 'text' || layer.kind === 'image') && layer.editable) {
        const hook = layer.editable;
        put(hook.panelSection || section.name, {
          id: hook.key,
          type: hook.type,
          label: hook.label || hook.key,
          hint: hook.hint,
          scope: hook.scope,
          maxLength: hook.maxLength,
          iconSet: hook.iconSet,
        });
      }
      if (layer.kind === 'block') {
        const fields = BLOCK_FIELDS[layer.block];
        if (fields) {
          for (const field of fields) {
            put(BLOCK_SECTION_TITLE[layer.block] ?? section.name, field);
          }
        }
      }
    }
  }

  return sections;
}

export interface GeneratedDefaults {
  schedule?: { time: string; title: string; icon: string }[];
  dressCodeColors?: string[];
  dressCodePhoto?: string;
  drinks?: { value: string; label: string }[];
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

const DEFAULT_SCHEDULE = [
  { time: '15:00', title: 'Сбор гостей', icon: '🥂' },
  { time: '16:00', title: 'Церемония', icon: '💍' },
  { time: '17:00', title: 'Банкет', icon: '🍽' },
  { time: '22:00', title: 'Финал вечера', icon: '🎆' },
];

const DEFAULT_DRINKS = [
  { value: 'sparkling', label: 'Игристое' },
  { value: 'red', label: 'Красное вино' },
  { value: 'white', label: 'Белое вино' },
  { value: 'strong', label: 'Крепкие напитки' },
];

/**
 * Значения по умолчанию — то, что стоит в дизайне прямо сейчас. Пара
 * открывает кабинет и видит заполненные поля, а не пустые.
 */
export function buildDefaults(project: Project): GeneratedDefaults {
  const defaults: GeneratedDefaults = {};
  const custom: Record<string, unknown> = {};
  const byId = new Map(project.assets.map((a) => [a.id, a]));

  for (const section of project.sections) {
    for (const layer of section.layers) {
      if (layer.kind === 'text' && layer.editable) {
        const target = layer.editable.scope === 'custom' ? custom : defaults;
        target[layer.editable.key] = layer.content;
      }
      if (layer.kind === 'image' && layer.editable && layer.assetId) {
        const asset = byId.get(layer.assetId);
        if (!asset) continue;
        const url = `/invite/${project.slug}/assets/${asset.file}`;
        const target = layer.editable.scope === 'custom' ? custom : defaults;
        target[layer.editable.key] = url;
      }
      if (layer.kind === 'block') {
        if (layer.block === 'schedule' && !defaults.schedule) {
          defaults.schedule = DEFAULT_SCHEDULE;
        }
        if (layer.block === 'dresscode' && !defaults.dressCodeColors) {
          defaults.dressCodeColors = project.catalog.colors.length
            ? project.catalog.colors
            : ['#d7d3cb', '#8c967b', '#7c6a54'];
        }
        if (layer.block === 'rsvp' && !custom.drinks) custom.drinks = DEFAULT_DRINKS;
      }
    }
  }

  if (Object.keys(custom).length) defaults.custom = custom;
  return defaults;
}

/** Тонкий script.js шаблона: вся работа — в общем рантайме. */
export function generateScript(project: Project): string {
  const defaults = buildDefaults(project);
  const runtimeDefaults = {
    schedule: defaults.schedule,
    dressCodeColors: defaults.dressCodeColors,
    dressCodePhoto: defaults.dressCodePhoto,
    drinks: (defaults.custom as Record<string, unknown> | undefined)?.drinks,
  };

  return `/* ${project.catalog.name} — собрано Верстаком.
   Вся логика в общем рантайме ../assets/studio-runtime.js, здесь только
   значения по умолчанию для standalone-просмотра. */
WCStudio.start(${JSON.stringify({ defaults: runtimeDefaults }, null, 2)});
`;
}

/* ─── шрифты ──────────────────────────────────────────────────────────────── */

function fontHead(project: Project): string {
  const google = project.fonts.filter((f) => f.source === 'google' && f.googleSpec);
  if (!google.length) return '';
  const specs = google.flatMap((f) => [f.googleSpec!, ...(f.googleExtra ?? [])]);
  const families = [...new Set(specs)].map((spec) => `family=${spec}`).join('&');
  return (
    `  <link rel="preconnect" href="https://fonts.googleapis.com" />\n` +
    `  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n` +
    `  <link href="https://fonts.googleapis.com/css2?${families}&display=swap" rel="stylesheet" />\n`
  );
}

export function fontFaces(
  project: Project,
  assetBase = 'assets/fonts/',
  /** Своя ссылка на файл: в студии шрифт до сохранения лежит в памяти. */
  urlOf: (file: string) => string = (file) => `${assetBase}${file}`,
): string {
  return project.fonts
    .filter((f) => f.source === 'local' && f.files?.length)
    .map((f) => {
      const srcs = f
        .files!.map((file) => {
          const ext = file.split('.').pop();
          const format = ext === 'woff2' ? 'woff2' : ext === 'woff' ? 'woff' : 'truetype';
          return `       url("${urlOf(file)}") format("${format}")`;
        })
        .join(',\n');
      const family = f.stack.split(',')[0].trim();
      return `@font-face {\n  font-family: ${family};\n  src:\n${srcs};\n  font-display: swap;\n}`;
    })
    .join('\n\n');
}

export const fontVars = (project: Project): string =>
  project.fonts.map((f) => `  --font-${f.key}: ${f.stack};`).join('\n');

/* ─── сборка шаблона ──────────────────────────────────────────────────────── */

export function generateTemplate(project: Project): GeneratedFiles {
  const naming = nameThings(project);
  const maxWidth = project.canvas.maxWidth ?? DEFAULT_MAX_WIDTH;

  const byId = new Map(project.assets.map((a) => [a.id, a]));
  const assetUrl = (id: string): string | null => {
    const asset = byId.get(id);
    return asset ? `assets/${asset.file}` : null;
  };

  const panels = project.sections.map((section, index) => {
    const nodes = section.layers
      .filter((l) => !l.hidden)
      .map((l) => `        ${layerHtml(l, naming.layers.get(l.id)!, assetUrl)}`);

    return (
      `    <!-- ${index + 1} — ${section.name.toUpperCase()} -->\n` +
      `    <section class="panel">\n` +
      `      <div class="canvas ${naming.sections.get(section.id)}">\n` +
      (nodes.length ? nodes.join('\n') + '\n' : '') +
      `      </div>\n` +
      `    </section>`
    );
  });

  const vars = fontVars(project);
  const faces = fontFaces(project);

  const css = `/* ${project.catalog.name} — собрано Верстаком.
   Правки руками не потеряются: рядом лежит _studio.json, откройте его в студии.
   Эталонная ширина проектирования — ${project.canvas.width}px. */

${faces ? faces + '\n\n' : ''}${vars ? `:root {\n${vars}\n}\n\n` : ''}* { box-sizing: border-box; }
/* Декор секций бывает нарочно шире колонки и уходит под обрез. Без этого
   он растянул бы страницу вбок и вызвал горизонтальную прокрутку. */
html, body { margin: 0; padding: 0; overflow-x: hidden; }

body {
  background: ${project.sections[0]?.background.color ?? '#ffffff'};
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.invite { width: 100%; max-width: ${maxWidth}px; margin: 0 auto; }
.panel { width: 100%; }

.canvas {
  position: relative;
  width: 100%;
  container-type: inline-size;
  overflow: hidden;
}

/* ---------- секции и слои ---------- */

${rulesCss(project, naming)}
`;

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(project.catalog.name)}</title>
${fontHead(project)}  <link rel="stylesheet" href="../assets/studio-blocks.css" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="invite">
${panels.join('\n\n')}
  </main>

  <script src="../assets/music.js"></script>
  <script src="../assets/photo-frame.js"></script>
  <script src="../assets/venue-map.js"></script>
  <script src="../assets/studio-runtime.js"></script>
  <script src="script.js"></script>
</body>
</html>
`;

  return { html, css, script: generateScript(project) };
}
