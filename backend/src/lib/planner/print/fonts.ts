// Шрифты печати: те же файлы, что у печатных приглашений (backend/assets/print-fonts, лицензии
// там же). Кириллица и латиница с цифрами и знаками лежат в разных файлах, поэтому строка
// режется на куски, и каждый кусок печатается своим файлом.
import path from 'path';

const fontkit = require('fontkit') as { openSync(file: string): FontFile };
interface FontFile {
  unitsPerEm: number;
  ascent: number;
  hasGlyphForCodePoint(cp: number): boolean;
  layout(text: string, features?: string[]): { advanceWidth: number };
}

/** Цифры «по линейке» (lnum): у Cormorant по умолчанию старостильные — «1» как «ı», «3» ниже строки,
    а номер стола и счёт должны читаться сразу. Где такой возможности нет, она просто не включается. */
export const FEATURES = ['lnum'];

export type Family = 'serif' | 'script' | 'sans';

const FILES: Record<Family, { cyr: string; lat: string }> = {
  serif: { cyr: 'serif.woff', lat: 'serif-latin.woff' },          // Cormorant Garamond (OFL)
  script: { cyr: 'script-cyrillic.woff', lat: 'script-latin.woff' }, // Great Vibes (OFL)
  sans: { cyr: 'sans-cyrillic.woff', lat: 'sans-latin.woff' },       // Montserrat (OFL)
};

const dir = path.join(__dirname, '../../../../assets/print-fonts');
export const fontFile = (family: Family, cyr: boolean): string => path.join(dir, FILES[family][cyr ? 'cyr' : 'lat']);
export const pdfFontName = (family: Family, cyr: boolean): string => `${family}-${cyr ? 'cyr' : 'lat'}`;
export const FAMILIES: Family[] = ['serif', 'script', 'sans'];

const cache = new Map<string, FontFile>();
function open(family: Family, cyr: boolean): FontFile {
  const file = fontFile(family, cyr);
  let font = cache.get(file);
  if (!font) { font = fontkit.openSync(file); cache.set(file, font); }
  return font;
}

const CYRILLIC = /[Ѐ-ԯ№]/;   // кириллица и «№» — в кириллическом файле

/** Текст, который есть чем напечатать: буква, которой нет ни в одном файле, теряет диакритику
    (ş → s), а если и это не помогает — становится «?». Пустых квадратиков в PDF не будет. */
export function printable(text: string, family: Family): string {
  const cyr = open(family, true), lat = open(family, false);
  const has = (ch: string) => {
    const cp = ch.codePointAt(0) as number;
    return cyr.hasGlyphForCodePoint(cp) || lat.hasGlyphForCodePoint(cp);
  };
  let out = '';
  for (const ch of text.normalize('NFC')) {
    if (has(ch)) { out += ch; continue; }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out += base && [...base].every(has) ? base : '?';
  }
  return out;
}

export interface Run { text: string; cyr: boolean }

/** Куски строки по файлам шрифта. Пробел остаётся в куске перед ним, чтобы не дробить строку. */
export function runs(text: string): Run[] {
  const out: Run[] = [];
  for (const ch of text) {
    const last = out[out.length - 1];
    const cyr = ch === ' ' || ch === ' ' ? (last ? last.cyr : false) : CYRILLIC.test(ch);
    if (last && last.cyr === cyr) last.text += ch; else out.push({ text: ch, cyr });
  }
  return out;
}

// Ширина при кегле 1: подбор кегля и перенос меряют одни и те же куски строк десятки раз
const widths = new Map<string, number>();

/** Ширина строки в пунктах. */
export function measure(text: string, family: Family, size: number): number {
  const key = `${family}\u0000${text}`;
  let unit = widths.get(key);
  if (unit === undefined) {
    unit = runs(text).reduce((sum, r) => {
      const font = open(family, r.cyr);
      return sum + font.layout(r.text, FEATURES).advanceWidth / font.unitsPerEm;
    }, 0);
    if (widths.size > 50_000) widths.clear();
    widths.set(key, unit);
  }
  return unit * size;
}
