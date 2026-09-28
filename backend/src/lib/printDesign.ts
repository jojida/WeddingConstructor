import fs from 'fs';
import path from 'path';
// The same font metrics used by PDFKit keep long personal text inside the safe area.
const fontkit = require('fontkit') as { openSync(path: string): { unitsPerEm: number; layout(text: string): { advanceWidth: number } } };

export const PRINT_PRICE = 290;
export const PRINT_TEMPLATES = [
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
function textWidth(s: string, size: number) {
  if (!measureFonts.length) measureFonts.push(fontkit.openSync(printFont()), fontkit.openSync(printFont(true)));
  return (s.match(/[\u0400-\u052f]+|[^\u0400-\u052f]+/g) || []).reduce((width, chunk) => {
    const font = measureFonts[/[\u0400-\u052f]/.test(chunk) ? 0 : 1];
    return width + font.layout(chunk).advanceWidth / font.unitsPerEm * size;
  }, 0);
}
function lines(s: string, maxWidth: number, size: number) {
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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${105 + bleed * 2}mm" height="${148 + bleed * 2}mm" viewBox="${-b} ${-b} ${525 + b * 2} ${740 + b * 2}">${embedFonts ? fontCss() : ''}<rect x="${-b}" y="${-b}" width="${525 + b * 2}" height="${740 + b * 2}" fill="${t.background}"/>${art}${text('МЫ ЖЕНИМСЯ', 83, 14, 'letter-spacing="3"')}${text(data.groom, 225, nameSize)}${text('&', 269, 35)}${text(data.bride, 320, nameSize)}${paragraph(data.greeting, 373, 20, 42)}${paragraph(data.message, 417, 18, 130)}${text(date, 564, 25)}${text(`Начало в ${data.time}`, 594, 18)}${paragraph(data.venue, 624, 17, 35)}${paragraph(data.address, 663, 13, 32)}${paragraph(data.footer, 700, 13, 30)}${preview ? `<g transform="rotate(-32 262 370)"><rect x="-80" y="351" width="700" height="40" fill="${t.background}" opacity=".8"/><text x="262" y="377" text-anchor="middle" font-family="PrintLatin" font-size="21" letter-spacing="7" fill="${t.ink}" opacity=".35">WEDDINGCRAFT · PREVIEW</text></g>` : ''}</svg>`;
}
