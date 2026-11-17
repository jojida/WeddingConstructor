import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { uploadsDir } from './storage';
import { PRINT_MAX_SIDE, WEB_MAX_SIDE } from './uploadImage';

/* Разовое сжатие фото, загруженных до 17.11.26: тогда сервер хранил их в исходном
   размере (до 24 Мп / 10 МБ), и каждый гость качал оригиналы целиком.

   Берём только фото длиннее 2400 px и уменьшаем до 2000 px (как новые загрузки).
   Печатные фото (редактор открыток сам ужимает их до 2400 px) и вырезки «Убрать
   фон» (≤1800 px) под порог не попадают. Файл заменяется на месте под тем же
   именем: ссылки в приглашениях не меняются, а формат остаётся тем же, что в
   расширении. Оригинал остаётся в uploads/.originals — наружу он не отдаётся
   (/uploads отдаёт только имена верхнего уровня, точки в начале запрещены).
   Когда проход закончен, пишем отметку .compressed-v1 и больше не повторяем;
   прерванный перезапуском проход просто начинается заново и пропускает то, что
   уже сжато. */

const MARKER = '.compressed-v1';
const BACKUP = '.originals';
const SERVED = /^[a-z0-9][a-z0-9_-]*\.(?:jpg|png|webp)$/i;
const FORMAT_OF_EXT: Record<string, string> = { '.jpg': 'jpeg', '.png': 'png', '.webp': 'webp' };

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function readHead(file: string, bytes: number): Promise<Buffer> {
  const handle = await fs.promises.open(file, 'r');
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** Shrinks one stored photo in place; returns the bytes saved (0 — left as is). */
export async function compressStoredUpload(dir: string, name: string): Promise<number> {
  const file = path.join(dir, name);
  const stat = await fs.promises.stat(file);
  if (!stat.isFile()) return 0;
  // Header first: almost every stored file is already small enough.
  let meta: sharp.Metadata;
  try {
    meta = await sharp(await readHead(file, 512 * 1024), { failOn: 'none' }).metadata();
  } catch {
    meta = await sharp(await fs.promises.readFile(file), { failOn: 'none' }).metadata();
  }
  const format = FORMAT_OF_EXT[path.extname(name).toLowerCase()];
  if (meta.format !== format || (meta.pages || 1) > 1) return 0;
  if (Math.max(meta.width || 0, meta.height || 0) <= PRINT_MAX_SIDE) return 0;

  const input = await fs.promises.readFile(file);
  const still = sharp(input, { limitInputPixels: 50_000_000, failOn: 'none' })
    .rotate().resize({ width: WEB_MAX_SIDE, height: WEB_MAX_SIDE, fit: 'inside', withoutEnlargement: true });
  const output = format === 'jpeg' ? await still.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
    : format === 'png' ? await still.png({ compressionLevel: 9 }).toBuffer()
    : await still.webp(meta.hasAlpha ? { quality: 90, alphaQuality: 100 } : { quality: 82 }).toBuffer();
  if (output.length > input.length * 0.9) return 0;
  const check = await sharp(output).metadata();
  if (check.format !== format || Math.max(check.width || 0, check.height || 0) > WEB_MAX_SIDE) return 0;

  const backup = path.join(dir, BACKUP);
  await fs.promises.mkdir(backup, { recursive: true });
  const kept = path.join(backup, name);
  if (!fs.existsSync(kept)) {
    // A hard link keeps the original without copying it; copy where links fail.
    try { await fs.promises.link(file, kept); } catch { await fs.promises.copyFile(file, kept); }
  }
  const temp = path.join(dir, '.' + name + '.tmp');
  await fs.promises.writeFile(temp, output);
  // rename() replaces the file atomically: a guest never gets a half-written photo.
  await fs.promises.rename(temp, file);
  return input.length - output.length;
}

export interface CompressionResult { checked: number; compressed: number; savedBytes: number }

/** One pass over the uploads folder; null when the pass was already completed. */
export async function compressStoredUploads(dir = uploadsDir, { pauseMs = 400 } = {}): Promise<CompressionResult | null> {
  const marker = path.join(dir, MARKER);
  if (fs.existsSync(marker)) return null;
  const names = await fs.promises.readdir(dir);
  // Leftovers of a pass interrupted mid-write.
  await Promise.all(names.filter(name => /^\..+\.tmp$/.test(name))
    .map(name => fs.promises.unlink(path.join(dir, name)).catch(() => {})));
  const result: CompressionResult = { checked: 0, compressed: 0, savedBytes: 0 };
  for (const name of names.filter(n => SERVED.test(n))) {
    result.checked++;
    try {
      const saved = await compressStoredUpload(dir, name);
      if (saved > 0) {
        result.compressed++;
        result.savedBytes += saved;
        // One photo at a time with a pause: the API keeps serving guests.
        await sleep(pauseMs);
      }
    } catch (error) {
      console.error('Сжатие загрузок: файл пропущен:', name, (error as Error).message);
    }
    if (result.checked % 50 === 0) await sleep(10);
  }
  await fs.promises.writeFile(marker, JSON.stringify({ finishedAt: new Date().toISOString(), ...result }));
  return result;
}

/** Runs the pass once, some minutes after start, so it never competes with a
    deploy's frontend build (the VPS has 1 GB). UPLOAD_COMPRESSION=on|off overrides
    the production-only default. */
export function startUploadCompression(): void {
  const flag = (process.env.UPLOAD_COMPRESSION || '').toLowerCase();
  if (flag === 'off') return;
  if (flag !== 'on' && process.env.NODE_ENV !== 'production') return;
  const timer = setTimeout(() => {
    compressStoredUploads()
      .then(result => {
        if (result) console.log(`🗜 Сжатие загрузок: проверено ${result.checked}, сжато ${result.compressed}, `
          + `меньше на ${(result.savedBytes / 1048576).toFixed(1)} МБ (оригиналы — uploads/.originals)`);
      })
      .catch(error => console.error('Сжатие загрузок не удалось:', (error as Error).message));
  }, 10 * 60_000);
  timer.unref();
}
