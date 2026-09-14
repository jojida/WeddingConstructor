/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — экспорт в режиме правки.

   Здесь студия не собирает шаблон, а дописывает к нему разницу. Разметка,
   стили и script.js шаблона остаются нетронутыми — поэтому программа дня,
   календарь, отсчёт, карусель и анкета продолжают работать, а пара
   по-прежнему правит свои поля в кабинете.

   Два решения, на которых всё держится.

   Первое: сдвиг пишется свойством `translate`, а не `transform`. Анимация
   появления в шаблонах сделана на `transform` (`.fade-up { transform:
   translateY(26px) }` → `.fade-up.in { transform: none }`), и перебив его,
   мы бы остановили анимацию. `translate` — отдельное свойство, оно
   складывается с `transform`, и обе вещи живут одновременно.

   Второе: размеры пишутся в `cqw`. Эта единица считается от контейнера
   секции, а не от родителя элемента, поэтому она верна на любой глубине
   вложенности — даже там, где у элемента свой абсолютно позиционированный
   предок.
   ═══════════════════════════════════════════════════════════════════════════ */

import { Project, Layer, LayerBaseline } from '../types';

/** Насколько должны разойтись значения, чтобы считать это правкой. */
const EPSILON = 0.05;

const changed = (a: number | undefined, b: number | undefined): boolean =>
  a !== undefined && b !== undefined && Math.abs(a - b) > EPSILON;

/** Пиксели холста → cqw, как в остальном экспорте. */
const cq = (px: number, width: number): string =>
  `${Number((px / width) * 100).toFixed(5).replace(/\.?0+$/, '')}cqw`;

/** Правила для одного слоя: только то, что отличается от оригинала. */
function layerRules(layer: Layer, canvasWidth: number): string[] {
  const base: LayerBaseline | undefined = layer.baseline;
  if (!base) return [];

  const out: string[] = [];

  /* Сдвиг. Пишем разницу, а не абсолютную позицию: у элемента может быть свой
     позиционированный предок, и абсолютные координаты секции там неверны. */
  const dx = layer.x - base.x;
  const dy = layer.y - base.y;
  if (Math.abs(dx) > EPSILON || Math.abs(dy) > EPSILON) {
    out.push(`translate: ${cq(dx, canvasWidth)} ${cq(dy, canvasWidth)}`);
  }

  if (changed(layer.w, base.w)) out.push(`width: ${cq(layer.w, canvasWidth)}`);
  if (changed(layer.h, base.h)) out.push(`height: ${cq(layer.h, canvasWidth)}`);

  if (changed(layer.opacity, base.opacity ?? 1)) {
    out.push(`opacity: ${Number(layer.opacity.toFixed(3))}`);
  }

  if (layer.kind === 'text') {
    if (changed(layer.size, base.size)) out.push(`font-size: ${cq(layer.size, canvasWidth)}`);
    if (changed(layer.lineHeight, base.lineHeight)) {
      out.push(`line-height: ${Number(layer.lineHeight.toFixed(3))}`);
    }
    if (changed(layer.tracking, base.tracking)) {
      out.push(`letter-spacing: ${cq(layer.tracking, canvasWidth)}`);
    }
    if (base.color && layer.color !== base.color) out.push(`color: ${layer.color}`);
    if (base.align && layer.align !== base.align) out.push(`text-align: ${layer.align}`);
  }

  return out;
}

export interface PatchResult {
  css: string;
  /** сколько слоёв реально изменено — для отчёта в студии */
  touched: number;
  /** правки текста: их нельзя выразить стилями, они идут в разметку */
  texts: { selector: string; content: string; was: string }[];
  /** тексты, которые подставляет скрипт шаблона: править их бессмысленно */
  skippedBound: string[];
}

/** Собирает файл переопределений по разнице с оригиналом. */
export function generatePatch(project: Project): PatchResult {
  const width = project.canvas.width;
  const blocks: string[] = [];
  const texts: { selector: string; content: string; was: string }[] = [];
  const skippedBound: string[] = [];
  let touched = 0;

  for (const section of project.sections) {
    for (const layer of section.layers) {
      if (!layer.selector) continue;

      const rules = layerRules(layer, width);
      if (rules.length) {
        touched += 1;
        blocks.push(`${layer.selector} {\n  ${rules.join(';\n  ')};\n}`);
      }

      if (layer.kind === 'text' && layer.baseline?.content !== undefined) {
        if (layer.content !== layer.baseline.content) {
          if (layer.boundText) skippedBound.push(layer.selector);
          else
            texts.push({
              selector: layer.selector,
              content: layer.content,
              was: layer.baseline.content,
            });
        }
      }

      // Скрытый слой — единственная правка, которую нельзя выразить разницей.
      if (layer.hidden) {
        touched += 1;
        blocks.push(`${layer.selector} {\n  display: none;\n}`);
      }
    }
  }

  const head = `/* ${project.catalog.name || project.slug} — правки Верстака.

   Файл создаёт студия. Он подключается после styles.css и содержит только то,
   что отличается от оригинала: разметка, стили и script.js шаблона не
   менялись, поэтому вся начинка шаблона работает как прежде.

   Правки руками здесь пропадут при следующем экспорте — правьте в студии.
   Изменённых элементов: ${touched}. */
`;

  return {
    css: blocks.length ? `${head}\n${blocks.join('\n\n')}\n` : head,
    touched,
    texts,
    skippedBound,
  };
}

/** Имя файла с правками рядом с шаблоном. */
export const PATCH_FILE = '_studio.css';

/**
 * Вписывает ссылку на файл правок в разметку шаблона.
 *
 * Это единственное изменение, которое студия вносит в index.html, и вносит
 * его один раз: если ссылка уже стоит, разметка возвращается как есть.
 */
export function linkPatch(html: string): string {
  if (html.includes(PATCH_FILE)) return html;

  const link = `  <link rel="stylesheet" href="${PATCH_FILE}" />`;

  // Строго после styles.css — переопределения должны идти последними.
  const after = /([ \t]*<link[^>]+href="styles\.css"[^>]*>)/i;
  if (after.test(html)) return html.replace(after, `$1\n${link}`);

  return html.replace(/<\/head>/i, `${link}\n</head>`);
}
