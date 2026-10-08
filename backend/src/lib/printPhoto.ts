import fs from 'fs';
import path from 'path';
import { uploadsDir } from './storage';

/** Only locally uploaded, normalized JPEGs; never URLs or caller-supplied paths. */
export function readPrintPhoto(value: string): Buffer {
  if (!/^\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i.test(value)) throw new Error('Загрузите фотографию через редактор');
  const file = path.join(uploadsDir, path.basename(value));
  if (!fs.existsSync(file) || fs.statSync(file).size > 10 * 1024 * 1024) throw new Error('Фотография недоступна. Загрузите её заново');
  const bytes = fs.readFileSync(file);
  if (bytes[0] !== 255 || bytes[1] !== 216) throw new Error('Неверный формат фотографии');
  let offset = 2;
  while (offset + 9 < bytes.length && bytes[offset] === 255) {
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      const h = bytes.readUInt16BE(offset + 5), w = bytes.readUInt16BE(offset + 7);
      if (w > 0 && h > 0 && w * h <= 24000000 && Math.max(w, h) <= 12000) return bytes;
      break;
    }
    offset += length + 2;
  }
  throw new Error('Фотографию не удалось прочитать. Загрузите другой файл');
}
