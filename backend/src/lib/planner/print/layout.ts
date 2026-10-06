// Модель печатной страницы: документ = страницы с элементами (текст, линии, рамки) в пунктах.
// Вёрстка отделена от PDF: тесты проверяют, что и где стоит, не разбирая сам PDF.
import { measure, printable, type Family } from './fonts';

export const mm = (v: number): number => (v * 72) / 25.4;

export const PAPER = {
  a4: [mm(210), mm(297)] as [number, number],
  a5: [mm(148), mm(210)] as [number, number],
  a3: [mm(297), mm(420)] as [number, number],
  a2: [mm(420), mm(594)] as [number, number],
  a1: [mm(594), mm(841)] as [number, number],
  dl: [mm(99), mm(210)] as [number, number],   // меню на тарелку
};
export type PaperSize = keyof typeof PAPER;

export type Align = 'left' | 'center' | 'right';

/** Текст: x и width — рамка для выравнивания, y — базовая линия. */
export interface TextItem { kind: 'text'; text: string; x: number; y: number; width: number; size: number; family: Family; color: string; align: Align; spacing?: number }
export interface LineItem { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number; dash?: [number, number] }
export interface RectItem { kind: 'rect'; x: number; y: number; w: number; h: number; stroke?: string; fill?: string; width?: number; dash?: [number, number] }
export interface DiamondItem { kind: 'diamond'; cx: number; cy: number; r: number; color: string }
/** Группа, развёрнутая на 180° вокруг точки: верхняя половина номера стола «домиком». */
export interface FlipItem { kind: 'flip'; cx: number; cy: number; items: Item[] }
export type Item = TextItem | LineItem | RectItem | DiamondItem | FlipItem;

export interface Page { items: Item[] }
export interface Doc { title: string; size: [number, number]; pages: Page[] }

/** Строки по ширине: перенос по словам; слово длиннее строки — по дефисам («Римский-Корсаков-»),
    и только если не помогло — по буквам. Текст не теряется. */
export function wrap(text: string, family: Family, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  const fits = (s: string) => measure(s, family, size) <= maxWidth;
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (fits(next)) { line = next; continue; }
    if (line) { out.push(line); line = ''; }
    if (fits(word)) { line = word; continue; }
    for (const part of word.split(/(?<=-)/)) {
      if (line && fits(line + part)) { line += part; continue; }
      if (line) { out.push(line); line = ''; }
      if (fits(part)) { line = part; continue; }
      for (const ch of part) {
        if (line && !fits(line + ch)) { out.push(line); line = ''; }
        line += ch;
      }
    }
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

/** Самый крупный кегль от max до min (шаг 0,5), при котором текст влезает в maxLines строк.
    Не влез и на min — остаётся min и столько строк, сколько нужно: обрезать нельзя. */
export function fit(text: string, family: Family, opts: { max: number; min: number; width: number; lines: number }): { size: number; lines: string[] } {
  for (let size = opts.max; size >= opts.min; size -= 0.5) {
    const lines = wrap(text, family, size, opts.width);
    if (lines.length <= opts.lines) return { size, lines };
  }
  return { size: opts.min, lines: wrap(text, family, opts.min, opts.width) };
}

/** Подготовить строку к печати (символы, которых нет в шрифте) и убрать лишние пробелы. */
export const clean = (text: string, family: Family): string => printable(text.replace(/\s+/g, ' ').trim(), family);

export function text(t: string, x: number, y: number, width: number, size: number, family: Family, color: string, align: Align = 'center', spacing?: number): TextItem {
  return { kind: 'text', text: t, x, y, width, size, family, color, align, spacing };
}
