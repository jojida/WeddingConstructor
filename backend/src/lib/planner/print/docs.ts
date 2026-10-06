// Вёрстка печатных материалов. Каждый документ — страницы с элементами (см. layout.ts).
// Правила для всех: текст не обрезается (не влез — меньше кегль, перенос или новая страница),
// пищевые ограничения попадают только в служебные документы и только по явному запросу.
import { PlannerError } from '../util';
import { measure, type Family } from './fonts';
import { PAPER, clean, fit, mm, text, wrap, type Doc, type Item, type Page, type PaperSize } from './layout';
import { isNumbered, listName, seatedPeople, type PrintData } from './data';

const CUT = '#c9c2b8';   // линии реза и сгиба

/** Тонкий орнамент: две линии и ромб посередине. */
function ornament(items: Item[], cx: number, y: number, width: number, color: string): void {
  const gap = 6;
  items.push({ kind: 'line', x1: cx - width / 2, y1: y, x2: cx - gap, y2: y, color, width: 0.6 });
  items.push({ kind: 'diamond', cx, cy: y, r: 2.6, color });
  items.push({ kind: 'line', x1: cx + gap, y1: y, x2: cx + width / 2, y2: y, color, width: 0.6 });
}

/** Строки абзаца по центру вокруг высоты mid. */
function centered(items: Item[], lines: string[], x: number, width: number, mid: number, size: number, family: Family, color: string, leading = 1.15): void {
  const lh = size * leading;
  const first = mid - ((lines.length - 1) * lh) / 2 + size * 0.32;
  lines.forEach((l, i) => items.push(text(l, x, first + i * lh, width, size, family, color)));
}

/* ── Карточки гостей: 10 штук на A4, линии реза ──────────────────────────── */
export function cardsDoc(data: PrintData, opts: { menu: boolean }): Doc {
  const t = data.theme;
  const [pw, ph] = PAPER.a4;
  const cw = mm(85), ch = mm(55), gx = mm(5), gy = mm(3), cols = 2, rows = 5;
  const left = (pw - (cols * cw + gx)) / 2;
  const top = (ph - (rows * ch + (rows - 1) * gy)) / 2;
  const people = seatedPeople(data);
  if (!people.length) throw new PlannerError(400, 'Пока никто не сидит за столами — карточкам нечего показать');

  const pages: Page[] = [];
  people.forEach((p, i) => {
    const k = i % (cols * rows);
    if (k === 0) pages.push({ items: [] });
    const items = pages[pages.length - 1].items;
    const x = left + (k % cols) * (cw + gx);
    const y = top + Math.floor(k / cols) * (ch + gy);
    const pad = mm(7), inner = cw - pad * 2, cx = x + cw / 2;
    items.push({ kind: 'rect', x, y, w: cw, h: ch, stroke: CUT, width: 0.4, dash: [3, 3] });
    ornament(items, cx, y + mm(9), mm(24), t.accent);
    if (p.name) {
      const f = fit(clean(p.name, t.heading), t.heading, { max: t.heading === 'script' ? 26 : 21, min: 9, width: inner, lines: 2 });
      centered(items, f.lines, x + pad, inner, y + ch * 0.47, f.size, t.heading, t.ink);
    } else {
      // Имени нет — линия, чтобы вписать от руки, и мелко: к какой группе относится гость
      const ly = y + ch * 0.53;
      items.push({ kind: 'line', x1: cx - inner * 0.42, y1: ly, x2: cx + inner * 0.42, y2: ly, color: t.soft, width: 0.8 });
      const note = fit(clean(`гость · ${p.partyLabel}`, t.body), t.body, { max: 7, min: 5.5, width: inner, lines: 2 });
      centered(items, note.lines, x + pad, inner, ly + 9, note.size, t.body, t.muted);
    }
    const table = data.tableById.get(p.tableId as string);
    const tf = fit(clean(table?.title ?? '', t.body), t.body, { max: 11, min: 7, width: inner, lines: 1 });
    items.push(text(tf.lines.join(' '), x + pad, y + ch - mm(11), inner, tf.size, t.body, t.accent, 'center', 1.2));
    if (opts.menu && (p.menu || p.menuReview)) {
      const mf = fit(clean(p.menu || 'блюдо уточняется', t.body), t.body, { max: 7.5, min: 6, width: inner, lines: 1 });
      items.push(text(mf.lines.join(' '), x + pad, y + ch - mm(6), inner, mf.size, t.body, t.muted));
    }
  });
  return { title: 'Карточки гостей', size: PAPER.a4, pages };
}

