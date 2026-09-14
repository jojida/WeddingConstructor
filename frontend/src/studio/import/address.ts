'use client';

/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — адрес элемента в чужой разметке.

   Режим правки держится на одном: у каждого элемента должен быть адрес,
   по которому его найдёт CSS. Не «двенадцатый слой сверху», а селектор,
   который переживёт и повторный импорт, и правки шаблона руками.

   Порядок предпочтений — от самого живучего к запасному:
     1. id или data-edit — за них держится и скрипт шаблона, и кабинет пары;
     2. набор классов, единственный в своей секции;
     3. структурный путь — работает всегда, но ломается при перестановке.

   Ничего про разметку конкретного шаблона здесь не зашито. Первая версия
   предполагала у секции класс `.canvas`, как у «Калл», — и на «Скетче», где
   секции размечены иначе, десять адресов совпали между собой. Теперь селектор
   секции строится из её собственных классов и проверяется на единственность.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Классы, которые навешивает и снимает скрипт. В адрес они попасть не должны:
 * до появления секции на экране класса `in` нет, и правило бы не сработало.
 */
const DYNAMIC = new Set(['in', 'active', 'visible', 'open', 'show', 'current', 'is-visible']);

/** Атрибуты, за которые держится script.js шаблона. */
const BOUND_ATTRS = ['data-edit', 'data-cal', 'data-name', 'data-field'];

/**
 * Классы, по которым скрипт шаблона находит свои узлы. Такой элемент нельзя
 * считать обычным текстом: его содержимое рисует скрипт — программа дня,
 * календарь, карусель, анкета.
 */
const BOUND_CLASSES = /^(timeline|carousel|custom-radio|custom-check|countdown|cd-|cal|palette)/;

const stable = (el: Element): string[] =>
  [...el.classList].filter((c) => !DYNAMIC.has(c));

const escape = (value: string): string =>
  typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value;

const countIn = (scope: ParentNode, selector: string): number => {
  try {
    return scope.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
};

/** Путь из `:nth-child`, считая от `stop` (не включая его). */
function pathFrom(el: Element, stop: Element | null): string {
  const steps: string[] = [];
  let current: Element | null = el;
  while (current && current !== stop && current.parentElement) {
    const index = [...current.parentElement.children].indexOf(current) + 1;
    steps.unshift(`${current.tagName.toLowerCase()}:nth-child(${index})`);
    current = current.parentElement;
  }
  return steps.join(' > ');
}

/**
 * Селектор секции, единственный на всю страницу.
 *
 * Сначала пробуем id, потом набор собственных классов, и только если и он
 * встречается дважды — добавляем путь от начала документа.
 */
export function sectionSelector(root: Element): string {
  const doc = root.ownerDocument;

  if (root.id) return `#${escape(root.id)}`;

  const classes = stable(root);
  if (classes.length) {
    const selector = `.${classes.map(escape).join('.')}`;
    if (countIn(doc, selector) === 1) return selector;
  }

  return pathFrom(root, doc.body) || root.tagName.toLowerCase();
}

/** Держится ли за этот элемент скрипт шаблона. */
export function isBound(el: Element): boolean {
  if (BOUND_ATTRS.some((a) => el.hasAttribute(a))) return true;
  for (const cls of el.classList) if (BOUND_CLASSES.test(cls)) return true;
  return false;
}

/**
 * Адрес элемента внутри его секции.
 *
 * `root` — корень секции; адрес всегда начинается с её селектора, поэтому
 * одинаковые классы в разных секциях друг другу не мешают.
 */
export function addressOf(el: Element, root: Element): string {
  const base = sectionSelector(root);

  if (el.id) return `${base} #${escape(el.id)}`;

  for (const attr of BOUND_ATTRS) {
    const value = el.getAttribute(attr);
    if (value) return `${base} [${attr}="${value}"]`;
  }

  // Набор классов целиком точнее одного класса: `.title.farewell__title`
  // отличает заголовок от десятка других `.title` в той же секции.
  const classes = stable(el);
  if (classes.length) {
    const selector = `.${classes.map(escape).join('.')}`;
    if (countIn(root, selector) === 1) return `${base} ${selector}`;
  }

  const path = pathFrom(el, root);
  return path ? `${base} > ${path}` : base;
}
