import fs from 'fs';
import path from 'path';
import { readPrintPhoto } from './printPhoto';
// The same font metrics used by PDFKit keep long personal text inside the safe area.
const fontkit = require('fontkit') as { openSync(path: string): { unitsPerEm: number; layout(text: string): { advanceWidth: number; glyphs: { path: { toSVG(): string } }[]; positions: { xAdvance: number; yAdvance: number; xOffset: number; yOffset: number }[] } } };

export const PRINT_PRICE = 290;
export const PRINT_TEMPLATES = [
  { id: 'azure-bloom', name: 'Голубая акварель', category: 'Романтика', background: '#eaf5fa', ink: '#112b3c', accent: '#3073ad' },
  { id: 'floral-gold', name: 'Цветы и золото', category: 'Романтика', background: '#fffefa', ink: '#0a131e', accent: '#b27409' },
  { id: 'newspaper', name: 'Свадебный вестник', category: 'Редакционный', background: '#f3eadb', ink: '#302d29', accent: '#874c41' },
  { id: 'petals', name: 'Шёпот лепестков', category: 'Романтика', background: '#f7efe9', ink: '#72534e', accent: '#b88d83' },
  { id: 'editorial', name: 'Наша история', category: 'Редакционный', background: '#f4f0e9', ink: '#302c29', accent: '#794247' },
  { id: 'boarding', name: 'Рейс в счастье', category: 'Путешествия', background: '#f6f0e4', ink: '#304d59', accent: '#b88565' },
  { id: 'vow', name: 'Тихое «да»', category: 'Минимализм', background: '#faf6ee', ink: '#444137', accent: '#a69676' },
  { id: 'olive', name: 'Оливковая ветвь', category: 'Ботаника', background: '#f6f6ee', ink: '#394b3a', accent: '#839375' },
  { id: 'arch', name: 'Нежная арка', category: 'Романтика', background: '#f0ded8', ink: '#714c4b', accent: '#c69a90' },
  { id: 'clay', name: 'Тёплая терракота', category: 'Минимализм', background: '#f7eee3', ink: '#843f32', accent: '#b96a4e' },
  { id: 'blue', name: 'Французский сад', category: 'Романтика', background: '#f3f5f7', ink: '#334d72', accent: '#8ca0b6' },
  { id: 'noir', name: 'Вечер в шёлке', category: 'Классика', background: '#24392f', ink: '#f7edda', accent: '#c3b18b' },
];
export const PRINT_FIELDS = { groom: 24, bride: 24, date: 10, time: 5, greeting: 55, message: 220, venue: 65, address: 90, footer: 75 };
export type PrintData = Record<keyof typeof PRINT_FIELDS, string> & { photo?: string; photoPosition?: string; photoFrame?: { x: number; y: number; z: number; r?: number } };
export const printSize = (id: string) => id === 'azure-bloom' ? { width: 148, height: 105 } : { width: 105, height: 148 };
export const PRINT_SAMPLE: PrintData = { groom: 'Александр', bride: 'Анастасия', date: '2027-06-19', time: '16:00', greeting: 'Дорогие родные и друзья!', message: 'Есть моменты, которые хочется разделить с самыми близкими. Приглашаем вас стать частью нашей истории и отпраздновать день нашей свадьбы.', venue: 'Усадьба «Архангельское»', address: 'Московская область, посёлок Архангельское', footer: 'С любовью и в ожидании встречи' };
export function getPrintSample(id: string): PrintData {
  const supplied: Record<string, Partial<PrintData>> = {
    olive: { groom: 'Андрей', bride: 'Мария', greeting: 'Дорогие родные и друзья!', message: 'Приглашаем вас на наше торжественное событие', footer: '' },
    blue: { groom: 'Кирилл', bride: 'Дарья', greeting: '', message: 'Разделите нашу радость — приглашаем вас на день рождения нашей семьи.', footer: 'Будем счастливы видеть вас!' },
    clay: { groom: 'Николай', bride: 'Анна', greeting: 'Дорогие родные и друзья!', message: 'Ждём вас на нашем тёплом семейном празднике.', footer: '' },
    arch: { groom: 'Борис', bride: 'Фрося', greeting: 'Дорогие гости!', message: 'Приглашаем вас на нашу свадьбу', footer: 'С любовью и в ожидании встречи' },
    vow: { groom: 'Евгений', bride: 'Надежда', greeting: '', message: 'Будем рады разделить этот день с вами.', footer: 'С любовью' },
    noir: { groom: 'Дмитрий', bride: 'Анна', greeting: '', message: 'Приглашаем вас разделить радость нашего особенного дня.', footer: '' },
  };
  if (supplied[id]) return { ...PRINT_SAMPLE, venue: 'Усадьба «Белый сад»', address: 'Москва, ул. Садовая, 12', ...supplied[id] };

  if (id === 'azure-bloom') return { ...PRINT_SAMPLE, groom: 'Себастьян', bride: 'Юлиана', date: '2027-05-23', time: '09:00', greeting: '', message: 'Приглашаем вас на нашу свадьбу', venue: 'Усадьба «Белый сад»', address: 'Москва, ул. Садовая, 12', footer: 'Праздник продолжится за ужином' };
  return id === 'floral-gold' ? { ...PRINT_SAMPLE, groom: 'Даниил', bride: 'Оливия', date: '2027-03-27', time: '09:00', greeting: '', message: 'Приглашаем вас разделить радость нашего свадебного торжества', venue: 'Усадьба «Белый сад»', address: 'Москва, ул. Садовая, 12', footer: '' } : PRINT_SAMPLE;
}
export function validatePrintData(value: unknown): PrintData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Заполните данные приглашения');
  const output = {} as PrintData;
  for (const [key, max] of Object.entries(PRINT_FIELDS)) {
    const field = (value as Record<string, unknown>)[key];
    if (typeof field !== 'string' || field.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(field)) throw new Error(`Проверьте поле «${key}» (до ${max} символов)`);
    output[key as keyof typeof PRINT_FIELDS] = field.trim();
  }
  if (!output.groom || !output.bride || !output.venue) throw new Error('Укажите имена и место торжества');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(output.date) || !Number.isFinite(Date.parse(output.date)) || new Date(output.date).toISOString().slice(0, 10) !== output.date) throw new Error('Укажите корректную дату');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(output.time)) throw new Error('Укажите время');
  const extra = value as Record<string, unknown>;
  if (extra.photoFrame !== undefined) {
    const f = extra.photoFrame as NonNullable<PrintData['photoFrame']>;
    if (!f || typeof f !== 'object' || ![f.x, f.y, f.z, f.r ?? 0].every(n => typeof n === 'number' && Number.isFinite(n)) || f.x < 0 || f.x > 100 || f.y < 0 || f.y > 100 || f.z < 1 || f.z > 4 || Math.abs(f.r ?? 0) > 180) throw new Error('Проверьте кадрирование фотографии');
    output.photoFrame = { x: f.x, y: f.y, z: f.z, r: f.r ?? 0 };
  }
  if (extra.photo !== undefined && extra.photo !== '') {
    if (typeof extra.photo !== 'string') throw new Error('Проверьте фотографию');
    readPrintPhoto(extra.photo);
    output.photo = extra.photo;
  }
  if (extra.photoPosition !== undefined) {
    if (typeof extra.photoPosition !== 'string' || !/^x(Min|Mid|Max)Y(Min|Mid|Max)$/.test(extra.photoPosition)) throw new Error('Проверьте положение фотографии');
    output.photoPosition = extra.photoPosition;
  }
  return output;
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
const fontsDir = path.join(__dirname, '../../assets/print-fonts');
export const printFont = (latin = false) => path.join(fontsDir, latin ? 'serif-latin.woff' : 'serif.woff');
let embeddedFonts = '';
function fontCss() {
  if (!embeddedFonts) embeddedFonts = `<style>@font-face{font-family:PrintCyr;src:url(data:font/woff;base64,${fs.readFileSync(printFont()).toString('base64')})}@font-face{font-family:PrintLatin;src:url(data:font/woff;base64,${fs.readFileSync(printFont(true)).toString('base64')})}</style>`;
  return embeddedFonts;
}
function spans(s: string) {
  return (s.match(/[\u0400-\u052f]+|[^\u0400-\u052f]+/g) || []).map(chunk => `<tspan font-family="${/[\u0400-\u052f]/.test(chunk) ? 'PrintCyr' : 'PrintLatin'}">${escape(chunk)}</tspan>`).join('');
}
const measureFonts: ReturnType<typeof fontkit.openSync>[] = [];
const decorativeFonts = new Map<string, ReturnType<typeof fontkit.openSync>>();
// Outlines preserve the supplied card's calligraphy identically in browsers/PDFs.
// Personalization still happens from editable order fields, never baked into art.
function outlinedText(value: string, x: number, baseline: number, width: number, size: number, family: 'script' | 'sans' | 'nickainley', color: string) {
  const runs = (value.match(/[\u0400-\u052f]+|[^\u0400-\u052f]+/g) || []).map(chunk => {
    const key = `${family}-${/[\u0400-\u052f]/.test(chunk) ? 'cyrillic' : 'latin'}`;
    if (!decorativeFonts.has(key)) decorativeFonts.set(key, fontkit.openSync(path.join(fontsDir, family === 'nickainley' ? 'nickainley.woff2' : `${key}.woff`)));
    const font = decorativeFonts.get(key)!;
    return { font, run: font.layout(chunk) };
  });
  const unitWidth = runs.reduce((sum, { font, run }) => sum + run.advanceWidth / font.unitsPerEm, 0);
  const fitted = Math.min(size, width / Math.max(unitWidth, 1));
  let cursor = x + (width - unitWidth * fitted) / 2;
  return `<g aria-label="${escape(value)}" fill="${color}">` + runs.map(({ font, run }) => {
    const scale = fitted / font.unitsPerEm;
    return run.glyphs.map((glyph, i) => {
      const pos = run.positions[i];
      const svg = `<path d="${glyph.path.toSVG()}" transform="translate(${cursor + pos.xOffset * scale} ${baseline - pos.yOffset * scale}) scale(${scale} ${-scale})"/>`;
      cursor += pos.xAdvance * scale;
      return svg;
    }).join('');
  }).join('') + '</g>';
}
const artCache = new Map<string, string>();
function printImage(file: string, x: number, y: number, width: number, height: number) {
  if (!artCache.has(file)) artCache.set(file, fs.readFileSync(path.join(__dirname, '../../assets/print-art', file)).toString('base64'));
  return `<image x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" href="data:image/${file.endsWith('.png') ? 'png' : 'jpeg'};base64,${artCache.get(file)}"/>`;
}
function photoImage(data: PrintData, fallback: string, x: number, y: number, width: number, height: number, clip?: string) {
  if (data.photo && data.photoFrame) {
    const bytes = readPrintPhoto(data.photo);
    let offset = 2;
    while (![0xc0, 0xc1, 0xc2].includes(bytes[offset + 1])) offset += bytes.readUInt16BE(offset + 2) + 2;
    const iw = bytes.readUInt16BE(offset + 7), ih = bytes.readUInt16BE(offset + 5);
    const f = data.photoFrame, angle = f.r || 0, th = angle * Math.PI / 180;
    const c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th));
    const bw = width * c + height * s, bh = width * s + height * c;
    const scale = Math.max(bw / iw, bh / ih) * f.z;
    const w = iw * scale, h = ih * scale;
    const left = -bw / 2 - (w - bw) * f.x / 100, top = -bh / 2 - (h - bh) * f.y / 100;
    return `<defs><clipPath id="personal-photo">${clip || `<rect x="${x}" y="${y}" width="${width}" height="${height}"/>`}</clipPath></defs><g clip-path="url(#personal-photo)"><g transform="translate(${x + width / 2} ${y + height / 2}) rotate(${angle})"><image x="${left}" y="${top}" width="${w}" height="${h}" preserveAspectRatio="none" href="data:image/jpeg;base64,${bytes.toString('base64')}"/></g></g>`;
  }
  const image = data.photo
    ? `<image x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${/^x(Min|Mid|Max)Y(Min|Mid|Max)$/.test(data.photoPosition || '') ? data.photoPosition : 'xMidYMid'} slice" href="data:image/jpeg;base64,${readPrintPhoto(data.photo).toString('base64')}"/>`
    : printImage(fallback, x, y, width, height);
  return clip ? `<defs><clipPath id="personal-photo">${clip}</clipPath></defs><g clip-path="url(#personal-photo)">${image}</g>` : image;
}
function textWidth(s: string, size: number) {
  if (!measureFonts.length) measureFonts.push(fontkit.openSync(printFont()), fontkit.openSync(printFont(true)));
  return (s.match(/[\u0400-\u052f]+|[^\u0400-\u052f]+/g) || []).reduce((width, chunk) => {
    const font = measureFonts[/[\u0400-\u052f]/.test(chunk) ? 0 : 1];
    return width + font.layout(chunk).advanceWidth / font.unitsPerEm * size;
  }, 0);
}
function lines(s: string, maxWidth: number, size: number): string[] {
  if (s.includes('\n')) return s.split('\n').flatMap(line => lines(line, maxWidth, size));
  const out: string[] = []; let line = '';
  for (const word of s.split(/\s+/)) {
    if (line && textWidth(`${line} ${word}`, size) > maxWidth) { out.push(line); line = ''; }
    if (textWidth(word, size) > maxWidth) {
      for (const character of word) {
        if (line && textWidth(line + character, size) > maxWidth) { out.push(line); line = ''; }
        line += character;
      }
    } else {
      line += (line ? ' ' : '') + word;
    }
  }
  if (line) out.push(line);
  return out;
}
/** Shared vector source for preview and PDF. Coordinate system: 5 units/mm; A6 trim. */
export function renderPrintSvg(id: string, data: PrintData, preview = true, embedFonts = true, bleed = 0) {
  const t = PRINT_TEMPLATES.find(t => t.id === id);
  if (!t) throw new Error('Шаблон не найден');
  const text = (value: string, y: number, size = 19, extra = '') => `<text x="262.5" y="${y}" text-anchor="middle" font-family="PrintCyr" font-size="${size}" fill="${t.ink}" ${extra}>${spans(value)}</text>`;
  const paragraph = (value: string, y: number, size: number, maxHeight: number) => {
    let wrapped = lines(value, 385, size);
    while (size > 10 && (wrapped.length - 1) * (size + 5) + size > maxHeight) { size--; wrapped = lines(value, 385, size); }
    return wrapped.map((line, i) => text(line, y + i * (size + 5), size)).join('');
  };
  const branch = (x: number, y: number, rotate: number) => `<g transform="translate(${x} ${y}) rotate(${rotate})" fill="none" stroke="${t.accent}" stroke-width="1.8"><path d="M0 0 Q-25 -62 0 -138"/>${[0, 1, 2, 3, 4].map(i => `<ellipse cx="${i % 2 ? 0 : -20}" cy="${-22 - i * 23}" rx="8" ry="19" transform="rotate(${i % 2 ? 28 : -30} ${i % 2 ? 0 : -20} ${-22 - i * 23})" fill="${t.accent}" fill-opacity=".25"/>`).join('')}</g>`;
  let art = '';
  if (id === 'vow') art = `<rect x="30" y="30" width="465" height="700" fill="none" stroke="${t.accent}" stroke-width="1"/><path d="M228 130H297" stroke="${t.accent}"/>`;
  if (id === 'olive') art = branch(95, 218, -28) + branch(430, 650, 152);
  if (id === 'arch') art = `<path d="M44 703V252A218 218 0 0 1 481 252V703Z" fill="#fbf6ef"/><path d="M58 690V252A204 204 0 0 1 467 252V690" fill="none" stroke="${t.accent}"/>`;
  if (id === 'clay') art = `<circle cx="490" cy="42" r="155" fill="${t.accent}" opacity=".17"/><path d="M-15 558Q150 520 153 755H-15Z" fill="${t.accent}" opacity=".22"/><path d="M40 130Q42 50 122 48" fill="none" stroke="${t.accent}" stroke-width="2"/>`;
  if (id === 'blue') art = `<rect x="24" y="24" width="477" height="706" rx="100" fill="none" stroke="${t.accent}"/><rect x="31" y="31" width="463" height="692" rx="95" fill="none" stroke="${t.accent}"/>` + branch(85, 187, -40) + branch(440, 553, 140);
  if (id === 'noir') art = `<rect x="27" y="27" width="471" height="703" fill="none" stroke="${t.accent}"/><path d="M210 135L262 100L315 135L262 170Z" stroke="${t.accent}" fill="none"/>`;
  const nameSize = Math.min(55, 390 / Math.max(textWidth(data.groom, 1), textWidth(data.bride, 1)));
  const date = new Date(data.date + 'T12:00:00Z').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const b = bleed * 5;
  // Editorial layouts share the same measured text, embedded artwork and PDF path.
  // Each field has a bounded box, including long unbroken names and addresses.
  const box = (value: string, x: number, y: number, width: number, height: number, initial = 18, color = t.ink, align = 'middle') => {
    let size = initial;
    let wrapped = lines(value, width, size);
    while (size > 7 && wrapped.length * size * 1.16 > height) { size -= .5; wrapped = lines(value, width, size); }
    return wrapped.map((line, i) => `<text x="${align === 'middle' ? x + width / 2 : x}" y="${y + size + i * size * 1.16}" text-anchor="${align === 'middle' ? 'middle' : 'start'}" font-size="${size}" fill="${color}">${spans(line)}</text>`).join('');
  };
  const rule = (x: number, y: number, width: number, color = t.ink) => `<path d="M${x} ${y}h${width}" stroke="${color}" stroke-width=".9"/>`;
  const numericDate = data.date.split('-').reverse().join('.');
  let composition = '';
  if (['blue', 'clay', 'arch', 'vow', 'noir', 'olive'].includes(id)) {
    composition = printImage(id + '-supplied.jpg', 0, 0, 525, 740);
    const name = (value: string, y: number, x: number, width: number, size: number, color: string, family: 'script' | 'nickainley' = 'script') => outlinedText(value, x, y, width, size, family, color);
    if (id === 'olive') {
      const ink = '#514f35';
      composition += box('ПРИГЛАШЕНИЕ\nНА СВАДЬБУ', 200, 72, 125, 32, 14, ink)
        + box(data.greeting, 75, 207, 375, 42, 26, ink)
        + box(data.message, 95, 259, 335, 70, 18, ink)
        + box('СВАДЬБА', 100, 346, 325, 28, 20, ink)
        + box(data.groom.toUpperCase(), 65, 393, 395, 65, 55, ink)
        + box('И ' + data.bride.toUpperCase(), 60, 461, 405, 65, 55, ink)
        + box(date + ' · ' + data.time, 70, 609, 385, 28, 21, ink)
        + box(data.venue, 80, 647, 365, 27, 18, ink)
        + box(data.address, 80, 677, 365, 23, 15, ink)
        + box(data.footer, 85, 707, 355, 20, 13, ink);
    }
    if (id === 'blue') {
      const ink = '#4d5785';
      composition += box('МЫ ОФИЦИАЛЬНО ЖЕНИМСЯ!', 145, 150, 270, 22, 13, ink)
        + name(data.groom, 245, 140, 275, 58, ink, 'nickainley')
        + name('+', 288, 140, 275, 34, ink, 'nickainley')
        + name(data.bride, 355, 140, 275, 58, ink, 'nickainley')
        + box(data.greeting, 150, 370, 260, 33, 17, ink)
        + box(data.message, 150, 409, 260, 67, 16, ink)
        + box(numericDate + ' · ' + data.time, 150, 479, 260, 26, 19, ink)
        + box(data.venue, 150, 510, 260, 29, 17, ink)
        + box(data.address, 150, 546, 255, 27, 13, ink)
        + box(data.footer, 150, 577, 245, 24, 12, ink);
    }
    if (id === 'clay') {
      composition += box(data.greeting, 80, 265, 365, 30, 17, '#534a40')
        + box('ПРИГЛАШАЕМ', 80, 305, 365, 45, 37, '#797c3e')
        + name('на нашу свадьбу', 390, 80, 365, 39, '#b07f69')
        + box(data.message, 125, 411, 280, 54, 16, '#534a40')
        + box(numericDate + ' · ' + data.time, 125, 475, 280, 24, 21, '#797c3e')
        + box(data.venue, 125, 507, 280, 28, 16, '#534a40')
        + box(data.address, 125, 540, 280, 30, 14, '#534a40')
        + name(data.bride + ' и ' + data.groom, 608, 170, 260, 32, '#b07f69')
        + box(data.footer, 155, 625, 230, 30, 12, '#797c3e');
    }
    if (id === 'arch') {
      const ink = '#916c87';
      composition += box(data.greeting, 115, 175, 290, 31, 18, ink)
        + box(data.message, 140, 214, 260, 48, 15, ink)
        + name(data.groom, 327, 110, 305, 60, ink, 'nickainley')
        + name('и ' + data.bride, 411, 110, 305, 60, ink, 'nickainley')
        + box(numericDate + ' · ' + data.time, 110, 443, 300, 26, 20, ink)
        + box(data.venue, 110, 481, 300, 32, 18, ink)
        + box(data.address, 110, 520, 300, 35, 15, ink)
        + box(data.footer, 115, 564, 285, 33, 15, ink);
    }
    if (id === 'vow') {
      const ink = '#6b4f2f';
      composition += box('ПРИГЛАШЕНИЕ\nНА СВАДЬБУ', 172, 100, 205, 44, 18, ink)
        + name(data.groom, 248, 100, 340, 65, ink)
        + name('&', 292, 100, 340, 43, ink)
        + name(data.bride, 360, 100, 340, 65, ink)
        + box(data.greeting, 150, 380, 280, 29, 17, ink)
        + box(new Date(data.date + 'T12:00:00Z').toLocaleDateString('ru-RU', {month:'long', timeZone:'UTC'}).toUpperCase(), 190, 426, 80, 18, 13, ink)
        + box(String(Number(data.date.slice(-2))), 285, 414, 65, 40, 34, ink)
        + box(data.time, 368, 426, 68, 18, 17, ink)
        + box(data.message, 200, 474, 245, 46, 14, ink)
        + box(data.venue, 224, 530, 220, 29, 16, ink)
        + box(data.address, 224, 566, 220, 32, 13, ink)
        + box(data.footer, 255, 608, 185, 32, 12, ink);
    }
    if (id === 'noir') {
      const ink = '#ffeda3';
      composition += box('ПРИГЛАШЕНИЕ НА СВАДЬБУ', 130, 79, 265, 39, 18, ink)
        + box(data.groom.charAt(0).toUpperCase(), 162, 153, 120, 120, 106, ink)
        + box(data.bride.charAt(0).toUpperCase(), 243, 195, 120, 110, 96, ink)
        + box(data.groom.toUpperCase() + ' & ' + data.bride.toUpperCase(), 100, 295, 325, 60, 27, ink)
        + box(data.greeting, 110, 365, 305, 24, 18, ink)
        + box(data.message, 110, 399, 305, 46, 16, ink)
        + box(date + ' · ' + data.time, 100, 454, 325, 24, 19, ink)
        + box(data.venue, 115, 486, 295, 24, 18, ink)
        + box(data.address, 120, 516, 285, 23, 14, ink)
        + box(data.footer, 125, 543, 275, 20, 13, ink);
    }
  }
  if (id === 'azure-bloom') {
    const day = new Date(data.date + 'T12:00:00Z');
    const small = (value: string, y: number, height: number, initial: number) => {
      let size = initial;
      let rows = lines(value, 270, size);
      while (size > 8 && rows.length * size * 1.25 > height) { size -= .5; rows = lines(value, 270, size); }
      return rows.map((row, i) => outlinedText(row, 48, y + size + i * size * 1.25, 350, size, 'sans', t.ink)).join('');
    };
    composition = printImage('azure-base.jpg', 0, 0, 740, 525)
      + photoImage(data, 'azure-photo.jpg', 439.3, 49.6, 256.4, 422.2, '<path d="M439.3 472V180A128.2 130.4 0 0 1 695.7 180V472Z"/>')
      + printImage('azure-overlay.png', 0, 0, 740, 525)
      + outlinedText(data.bride, 77, 111, 292, 53, 'script', t.accent)
      + outlinedText('и', 105, 157, 235, 40, 'script', '#79a8ce')
      + outlinedText(data.groom, 62, 213, 322, 53, 'script', t.accent)
      + small(data.greeting, 230, 24, 13)
      + small(data.message, 259, 41, 17)
      + outlinedText(day.toLocaleDateString('ru-RU', { month: 'long', timeZone: 'UTC' }).toUpperCase(), 172, 322, 101, 15, 'sans', t.ink)
      + outlinedText(day.toLocaleDateString('ru-RU', { weekday: 'long', timeZone: 'UTC' }).toUpperCase(), 38, 337, 90, 11, 'sans', t.ink)
      + outlinedText(String(day.getUTCDate()), 185, 351, 75, 32, 'sans', t.ink)
      + outlinedText(data.time, 279, 337, 95, 14, 'sans', t.ink)
      + outlinedText(String(day.getUTCFullYear()), 187, 378, 72, 15, 'sans', t.ink)
      + small(data.venue, 392, 27, 16) + small(data.address, 423, 24, 13)
      + outlinedText(data.footer, 83, 480, 320, 25, 'script', t.accent);
  }
  if (id === 'floral-gold') {
    const copy = (value: string, x: number, y: number, width: number, height: number, initial: number) => {
      let size = initial;
      let rows = lines(value, width * .76, size);
      while (size > 8 && rows.length * size * 1.25 > height) { size -= .5; rows = lines(value, width * .76, size); }
      return rows.map((row, i) => outlinedText(row, x, y + size + i * size * 1.25, width, size, 'sans', t.ink)).join('');
    };
    const day = new Date(data.date + 'T12:00:00Z');
    const month = day.toLocaleDateString('ru-RU', { month: 'long', timeZone: 'UTC' }).toUpperCase();
    const weekday = day.toLocaleDateString('ru-RU', { weekday: 'long', timeZone: 'UTC' }).toUpperCase();
    composition = printImage('gold-base.jpg', 0, 0, 525, 740)
      + photoImage(data, 'gold-photo.jpg', 136.6, 48.4, 261.9, 262.2, '<ellipse cx="267.55" cy="179.5" rx="130.95" ry="131.1"/>')
      + printImage('gold-overlay.png', 0, 0, 525, 740)
      + outlinedText(`${data.groom} и ${data.bride}`, 62, 429, 401, 55, 'script', t.accent)
      + copy(data.greeting, 85, 442, 355, 19, 12)
      + copy(data.message, 85, 464, 355, 52, 17)
      + outlinedText(month, 205, 535, 115, 20, 'sans', t.ink)
      + outlinedText(weekday, 91, 581, 98, 14, 'sans', t.ink)
      + outlinedText(data.time, 339, 581, 88, 19, 'sans', t.ink)
      + outlinedText(String(day.getUTCDate()), 207, 599, 111, 51, 'sans', t.ink)
      + outlinedText(String(day.getUTCFullYear()), 222, 630, 81, 18, 'sans', t.ink)
      + copy(data.venue, 98, 649, 329, 24, 13)
      + copy(data.address, 98, 678, 329, 22, 12)
      + copy(data.footer, 114, 707, 297, 16, 9);
  }
  if (id === 'newspaper') {
    composition = rule(30, 31, 465) + `<g stroke="${t.ink}" stroke-width=".6">${box('СВАДЕБНЫЙ ВЕСТНИК', 30, 38, 465, 55, 43)}</g>`
      + rule(30, 99, 465) + box('СПЕЦВЫПУСК · ТОЛЬКО ХОРОШИЕ НОВОСТИ', 30, 105, 465, 19, 12) + rule(30, 131, 465)
      + `<g stroke="${t.accent}" stroke-width=".5">${box('ДА, МЫ ЖЕНИМСЯ!', 30, 140, 465, 58, 48, t.accent)}</g>`
      + box(`${data.groom} и ${data.bride}`, 30, 201, 465, 49, 29) + rule(30, 263, 465)
      + photoImage(data, 'editorial-couple.jpg', 30, 279, 248, 304)
      + box('СОБЫТИЕ ГОДА', 296, 279, 199, 22, 15, t.accent, 'start')
      + box(numericDate, 296, 307, 199, 40, 30, t.ink, 'start') + rule(296, 356, 199)
      + box(data.greeting, 296, 367, 199, 50, 20, t.ink, 'start')
      + box(data.message, 296, 424, 199, 153, 16, t.ink, 'start')
      + rule(30, 599, 465) + box(`ЖДЁМ ВАС В ${data.time}`, 30, 608, 465, 25, 18, t.accent)
      + box(data.venue, 30, 641, 465, 25, 18) + box(data.address, 30, 671, 465, 22, 13)
      + rule(30, 701, 465) + box(data.footer, 30, 705, 465, 19, 12);
  }
  if (id === 'petals') {
    composition = printImage('petals.jpg', -b, -b, 525 + b * 2, 740 + b * 2)
      + `<rect x="77" y="89" width="371" height="633" rx="170" fill="#fff8f2" opacity=".9"/><rect x="87" y="99" width="351" height="613" rx="160" fill="none" stroke="#c5a59a" stroke-width=".6"/>`
      + box('РАСЦВЕТАЕТ НОВАЯ ИСТОРИЯ', 95, 105, 335, 21, 13)
      + box('Два сердца.\nОдно обещание.', 100, 146, 325, 85, 35)
      + rule(211, 241, 103, t.accent)
      + box(data.groom, 86, 260, 353, 44, 39) + box('&', 100, 305, 325, 29, 24, t.accent)
      + box(data.bride, 86, 338, 353, 44, 39)
      + box(data.greeting, 105, 399, 315, 37, 18)
      + box(data.message, 105, 441, 315, 78, 16)
      + box(numericDate, 95, 531, 335, 47, 39)
      + box(`НАЧАЛО В ${data.time}`, 105, 582, 315, 23, 14)
      + box(data.venue, 100, 614, 325, 30, 17)
      + box(data.address, 100, 648, 325, 27, 13)
      + box(data.footer, 100, 690, 325, 25, 13);
  }
  if (id === 'editorial') {
    composition = photoImage(data, 'editorial-couple.jpg', 0, 0, 525, 740)
      + `<defs><linearGradient id="coverFade" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0" stop-color="#f4f0e9" stop-opacity=".55"/><stop offset=".55" stop-color="#f4f0e9" stop-opacity=".92"/><stop offset="1" stop-color="#f4f0e9"/></linearGradient></defs><rect x="0" y="448" width="525" height="292" fill="url(#coverFade)"/>`
      + box('TOGETHER', 24, 16, 477, 91, 80, t.accent)
      + rule(28, 111, 469, t.accent) + box('THE WEDDING ISSUE', 28, 119, 469, 19, 13, t.accent)
      + box('НАША\nЛЮБОВЬ —\nНАША\nИСТОРИЯ', 31, 166, 126, 114, 24, t.ink, 'start')
      + box(numericDate, 358, 168, 138, 27, 21, t.accent)
      + box('ОСОБЕННЫЙ ВЫПУСК', 363, 201, 133, 39, 13, t.accent)
      + box(`${data.groom} & ${data.bride}`, 30, 466, 465, 80, 38, t.accent, 'start')
      + box(data.greeting, 30, 551, 465, 25, 18, t.ink, 'start')
      + box(data.message, 30, 582, 465, 49, 14, t.ink, 'start')
      + rule(30, 640, 465, t.accent)
      + box(`${data.time} · ${data.venue}`, 30, 648, 465, 26, 17, t.ink, 'start')
      + box(data.address, 30, 678, 465, 20, 13, t.ink, 'start')
      + box(data.footer, 30, 706, 465, 19, 12, t.accent, 'start');
  }
  if (id === 'boarding') {
    composition = `<rect x="364" y="0" width="161" height="740" fill="#e5e8e4"/><rect x="364" y="0" width="161" height="107" fill="${t.ink}"/><path d="M365 15V725" stroke="${t.accent}" stroke-dasharray="3 6"/><path d="M408 57l27-4 22-22 8 2-13 22 27 7-1 5-29-2-10 18-6-1 3-20-28-1z" fill="#f6f0e4"/>`
      + box('ПОСАДОЧНЫЙ', 24, 27, 315, 38, 29) + box('на новую жизнь', 24, 68, 315, 35, 27, t.accent)
      + box('ВМЕСТЕ · В ЛЮБУЮ ТОЧКУ МИРА', 24, 113, 315, 20, 11)
      + printImage('porthole.jpg', 28, 150, 311, 330)
      + box('ДАТА ОТПРАВЛЕНИЯ', 28, 491, 311, 18, 12)
      + box(numericDate, 28, 512, 311, 40, 34)
      + rule(30, 561, 307, t.accent)
      + box(`${data.time} · ${data.venue}`, 30, 572, 307, 44, 19)
      + box(data.address, 30, 621, 307, 34, 14)
      + `<rect x="0" y="675" width="364" height="65" fill="${t.ink}"/>`
      + box(data.footer, 28, 689, 309, 35, 15, '#f6f0e4')
      + box('ПАССАЖИРЫ', 379, 124, 128, 23, 13)
      + box(data.groom, 380, 160, 125, 49, 25) + box('&', 380, 213, 125, 25, 22, t.accent)
      + box(data.bride, 380, 243, 125, 49, 25) + rule(383, 309, 119, t.accent)
      + box(data.greeting, 382, 324, 121, 54, 17)
      + box(data.message, 382, 389, 121, 177, 14)
      + rule(383, 580, 119, t.accent) + box('КЛАСС: ЛЮБОВЬ', 380, 597, 125, 20, 12)
      + `<g fill="${t.ink}">${Array.from({ length: 39 }, (_, i) => `<rect x="${383 + i * 3}" y="636" width="${i % 3 === 0 ? 2 : 1}" height="42"/>`).join('')}</g>`
      + box('БИЛЕТ В СЧАСТЬЕ', 379, 696, 128, 20, 12);
  }
  const page = printSize(id);
  if (composition) return `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width + bleed * 2}mm" height="${page.height + bleed * 2}mm" viewBox="${-b} ${-b} ${page.width * 5 + b * 2} ${page.height * 5 + b * 2}">${embedFonts ? fontCss() : ''}<rect x="${-b}" y="${-b}" width="${page.width * 5 + b * 2}" height="${page.height * 5 + b * 2}" fill="${t.background}"/>${composition}${preview ? `<g transform="rotate(-32 262 370)"><rect x="-80" y="351" width="700" height="40" fill="${t.background}" opacity=".72"/><text x="262" y="377" text-anchor="middle" font-family="PrintLatin" font-size="21" letter-spacing="7" fill="${t.ink}" opacity=".35">WEDDINGCRAFT · PREVIEW</text></g>` : ''}</svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${105 + bleed * 2}mm" height="${148 + bleed * 2}mm" viewBox="${-b} ${-b} ${525 + b * 2} ${740 + b * 2}">${embedFonts ? fontCss() : ''}<rect x="${-b}" y="${-b}" width="${525 + b * 2}" height="${740 + b * 2}" fill="${t.background}"/>${art}${text('МЫ ЖЕНИМСЯ', 83, 14, 'letter-spacing="3"')}${text(data.groom, 225, nameSize)}${text('&', 269, 35)}${text(data.bride, 320, nameSize)}${paragraph(data.greeting, 373, 20, 42)}${paragraph(data.message, 417, 18, 130)}${text(date, 564, 25)}${text(`Начало в ${data.time}`, 594, 18)}${paragraph(data.venue, 624, 17, 35)}${paragraph(data.address, 663, 13, 32)}${paragraph(data.footer, 700, 13, 30)}${preview ? `<g transform="rotate(-32 262 370)"><rect x="-80" y="351" width="700" height="40" fill="${t.background}" opacity=".8"/><text x="262" y="377" text-anchor="middle" font-family="PrintLatin" font-size="21" letter-spacing="7" fill="${t.ink}" opacity=".35">WEDDINGCRAFT · PREVIEW</text></g>` : ''}</svg>`;
}