/* ── Номера столов «домиком»: A5, сгиб посередине, верхняя половина перевёрнута ── */
export function tentsDoc(data: PrintData): Doc {
  const t = data.theme;
  const [pw, ph] = PAPER.a5;
  if (!data.tables.length) throw new PlannerError(400, 'Сначала добавьте столы');
  const half = ph / 2;
  const footer = clean([data.couple, data.date].filter(Boolean).join(' · '), t.body);

  const face = (table: PrintData['tables'][number], oy: number): Item[] => {
    const items: Item[] = [];
    const cx = pw / 2, width = pw - mm(24), x = mm(12);
    ornament(items, cx, oy + mm(15), mm(36), t.accent);
    if (isNumbered(table.name)) {
      // Номер — не рукописным шрифтом: в нём «1» издалека похожа на косую черту
      const numeral: Family = t.heading === 'script' ? 'serif' : t.heading;
      items.push(text('СТОЛ', 0, oy + mm(27), pw, 12, t.body, t.accent, 'center', 4));
      const f = fit(clean(table.name, numeral), numeral, { max: 120, min: 40, width, lines: 1 });
      items.push(text(f.lines[0], x, oy + half * 0.69, width, f.size, numeral, t.ink));
    } else {
      const f = fit(clean(table.name, t.heading), t.heading, { max: 54, min: 16, width, lines: 2 });
      centered(items, f.lines, x, width, oy + half * 0.52, f.size, t.heading, t.ink);
    }
    const ff = fit(footer, t.body, { max: 10, min: 7, width, lines: 2 });
    centered(items, ff.lines, x, width, oy + half - mm(14), ff.size, t.body, t.muted);
    return items;
  };

  const pages = data.tables.map((table) => ({
    items: [
      // Нижняя половина — как есть, верхняя — та же, развёрнутая: после сгиба читается с обеих сторон стола
      ...face(table, half),
      { kind: 'flip' as const, cx: pw / 2, cy: half / 2, items: face(table, 0) },
      { kind: 'line' as const, x1: mm(5), y1: half, x2: pw - mm(5), y2: half, color: CUT, width: 0.5, dash: [4, 3] as [number, number] },
    ],
  }));
  return { title: 'Номера столов', size: PAPER.a5, pages };
}

/* ── Общие для плаката: шапка и раскладка блоков по клеткам ─────────────────── */
function posterHeader(data: PrintData, pw: number, margin: number, k: number, subtitle: string): { items: Item[]; height: number } {
  const t = data.theme;
  const items: Item[] = [];
  const width = pw - margin * 2;
  const name = fit(clean(data.couple, t.heading), t.heading, { max: (t.heading === 'script' ? 46 : 36) * k, min: 18 * k, width, lines: 1 });
  let y = margin + name.size;
  items.push(text(name.lines[0], margin, y, width, name.size, t.heading, t.ink));
  y += 22 * k;
  items.push(text(subtitle.toUpperCase(), margin, y, width, 13 * k, t.body, t.accent, 'center', 3 * k));
  if (data.date) { y += 17 * k; items.push(text(clean(data.date, t.body), margin, y, width, 11 * k, t.body, t.muted)); }
  y += 12 * k;
  ornament(items, pw / 2, y, 90 * k, t.accent);
  return { items, height: y + 16 * k - margin };
}

interface Block { title: string; lines: { text: string; size: number }[] }

