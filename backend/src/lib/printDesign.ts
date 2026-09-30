import fs from 'fs';
import path from 'path';
// The same font metrics used by PDFKit keep long personal text inside the safe area.
const fontkit = require('fontkit') as { openSync(path: string): { unitsPerEm: number; layout(text: string): { advanceWidth: number } } };

export const PRINT_PRICE = 290;
export const PRINT_TEMPLATES = [
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
export type PrintData = Record<keyof typeof PRINT_FIELDS, string>;
export const PRINT_SAMPLE: PrintData = { groom: 'Александр', bride: 'Анастасия', date: '2027-06-19', time: '16:00', greeting: 'Дорогие родные и друзья!', message: 'Есть моменты, которые хочется разделить с самыми близкими. Приглашаем вас стать частью нашей истории и отпраздновать день нашей свадьбы.', venue: 'Усадьба «Архангельское»', address: 'Московская область, посёлок Архангельское', footer: 'С любовью и в ожидании встречи' };
export function validatePrintData(value: unknown): PrintData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Заполните данные приглашения');
  const output = {} as PrintData;
  for (const [key, max] of Object.entries(PRINT_FIELDS)) {
    const field = (value as Record<string, unknown>)[key];
    if (typeof field !== 'string' || field.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(field)) throw new Error(`Проверьте поле «${key}» (до ${max} символов)`);
    output[key as keyof PrintData] = field.trim();
  }
  if (!output.groom || !output.bride || !output.venue) throw new Error('Укажите имена и место торжества');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(output.date) || !Number.isFinite(Date.parse(output.date)) || new Date(output.date).toISOString().slice(0, 10) !== output.date) throw new Error('Укажите корректную дату');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(output.time)) throw new Error('Укажите время');
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
const artCache = new Map<string, string>();
function printImage(file: string, x: number, y: number, width: number, height: number) {
  if (!artCache.has(file)) artCache.set(file, fs.readFileSync(path.join(__dirname, '../../assets/print-art', file)).toString('base64'));
  return `<image x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${artCache.get(file)}"/>`;
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
  if (id === 'newspaper') {
    composition = rule(30, 31, 465) + `<g stroke="${t.ink}" stroke-width=".6">${box('СВАДЕБНЫЙ ВЕСТНИК', 30, 38, 465, 55, 43)}</g>`
      + rule(30, 99, 465) + box('СПЕЦВЫПУСК · ТОЛЬКО ХОРОШИЕ НОВОСТИ', 30, 105, 465, 19, 12) + rule(30, 131, 465)
      + `<g stroke="${t.accent}" stroke-width=".5">${box('ДА, МЫ ЖЕНИМСЯ!', 30, 140, 465, 58, 48, t.accent)}</g>`
      + box(`${data.groom} и ${data.bride}`, 30, 201, 465, 49, 29) + rule(30, 263, 465)
      + printImage('editorial-couple.jpg', 30, 279, 248, 304)
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
    composition = printImage('editorial-couple.jpg', 0, 0, 525, 740)
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
  if (composition) return `<svg xmlns="http://www.w3.org/2000/svg" width="${105 + bleed * 2}mm" height="${148 + bleed * 2}mm" viewBox="${-b} ${-b} ${525 + b * 2} ${740 + b * 2}">${embedFonts ? fontCss() : ''}<rect x="${-b}" y="${-b}" width="${525 + b * 2}" height="${740 + b * 2}" fill="${t.background}"/>${composition}${preview ? `<g transform="rotate(-32 262 370)"><rect x="-80" y="351" width="700" height="40" fill="${t.background}" opacity=".72"/><text x="262" y="377" text-anchor="middle" font-family="PrintLatin" font-size="21" letter-spacing="7" fill="${t.ink}" opacity=".35">WEDDINGCRAFT · PREVIEW</text></g>` : ''}</svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${105 + bleed * 2}mm" height="${148 + bleed * 2}mm" viewBox="${-b} ${-b} ${525 + b * 2} ${740 + b * 2}">${embedFonts ? fontCss() : ''}<rect x="${-b}" y="${-b}" width="${525 + b * 2}" height="${740 + b * 2}" fill="${t.background}"/>${art}${text('МЫ ЖЕНИМСЯ', 83, 14, 'letter-spacing="3"')}${text(data.groom, 225, nameSize)}${text('&', 269, 35)}${text(data.bride, 320, nameSize)}${paragraph(data.greeting, 373, 20, 42)}${paragraph(data.message, 417, 18, 130)}${text(date, 564, 25)}${text(`Начало в ${data.time}`, 594, 18)}${paragraph(data.venue, 624, 17, 35)}${paragraph(data.address, 663, 13, 32)}${paragraph(data.footer, 700, 13, 30)}${preview ? `<g transform="rotate(-32 262 370)"><rect x="-80" y="351" width="700" height="40" fill="${t.background}" opacity=".8"/><text x="262" y="377" text-anchor="middle" font-family="PrintLatin" font-size="21" letter-spacing="7" fill="${t.ink}" opacity=".35">WEDDINGCRAFT · PREVIEW</text></g>` : ''}</svg>`;
}
