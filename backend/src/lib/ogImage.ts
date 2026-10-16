// Картинка превью ссылки на сайт-приглашение (og:image) — 1200×630 JPEG, как ждут Telegram,
// WhatsApp и ВКонтакте. Пара загрузила своё фото на обложку — оно, обрезанное по лицам.
// Иначе — карточка «Свадьба · имена · дата» в цветах шаблона: стоковые фото шаблонов в превью
// не годятся, это чужие люди. Текст — кривыми из печатных шрифтов, системные шрифты не нужны.
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { measure, outline, printable, type Family } from './planner/print/fonts';
import { russianDate } from './planner/print/data';
import { uploadsDir } from './storage';

const W = 1200, H = 630;

interface Palette { bg: string; ink: string; accent: string }
const PALETTES: Record<string, Palette> = {
  vitrage:          { bg: '#eaf1fa', ink: '#2a3b55', accent: '#556f95' },
  calla:            { bg: '#f3f1ec', ink: '#3a3631', accent: '#9c8f7a' },
  angels:           { bg: '#f2f6fb', ink: '#3d4a5c', accent: '#b8935a' },
  tenderness:       { bg: '#f6efe9', ink: '#4a3b32', accent: '#b08968' },
  forest:           { bg: '#eef2ea', ink: '#2f3a2c', accent: '#6b7d5a' },
  'garden-evening': { bg: '#f6efe4', ink: '#3b3127', accent: '#b07b4f' },
  'garden-arch':    { bg: '#f1f4ee', ink: '#2f3a2c', accent: '#6b7d5a' },
  floral:           { bg: '#f8f1f1', ink: '#3a2a2e', accent: '#b07784' },
  ivory:            { bg: '#f8f4ec', ink: '#2b2622', accent: '#a4844f' },
  sketch:           { bg: '#f5f1ea', ink: '#2b2622', accent: '#8a6f5a' },
  vadimdarya:       { bg: '#f3efe8', ink: '#2b2622', accent: '#a4844f' },
};
const DEFAULT_PALETTE: Palette = { bg: '#f7f2ea', ink: '#2b2622', accent: '#a4844f' };

export interface OgInvite { groomName: string; brideName: string; weddingDate: string; templateId: string; coverPhoto: string }

const UPLOADED = /^\/uploads\/([0-9a-f-]{36}\.(?:jpe?g|png|webp))$/i;

/** Своё фото пары на обложке — файл из загрузок, иначе null (пример шаблона своим не считается). */
export function ownCoverFile(cover: string): string | null {
  const m = UPLOADED.exec(cover || '');
  if (!m) return null;
  const file = path.join(uploadsDir, m[1]);
  return fs.existsSync(file) ? file : null;
}

/** Строка по центру: кривые, сдвинутые так, чтобы середина пришлась на cx. */
function centered(text: string, family: Family, size: number, baseline: number, fill: string, spacing = 0, opacity = 1): string {
  const { d, width } = outline(printable(text, family), family, size, spacing);
  if (!d) return '';
  return `<path d="${d}" fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''} transform="translate(${(W / 2 - width / 2).toFixed(1)} ${baseline})"/>`;
}

const ornament = (y: number, half: number, color: string): string =>
  `<line x1="${W / 2 - half}" y1="${y}" x2="${W / 2 - 12}" y2="${y}" stroke="${color}" stroke-width="1.6"/>`
  + `<rect x="${W / 2 - 5}" y="${y - 5}" width="10" height="10" fill="${color}" transform="rotate(45 ${W / 2} ${y})"/>`
  + `<line x1="${W / 2 + 12}" y1="${y}" x2="${W / 2 + half}" y2="${y}" stroke="${color}" stroke-width="1.6"/>`;

/** Имена: одной строкой, а не влезли — в две («Григорий &» / «Александра»). Самый крупный кегль, что влезает. */
function namesLines(groom: string, bride: string): { lines: string[]; size: number } {
  const both = [groom, bride].filter(Boolean);
  const one = both.join(' & ') || 'Наша свадьба';
  const fits = (s: string, size: number) => measure(printable(s, 'script'), 'script', size) <= 1000;
  for (let size = 118; size >= 70; size -= 4) if (fits(one, size)) return { lines: [one], size };
  const two = both.length === 2 ? [`${groom} &`, bride] : [one];
  for (let size = 100; size >= 44; size -= 4) if (two.every((l) => fits(l, size))) return { lines: two, size };
  return { lines: two, size: 44 };
}

// Эмодзи в имени шрифтом не напечатать — выбрасываем, а не рисуем «?»
const plainName = (s: string): string => (s || '').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();

export function cardSvg(invite: OgInvite): string {
  const p = PALETTES[invite.templateId] ?? DEFAULT_PALETTE;
  const { lines, size } = namesLines(plainName(invite.groomName), plainName(invite.brideName));
  const date = russianDate(invite.weddingDate);
  // Блок «имена + дата» по вертикали — между верхним орнаментом (190) и нижней рамкой
  const lh = size * 1.08;
  const namesTop = date ? 248 : 268;
  const first = namesTop + (lines.length === 1 ? 92 : 70) + (lines.length === 1 ? (118 - size) * 0.3 : 0);
  const names = lines.map((l, i) => centered(l, 'script', size, first + i * lh, p.ink)).join('');
  const dateBase = first + (lines.length - 1) * lh + 112;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<rect width="${W}" height="${H}" fill="${p.bg}"/>`
    + `<rect x="34" y="34" width="${W - 68}" height="${H - 68}" fill="none" stroke="${p.accent}" stroke-opacity="0.55" stroke-width="1.6"/>`
    + `<rect x="46" y="46" width="${W - 92}" height="${H - 92}" fill="none" stroke="${p.accent}" stroke-opacity="0.25" stroke-width="1"/>`
    + centered('СВАДЬБА', 'serif', 30, 140, p.accent, 9)
    + ornament(178, 120, p.accent)
    + names
    + (date ? centered(date, 'serif', 40, dateBase, p.ink, 1, 0.8) : '')
    + '</svg>';
}

// Уже нарисованные картинки: превью открывают много гостей, а меняется оно редко
const cache = new Map<string, Buffer>();

export async function ogImage(invite: OgInvite): Promise<Buffer> {
  const own = ownCoverFile(invite.coverPhoto);
  const key = JSON.stringify([invite.groomName, invite.brideName, invite.weddingDate, invite.templateId, own ? invite.coverPhoto : '']);
  const hit = cache.get(key);
  if (hit) return hit;
  const jpg = own
    ? await sharp(own).rotate().resize(W, H, { fit: 'cover', position: sharp.strategy.attention }).jpeg({ quality: 84, mozjpeg: true }).toBuffer()
    : await sharp(Buffer.from(cardSvg(invite))).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  if (cache.size >= 200) cache.delete(cache.keys().next().value as string);
  cache.set(key, jpg);
  return jpg;
}