/* ── План рассадки по столам: плакат A3/A2/A1 ──────────────────────────────── */
export function posterDoc(data: PrintData, paper: Extract<PaperSize, 'a3' | 'a2' | 'a1'>): Doc {
  const t = data.theme;
  const [pw, ph] = PAPER[paper];
  const k = pw / PAPER.a3[0];
  const margin = mm(14) * k;
  const people = seatedPeople(data);
  const groups = data.tables
    .map((table) => ({ title: clean(table.title, t.heading), names: people.filter((p) => p.tableId === table.id).map((p) => clean(listName(p), t.body)) }))
    .filter((g) => g.names.length);
  if (!groups.length) throw new PlannerError(400, 'Пока никто не сидит за столами — плакату нечего показать');

  const header = posterHeader(data, pw, margin, k, 'План рассадки');
  const gridTop = margin + header.height;
  const gridW = pw - margin * 2, gridH = ph - margin - gridTop;
  const n = groups.length;
  const cols = n <= 2 ? n : n <= 4 ? 2 : n <= 9 ? 3 : n <= 16 ? 4 : 5;
  const rows = Math.ceil(n / cols);
  const gap = 10 * k, pad = 10 * k;
  const cellW = (gridW - gap * (cols - 1)) / cols;
  const maxCellH = (gridH - gap * (rows - 1)) / rows;
  const inner = cellW - pad * 2;
  const titleOf = (size: number) => Math.min(size * 1.6, (t.heading === 'script' ? 30 : 24) * k);

  // Блоки при кегле size; если стол не влезает в клетку — продолжение в следующей клетке
  const build = (size: number): Block[] => {
    const titleSize = titleOf(size);
    const lh = size * 1.3;
    const room = maxCellH - pad * 2 - titleSize * 1.5;
    const out: Block[] = [];
    for (const g of groups) {
      let cur: Block = { title: g.title, lines: [] };
      let used = 0;
      for (const name of g.names) {
        const ls = wrap(name, t.body, size, inner);
        if (used + ls.length * lh > room && cur.lines.length) {
          out.push(cur);
          cur = { title: `${g.title} (продолжение)`, lines: [] };
          used = 0;
        }
        for (const l of ls) cur.lines.push({ text: l, size });
        used += ls.length * lh;
      }
      out.push(cur);
    }
    return out;
  };
  // Самый крупный общий кегль (плакат читают издалека), при котором каждый стол влезает в свою клетку
  let blocks: Block[] = [];
  let size = 0;
  for (let half = 40; half >= 13; half--) {   // от 20k до 6,5k с шагом 0,5k
    size = (half / 2) * k;
    blocks = build(size);
    if (blocks.length <= n) break;
  }
  // Клетка — по самому длинному столу, а не на всю высоту листа; сетка — посередине
  const titleSize = titleOf(size);
  const cellH = Math.min(maxCellH, Math.max(...blocks.map((b) => pad * 2 + titleSize * 1.5 + b.lines.length * size * 1.3)));

  const perPage = cols * rows;
  const pages: Page[] = [];
  blocks.forEach((b, i) => {
    if (i % perPage === 0) pages.push({ items: [...header.items] });
    const items = pages[pages.length - 1].items;
    const j = i % perPage;
    const onPage = Math.min(perPage, blocks.length - (i - j));
    const usedRows = Math.ceil(onPage / cols);
    const top = gridTop + (gridH - (usedRows * cellH + (usedRows - 1) * gap)) / 2;
    const x = margin + (j % cols) * (cellW + gap);
    const y = top + Math.floor(j / cols) * (cellH + gap);
    items.push({ kind: 'rect', x, y, w: cellW, h: cellH, stroke: t.soft, width: 0.6 * k });
    const tf = fit(b.title, t.heading, { max: titleSize, min: Math.min(titleSize, 8 * k), width: inner, lines: 1 });
    items.push(text(tf.lines.join(' '), x + pad, y + pad + tf.size, inner, tf.size, t.heading, t.accent));
    let ly = y + pad + titleSize * 1.5 + size;
    for (const l of b.lines) {
      items.push(text(l.text, x + pad, ly, inner, l.size, t.body, t.ink));
      ly += l.size * 1.3;
    }
  });
  return { title: 'План рассадки', size: PAPER[paper], pages };
}

