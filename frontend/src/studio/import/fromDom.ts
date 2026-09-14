'use client';

/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — импорт готовой страницы слоями.

   CSS здесь не разбирается вообще. Страница грузится в скрытый фрейм, и
   геометрию с оформлением считает сам браузер: getBoundingClientRect и
   getComputedStyle. Это на порядок надёжнее любого парсера — и заодно
   бесплатно учитывает каскад, медиа-запросы и наследование.

   Что получается: секции из крупных блоков страницы, внутри — текстовые
   слои, картинки и заливки. Дальше их двигают руками.
   ═══════════════════════════════════════════════════════════════════════════ */

import { addressOf, isBound, sectionSelector } from './address';
import { blockAt } from './blocks';
import {
  Asset,
  BlockLayer,
  Layer,
  LayerBaseline,
  Section,
  ShapeLayer,
  TextLayer,
  ImageLayer,
  baseLayer,
  uid,
} from '../types';

export interface ImportedPage {
  sections: Section[];
  /** адреса картинок, которые нужно втянуть в шаблон */
  images: string[];
  /** найденные на странице стеки шрифтов — их надо подключить в шаблон */
  fonts: string[];
  report: string[];
}

/** Элементы, которые в макет не попадают ни при каких условиях. */
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'TITLE', 'HEAD', 'BR', 'IFRAME',
]);

/**
 * Адрес картинки без имени хоста, если она с нашего же сайта.
 *
 * Браузер отдаёт полный адрес, и в проект попадал бы «http://localhost:3000/…»
 * — на сервере такой путь никуда не ведёт.
 */
function sameOriginPath(url: string): string {
  try {
    const parsed = new URL(url, location.href);
    return parsed.origin === location.origin ? parsed.pathname + parsed.search : url;
  } catch {
    return url;
  }
}

const isTransparent = (color: string): boolean =>
  !color || color === 'transparent' || /rgba\([^)]*,\s*0\s*\)$/.test(color);

/** Прямой текст элемента — без текста вложенных элементов. */
function ownText(el: Element): string {
  let text = '';
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) text += node.nodeValue ?? '';
  });
  return text.replace(/\s+/g, ' ').trim();
}

function backgroundUrl(style: CSSStyleDeclaration): string | null {
  const match = /url\(["']?([^"')]+)["']?\)/.exec(style.backgroundImage || '');
  return match ? match[1] : null;
}

const TAG_BY_ROLE: Record<string, TextLayer['tag']> = {
  H1: 'h1', H2: 'h2', H3: 'h3', H4: 'h3', H5: 'h3', H6: 'h3',
  P: 'p', SPAN: 'span', A: 'span', LI: 'p', DIV: 'p',
};

interface WalkContext {
  scale: number;
  originX: number;
  originY: number;
  /** корень секции: адреса слоёв строятся относительно него */
  root: Element;
  layers: Layer[];
  images: Set<string>;
  fonts: Set<string>;
  report: string[];
}