/* ── Кто где сидит — по алфавиту (у входа: гость находит своё имя) ────────────── */
export function alphaDoc(data: PrintData, paper: Extract<PaperSize, 'a3' | 'a2' | 'a1'>): Doc {
  const t = data.theme;
  const [pw, ph] = PAPER[paper];
  const k = pw / PAPER.a3[0];
  const margin = mm(14) * k;
  // Справа — номер стола («5») или его название («Молодожёны»): шапка уже говорит, что это столы
  const entries = seatedPeople(data).filter((p) => p.name)
    .map((p) => ({ name: clean(p.name, t.body), table: clean(data.tableById.get(p.tableId as string)?.name ?? '', t.body) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  if (!entries.length) throw new PlannerError(400, 'Пока нет гостей с именами за столами — списку нечего показать');

  const header = posterHeader(data, pw, margin, k, 'Найдите своё место');
  const top = margin + header.height + 8 * k;
  const cols = paper === 'a1' ? 4 : 3;
  const gap = 18 * k;
  const colW = (pw - margin * 2 - gap * (cols - 1)) / cols;
  const bottom = ph - margin;

  // Запись при кегле s: имя слева на всю ширину колонки, стол справа на последней строке имени;
  // рядом не помещается («Молодожёны» у длинного имени) — отдельной строкой под именем, а не рвём имя
  const layout = (s: number) => entries.map((e) => {
    const lines = wrap(e.name, t.body, s, colW);
    const own = measure(lines[lines.length - 1], t.body, s) + s + measure(e.table, t.body, s) > colW;
    const tableLines = own ? wrap(e.table, t.body, s, colW) : [e.table];
    return { ...e, lines, own, tableLines, height: lines.length + (own ? tableLines.length : 0) };
  });
  type Laid = ReturnType<typeof layout>;
  // Сколько строк в колонке, чтобы записи (не разрываясь) легли в cols колонок поровну; 0 — не легли
  const rowsFor = (laid: Laid, perCol: number): number => {
    const total = laid.reduce((n, e) => n + e.height, 0);
    const longest = Math.max(...laid.map((e) => e.height));
    for (let target = Math.max(Math.ceil(total / cols), longest); target <= perCol; target++) {
      let col = 0, row = 0;
      for (const e of laid) {
        if (row + e.height > target) { col++; row = 0; }
        row += e.height;
      }
      if (col < cols) return target;
    }
    return 0;
  };
  // Кегль: самый крупный, при котором весь список на одном листе и имена почти не переносятся
  // («Анна / Иванова» читается хуже, чем то же имя чуть мельче). Так не выходит — самый крупный,
  // при котором список хотя бы на одном листе; не выходит и на 8k — несколько листов кеглем 9k.
  type Choice = { s: number; laid: Laid; rows: number };
  const allowedWraps = Math.max(1, Math.floor(entries.length / 20));
  let fitted: Choice | null = null, tidy: Choice | null = null;
  for (let half = 44; half >= 16; half--) {   // от 22k до 8k с шагом 0,5k
    const size = (half / 2) * k;
    const l = layout(size);
    const target = rowsFor(l, Math.floor((bottom - top) / (size * 1.45)));
    if (!target) continue;
    fitted ??= { s: size, laid: l, rows: target };
    if (size >= 10 * k && l.filter((e) => e.height > 1).length <= allowedWraps) { tidy = { s: size, laid: l, rows: target }; break; }
  }
  const multi = 9 * k;
  const { s, laid, rows } = tidy ?? fitted ?? { s: multi, laid: layout(multi), rows: Math.max(1, Math.floor((bottom - top) / (multi * 1.45))) };

  const lh = s * 1.45;
  const pages: Page[] = [{ items: [...header.items] }];
  let col = 0, row = 0;
  for (const e of laid) {
    if (row + e.height > rows && row > 0) { col++; row = 0; }
    if (col >= cols) { pages.push({ items: [...header.items] }); col = 0; row = 0; }
    const items = pages[pages.length - 1].items;
    const x = margin + col * (colW + gap);
    const yOf = (i: number) => top + (row + i) * lh + s;
    e.lines.forEach((l, i) => items.push(text(l, x, yOf(i), colW, s, t.body, t.ink, 'left')));
    const first = e.own ? e.lines.length : e.lines.length - 1;   // строка, где стоит стол
    e.tableLines.forEach((l, i) => items.push(text(l, x, yOf(first + i), colW, s, t.body, t.accent, 'right')));
    // Отточие от имени к столу: глазу легче пройти по строке
    const y = yOf(first);
    const from = e.own ? x + s : x + measure(e.lines[e.lines.length - 1], t.body, s) + s * 0.6;
    const to = x + colW - measure(e.tableLines[0], t.body, s) - s * 0.6;
    if (to - from > s * 1.5) items.push({ kind: 'line', x1: from, y1: y, x2: to, y2: y, color: t.soft, width: 0.9 * k, dash: [0.9 * k, 2.6 * k] });
    row += e.height;
  }
  return { title: 'Кто где сидит', size: PAPER[paper], pages };
}

/* ── Постраничный список: шапка на первой странице, перенос по высоте ─────────── */
class Flow {
  pages: Page[] = [];
  y = 0;
  constructor(private size: [number, number], private margin: number) { this.page(); }
  get items(): Item[] { return this.pages[this.pages.length - 1].items; }
  get width(): number { return this.size[0] - this.margin * 2; }
  get x(): number { return this.margin; }
  page(): void { this.pages.push({ items: [] }); this.y = this.margin; }
  /** Хватит ли места на h пунктов; нет — новая страница (и onBreak, например повтор заголовка). */
  need(h: number, onBreak?: () => void): void {
    if (this.y + h > this.size[1] - this.margin) { this.page(); onBreak?.(); }
  }
}

function docHeader(f: Flow, data: PrintData, title: string, note: string): void {
  const t = data.theme;
  const name = fit(clean(data.couple, t.heading), t.heading, { max: t.heading === 'script' ? 30 : 22, min: 12, width: f.width, lines: 1 });
  f.y += name.size;
  f.items.push(text(name.lines[0], f.x, f.y, f.width, name.size, t.heading, t.ink, 'left'));
  f.y += 18;
  f.items.push(text(clean([title, data.date].filter(Boolean).join(' · '), t.body), f.x, f.y, f.width, 11, t.body, t.accent, 'left'));
  if (note) { f.y += 14; f.items.push(text(note, f.x, f.y, f.width, 8.5, t.body, t.muted, 'left')); }
  f.y += 10;
  f.items.push({ kind: 'line', x1: f.x, y1: f.y, x2: f.x + f.width, y2: f.y, color: t.soft, width: 0.8 });
  f.y += 14;
}

/* ── Список «стол → гости» для организатора: A4, сколько угодно страниц ─────── */
export function listDoc(data: PrintData, opts: { diet: boolean }): Doc {
  const t = data.theme;
  const f = new Flow(PAPER.a4, mm(16));
  docHeader(f, data, 'Рассадка гостей', 'Для организатора и ведущего');
  const people = data.people.filter((p) => p.status !== 'no');
  const sections = [
    ...data.tables.map((table) => ({ title: `${table.title} · ${people.filter((p) => p.tableId === table.id).length} из ${table.capacity}`, list: people.filter((p) => p.tableId === table.id) })),
    { title: 'Без стола', list: people.filter((p) => !p.tableId || !data.tableById.has(p.tableId)) },
  ].filter((s) => s.list.length);
  if (!sections.length) throw new PlannerError(400, 'Список гостей пуст');

  // Рабочий документ: заголовки разделов — тем же шрифтом, что и список, рукописный тут мешает читать
  const size = 10, lh = size * 1.35;
  const nameW = f.width * 0.62, sideW = f.width * 0.36;
  for (const s of sections) {
    const title = clean(s.title, t.body);
    const head = () => {
      f.y += 4;
      f.items.push(text(title, f.x, f.y + 12, f.width, 13, t.body, t.accent, 'left'));
      f.y += 20;
    };
    f.need(20 + lh * 2);
    head();
    s.list.sort((a, b) => a.order - b.order).forEach((p, i) => {
      const flags = [p.isChild ? 'ребёнок' : '', p.status === 'maybe' ? 'пока не знает' : p.status === 'none' ? 'нет ответа' : ''].filter(Boolean).join(', ');
      const nameLines = wrap(clean(`${i + 1}. ${listName(p)}${flags ? ` (${flags})` : ''}`, t.body), t.body, size, nameW);
      const side = clean(p.menu || (p.menuReview ? 'блюдо: уточнить' : ''), t.body);
      const sideLines = side ? wrap(side, t.body, size, sideW) : [];
      const dietLines = opts.diet && p.diet ? wrap(clean(`ограничения: ${p.diet}`, t.body), t.body, size - 1, nameW) : [];
      const rows = Math.max(nameLines.length, sideLines.length) + dietLines.length;
      f.need(rows * lh + 4, () => { f.items.push(text(clean(`${s.title} (продолжение)`, t.body), f.x, f.y + 12, f.width, 13, t.body, t.accent, 'left')); f.y += 20; });
      nameLines.forEach((l, j) => f.items.push(text(l, f.x, f.y + size + j * lh, nameW, size, t.body, t.ink, 'left')));
      sideLines.forEach((l, j) => f.items.push(text(l, f.x + f.width - sideW, f.y + size + j * lh, sideW, size, t.body, t.muted, 'right')));
      const base = Math.max(nameLines.length, sideLines.length);
      dietLines.forEach((l, j) => f.items.push(text(l, f.x + 10, f.y + size + (base + j) * lh, nameW, size - 1, t.body, t.accent, 'left')));
      f.y += rows * lh + 4;
    });
    f.y += 8;
  }
  return { title: 'Рассадка гостей', size: PAPER.a4, pages: f.pages };
}

/* ── Сводка для ресторана: порции по столам ────────────────────────────────── */
export function summaryDoc(data: PrintData, opts: { diet: boolean }): Doc {
  const t = data.theme;
  const f = new Flow(PAPER.a4, mm(16));
  docHeader(f, data, 'Сводка для ресторана', 'Служебный документ: не для гостей. Считаются только ответившие «приду».');
  const yes = data.people.filter((p) => p.status === 'yes');
  const kids = yes.filter((p) => p.isChild).length;
  const maybe = data.people.filter((p) => p.status === 'maybe').length;
  const none = data.people.filter((p) => p.status === 'none').length;
  const line = (s: string, size = 11, color = t.ink) => {
    f.need(size * 1.5);
    f.items.push(text(clean(s, t.body), f.x, f.y + size, f.width, size, t.body, color, 'left'));
    f.y += size * 1.5;
  };
  line(`Придут: ${yes.length} (взрослых ${yes.length - kids}, детей ${kids})`, 13);
  if (maybe) line(`Пока не знают: ${maybe} — в расчёт не входят`, 10, t.muted);
  if (none) line(`Не ответили: ${none}`, 10, t.muted);
  f.y += 6;

  // Таблица: столы × варианты меню
  const cols = [...data.options.map((o) => o.label), 'Без выбора', 'Всего'];
  const firstW = f.width * 0.28;
  const colW = (f.width - firstW) / cols.length;
  const size = cols.length > 8 ? 7.5 : 9;
  const rowH = size * 2;
  const tableRows = [
    ...data.tables.map((table) => ({ title: table.title, list: yes.filter((p) => p.tableId === table.id) })),
    { title: 'Без стола', list: yes.filter((p) => !p.tableId || !data.tableById.has(p.tableId)) },
  ].filter((r) => r.list.length);
  const totals = { title: 'Итого', list: yes };
  const head = () => {
    const headLines = cols.map((c) => wrap(clean(c, t.body), t.body, size, colW - 4));
    const h = Math.max(...headLines.map((l) => l.length)) * size * 1.2 + 6;
    f.need(h + rowH);
    f.items.push(text('Стол', f.x, f.y + size, firstW, size, t.body, t.muted, 'left'));
    headLines.forEach((ls, i) => ls.forEach((l, j) => f.items.push(text(l, f.x + firstW + i * colW, f.y + size + j * size * 1.2, colW, size, t.body, t.muted))));
    f.y += h;
    f.items.push({ kind: 'line', x1: f.x, y1: f.y - 3, x2: f.x + f.width, y2: f.y - 3, color: t.soft, width: 0.6 });
  };
  head();
  for (const r of [...tableRows, totals]) {
    const titleLines = wrap(clean(r.title, t.body), t.body, size, firstW - 4);
    const h = Math.max(rowH, titleLines.length * size * 1.25 + 6);
    f.need(h, head);
    const isTotal = r === totals;
    titleLines.forEach((l, j) => f.items.push(text(l, f.x, f.y + size + j * size * 1.25, firstW, size, t.body, isTotal ? t.accent : t.ink, 'left')));
    const counts = [
      ...data.options.map((o) => r.list.filter((p) => p.menu === o.label).length),
      r.list.filter((p) => !p.menu).length,
      r.list.length,
    ];
    counts.forEach((c, i) => f.items.push(text(c ? String(c) : '—', f.x + firstW + i * colW, f.y + size, colW, size, t.body, c ? t.ink : t.muted)));
    f.y += h;
    f.items.push({ kind: 'line', x1: f.x, y1: f.y - 3, x2: f.x + f.width, y2: f.y - 3, color: t.soft, width: isTotal ? 0.8 : 0.3 });
  }

  if (opts.diet) {
    const withDiet = yes.filter((p) => p.diet);
    f.y += 12;
    f.need(40);
    f.items.push(text('Пищевые ограничения', f.x, f.y + 14, f.width, 14, t.body, t.ink, 'left'));
    f.y += 24;
    if (!withDiet.length) line('Никто из подтвердивших не указал ограничений.', 10, t.muted);
    for (const p of withDiet) {
      const where = p.tableId ? data.tableById.get(p.tableId)?.title ?? '' : 'без стола';
      const ls = wrap(clean(`${where} · ${listName(p)}: ${p.diet}`, t.body), t.body, 10, f.width);
      f.need(ls.length * 14 + 2);
      ls.forEach((l, j) => f.items.push(text(l, f.x, f.y + 10 + j * 14, f.width, 10, t.body, t.ink, 'left')));
      f.y += ls.length * 14 + 2;
    }
  }
  return { title: 'Сводка для ресторана', size: PAPER.a4, pages: f.pages };
}

/* ── Меню на стол: A5 или «на тарелку» 99×210 мм ───────────────────────────── */
export const MENU_TEXT_LIMIT = 3000;

/** Текст меню: строка с двоеточием на конце — заголовок раздела, пустая строка — отбивка. */
export function parseMenu(raw: string): { kind: 'head' | 'item' | 'space'; text: string }[] {
  return raw.replace(/\r/g, '').split('\n').map((l) => l.trim()).map((l) =>
    !l ? { kind: 'space' as const, text: '' } : /:$/.test(l) ? { kind: 'head' as const, text: l.replace(/:+$/, '').trim() } : { kind: 'item' as const, text: l });
}

export function menuDoc(data: PrintData, raw: string, size: Extract<PaperSize, 'a5' | 'dl'>): Doc {
  const t = data.theme;
  const [pw, ph] = PAPER[size];
  const lines = parseMenu(raw);
  if (!lines.some((l) => l.kind !== 'space')) throw new PlannerError(400, 'Напишите, что будет в меню');
  const margin = mm(12);
  const width = pw - margin * 2;

  const header = (items: Item[]): number => {
    let y = margin + mm(8);
    ornament(items, pw / 2, y, mm(30), t.accent);
    const title = t.heading === 'script' ? 44 : 30;
    y += title + 6;
    items.push(text('Меню', margin, y, width, title, t.heading, t.ink));
    const sub = fit(clean([data.couple, data.date].filter(Boolean).join(' · '), t.body), t.body, { max: 10, min: 7, width, lines: 2 });
    y += 18;
    sub.lines.forEach((l, i) => items.push(text(l, margin, y + i * sub.size * 1.3, width, sub.size, t.body, t.muted)));
    return y + sub.lines.length * sub.size * 1.3 + 14;
  };

  const measureAt = (s: number) => lines.map((l) => ({
    ...l,
    lines: l.kind === 'space' ? [] : wrap(clean(l.text, l.kind === 'head' ? t.heading : t.body), l.kind === 'head' ? t.heading : t.body, l.kind === 'head' ? s * 1.35 : s, width),
  }));
  const heightOf = (s: number, ls: ReturnType<typeof measureAt>) => ls.reduce((h, l) =>
    h + (l.kind === 'space' ? s * 0.9 : l.lines.length * (l.kind === 'head' ? s * 1.35 * 1.3 : s * 1.4) + (l.kind === 'head' ? s * 0.5 : 0)), 0);
  const probe: Item[] = [];
  const bodyTop = header(probe);
  const room = ph - margin - bodyTop;
  // Кегль: самый крупный, при котором меню на одной странице и ни одно блюдо не переносится
  // (иначе «blanc» один на строке); так не выходит — самый крупный, при котором хотя бы помещается
  const sizes = Array.from({ length: 15 }, (_, i) => 14 - i * 0.5);   // 14 … 7
  const at = new Map(sizes.map((size) => [size, measureAt(size)]));
  const fits = (size: number) => heightOf(size, at.get(size)!) <= room;
  const whole = (size: number) => at.get(size)!.every((l) => l.lines.length <= 1);
  const s = sizes.find((size) => size >= 9 && fits(size) && whole(size)) ?? sizes.find(fits) ?? 7;
  const laid = at.get(s)!;
  const total = heightOf(s, laid);

  const pages: Page[] = [];
  let items: Item[] = [];
  let y = 0;
  const newPage = () => { items = []; pages.push({ items }); y = header(items); };
  newPage();
  // Влезло на страницу — блюда чуть выше середины свободного места, а не прижаты к шапке
  if (total <= room) y += (room - total) * 0.4;
  for (const l of laid) {
    if (l.kind === 'space') { y += s * 0.9; continue; }
    const family = l.kind === 'head' ? t.heading : t.body;
    const fs = l.kind === 'head' ? s * 1.35 : s;
    const lh = l.kind === 'head' ? fs * 1.3 : fs * 1.4;
    if (y + l.lines.length * lh > ph - margin) newPage();
    if (l.kind === 'head') y += s * 0.5;
    l.lines.forEach((line) => { y += lh; items.push(text(line, margin, y - lh * 0.25, width, fs, family, l.kind === 'head' ? t.accent : t.ink)); });
  }
  return { title: 'Меню', size: PAPER[size], pages };
}

/* ── Бланки пожеланий: 4 открытки A6 на листе A4 ───────────────────────────── */
export function wishesDoc(data: PrintData): Doc {
  const t = data.theme;
  const [pw, ph] = PAPER.a4;
  const cw = pw / 2, ch = ph / 2;
  const items: Item[] = [];
  for (let i = 0; i < 4; i++) {
    const x = (i % 2) * cw, y = Math.floor(i / 2) * ch;
    const pad = mm(12), width = cw - pad * 2;
    ornament(items, x + cw / 2, y + mm(14), mm(30), t.accent);
    const title = fit('Пожелания молодожёнам', t.heading, { max: t.heading === 'script' ? 26 : 18, min: 10, width, lines: 2 });
    centered(items, title.lines, x + pad, width, y + mm(26), title.size, t.heading, t.ink);
    const couple = fit(clean(data.couple, t.body), t.body, { max: 11, min: 7, width, lines: 1 });
    items.push(text(couple.lines.join(' '), x + pad, y + mm(38), width, couple.size, t.body, t.accent));
    for (let r = 0; r < 9; r++) {
      const ly = y + mm(52) + r * mm(9.5);
      items.push({ kind: 'line', x1: x + pad, y1: ly, x2: x + cw - pad, y2: ly, color: t.soft, width: 0.6 });
    }
  }
  // Линии реза между открытками
  items.push({ kind: 'line', x1: cw, y1: mm(4), x2: cw, y2: ph - mm(4), color: CUT, width: 0.4, dash: [3, 3] });
  items.push({ kind: 'line', x1: mm(4), y1: ch, x2: pw - mm(4), y2: ch, color: CUT, width: 0.4, dash: [3, 3] });
  return { title: 'Бланки пожеланий', size: PAPER.a4, pages: [{ items }] };
}

/** Вариант меню по умолчанию для редактора текста: варианты из кабинета. */
export function defaultMenuText(data: PrintData): string {
  if (!data.options.length) return 'Закуски:\n\nГорячее:\n\nДесерт:\n';
  return ['Горячее на выбор:', ...data.options.map((o) => (o.note ? `${o.label} — ${o.note}` : o.label))].join('\n');
}