function pushLayer(ctx: WalkContext, el: Element, style: CSSStyleDeclaration): void {
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;

  const x = (rect.left - ctx.originX) * ctx.scale;
  const y = (rect.top - ctx.originY) * ctx.scale;
  const w = rect.width * ctx.scale;
  const h = rect.height * ctx.scale;

  const name = (el.getAttribute('class') || el.tagName.toLowerCase()).split(/\s+/)[0];
  const base = baseLayer(name.slice(0, 40) || 'Слой', x, y, w, h);
  base.opacity = Number(style.opacity) || 1;

  /* Адрес и исходные значения — всё, что нужно режиму правки: экспорт потом
     сравнит слой с этой точкой отсчёта и выпишет только разницу. */
  base.selector = addressOf(el, ctx.root);
  base.boundText = isBound(el);
  const baseline: LayerBaseline = { x, y, w, h };
  if (base.opacity !== 1) baseline.opacity = base.opacity;
  base.baseline = baseline;

  /* Готовый блок шаблона — один слой на всё. Внутрь не заходим: его
     наполняет script.js, и разбирать его на части бессмысленно и опасно. */
  const block = blockAt(el);
  if (block) {
    const layer: BlockLayer = {
      ...base,
      name: block.name,
      kind: 'block',
      block: block.kind,
      params: {},
    };
    ctx.layers.push(layer);
    return;
  }

  /* картинка */
  if (el.tagName === 'IMG') {
    const raw = (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src;
    if (!raw) return;
    const src = sameOriginPath(raw);
    ctx.images.add(src);
    const layer: ImageLayer = {
      ...base,
      kind: 'image',
      assetId: src as unknown as string, // временно: адрес, потом заменится id
      fit: (style.objectFit as ImageLayer['fit']) || 'cover',
      radius: parseFloat(style.borderTopLeftRadius) * ctx.scale || 0,
      alt: (el as HTMLImageElement).alt || '',
    };
    ctx.layers.push(layer);
    return;
  }

  /* фоновая картинка */
  const bg = backgroundUrl(style) && sameOriginPath(backgroundUrl(style)!);
  if (bg) {
    ctx.images.add(bg);
    const layer: ImageLayer = {
      ...base,
      kind: 'image',
      assetId: bg as unknown as string,
      fit: style.backgroundSize === 'contain' ? 'contain' : 'cover',
      radius: parseFloat(style.borderTopLeftRadius) * ctx.scale || 0,
      alt: '',
    };
    ctx.layers.push(layer);
    return;
  }

  /* текст */
  const text = ownText(el);
  if (text) {
    const layer: TextLayer = {
      ...base,
      autoHeight: true,
      kind: 'text',
      content: text,
      tag: TAG_BY_ROLE[el.tagName] ?? 'p',
      font: style.fontFamily,
      size: parseFloat(style.fontSize) * ctx.scale || 16,
      lineHeight:
        style.lineHeight === 'normal'
          ? 1.3
          : parseFloat(style.lineHeight) / (parseFloat(style.fontSize) || 16),
      tracking:
        style.letterSpacing === 'normal' ? 0 : parseFloat(style.letterSpacing) * ctx.scale,
      align: (style.textAlign === 'center' || style.textAlign === 'right'
        ? style.textAlign
        : 'left') as TextLayer['align'],
      color: style.color,
      shadow: style.textShadow !== 'none' ? style.textShadow : undefined,
    };
    Object.assign(base.baseline!, {
      size: layer.size,
      lineHeight: layer.lineHeight,
      tracking: layer.tracking,
      color: layer.color,
      align: layer.align,
      content: layer.content,
    });
    ctx.fonts.add(style.fontFamily);
    ctx.layers.push(layer);
    return;
  }

  /* заливка */
  if (!isTransparent(style.backgroundColor)) {
    const layer: ShapeLayer = {
      ...base,
      kind: 'shape',
      shape: parseFloat(style.borderTopLeftRadius) > rect.width / 2.2 ? 'ellipse' : 'rect',
      fill: style.backgroundColor,
      radius: parseFloat(style.borderTopLeftRadius) * ctx.scale || 0,
    };
    ctx.layers.push(layer);
  }
}

function walk(el: Element, ctx: WalkContext, depth: number): void {
  if (SKIP_TAGS.has(el.tagName) || depth > 24) return;

  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return;

  pushLayer(ctx, el, style);

  // В картинку, в текстовый узел и в готовый блок спускаться незачем: то,
  // что внутри, уже попало в слой целиком.
  if (el.tagName === 'IMG' || ownText(el) || blockAt(el)) return;

  Array.from(el.children).forEach((child) => walk(child, ctx, depth + 1));
}

/**
 * Спускаемся сквозь обёртки к настоящему холсту секции.
 *
 * В вёрстке секция часто завёрнута: <section class="panel"> ничего не
 * добавляет, а всё оформление — на вложенном .canvas. Если взять внешнюю
 * обёртку, у неё своё поведение краёв (обрезки нет никогда) и свой фон, и
 * секция импортируется с чужими свойствами.
 */
function unwrapRoot(el: Element): Element {
  let current = el;
  for (let depth = 0; depth < 4; depth++) {
    const children = Array.from(current.children).filter((c) => !SKIP_TAGS.has(c.tagName));
    if (children.length !== 1) break;

    const outer = current.getBoundingClientRect();
    const inner = children[0].getBoundingClientRect();
    // Ребёнок занимает всю площадь родителя — значит, родитель лишь обёртка.
    if (Math.abs(outer.width - inner.width) > 1 || Math.abs(outer.height - inner.height) > 1) {
      break;
    }
    current = children[0];
  }
  return current;
}

/** Крупные блоки страницы становятся секциями. */
function pickSectionRoots(doc: Document): Element[] {
  const explicit = Array.from(doc.querySelectorAll('section, .panel, main > div'));
  const good = explicit.filter((el) => el.getBoundingClientRect().height > 120);
  if (good.length) return good;

  const main = doc.querySelector('main') ?? doc.body;
  const children = Array.from(main.children).filter(
    (el) => el.getBoundingClientRect().height > 120,
  );
  return children.length ? children : [main];
}

/**
 * Разбирает уже загруженный документ на секции и слои.
 * `canvasWidth` — эталонная ширина будущего проекта: всё пересчитывается в неё.
 */
export function importDocument(doc: Document, canvasWidth: number): ImportedPage {
  const pageWidth = doc.documentElement.clientWidth || 1;
  const scale = canvasWidth / pageWidth;

  const images = new Set<string>();
  const fonts = new Set<string>();
  const report: string[] = [];
  const sections: Section[] = [];
  let gradients = 0;

  pickSectionRoots(doc).forEach((outer, index) => {
    const root = unwrapRoot(outer);
    const rect = root.getBoundingClientRect();
    const ctx: WalkContext = {
      scale,
      originX: rect.left,
      originY: rect.top,
      root,
      layers: [],
      images,
      fonts,
      report,
    };

    Array.from(root.children).forEach((child) => walk(child, ctx, 0));

    const style = getComputedStyle(root);
    const background = backgroundUrl(style);
    if (background) images.add(background);

    // Градиентную подложку студия не переносит: в документе у секции только
    // цвет и картинка. Молчать об этом нельзя — у «Калл», например, каждая
    // секция подсвечена сверху и притемнена снизу, и без этого стыки секций
    // на копии выглядят иначе, чем на оригинале.
    if (/gradient\(/.test(style.backgroundImage || '')) gradients += 1;

    sections.push({
      id: uid(),
      name: root.getAttribute('data-name') || `Секция ${index + 1}`,
      selector: sectionSelector(root),
      height: { mode: 'ratio', value: rect.height / pageWidth },
      // Секции с overflow: visible в оригинале выпускают декор за края —
      // обрезав их, мы сузили бы рамки и поломали вёрстку внутри.
      clip: style.overflow !== 'visible',
      background: {
        color: isTransparent(style.backgroundColor) ? '#ffffff' : style.backgroundColor,
        image: background ? (background as unknown as string) : undefined,
      },
      layers: ctx.layers,
    });
  });

  const layerCount = sections.reduce((sum, s) => sum + s.layers.length, 0);
  report.push(`Секций: ${sections.length}, слоёв: ${layerCount}`);
  report.push(`Картинок к загрузке: ${images.size}`);
  report.push(`Шрифтов найдено: ${fonts.size}`);
  if (gradients) {
    report.push(
      `Градиентная подложка секций не перенесена: ${gradients} — ` +
        'на копии фон будет ровным',
    );
  }
  if (!layerCount) report.push('Ничего не распозналось — возможно, страница не догрузилась');

  return { sections, images: Array.from(images), fonts: Array.from(fonts), report };
}

/**
 * После загрузки картинок адреса в слоях меняются на настоящие id ассетов.
 *
 * `keepUrls` — режим правки: картинки никуда не копировались, и слои должны
 * продолжать смотреть на файлы самого шаблона по их исходным адресам.
 */
export function relinkAssets(
  sections: Section[],
  byUrl: Map<string, Asset>,
  keepUrls = false,
): void {
  for (const section of sections) {
    if (section.background.image) {
      const asset = byUrl.get(section.background.image);
      if (asset) section.background.image = asset.id;
      else if (!keepUrls) section.background.image = undefined;
    }
    for (const layer of section.layers) {
      if (layer.kind !== 'image') continue;
      const asset = byUrl.get(layer.assetId ?? '');
      if (asset) layer.assetId = asset.id;
      else if (!keepUrls) layer.assetId = null;
    }
  }
}
