import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const uploadsDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const formats: Record<string, { ext: string; kind: 'image' | 'audio'; valid: (b: Buffer) => boolean }> = {
  'image/jpeg': { ext: '.jpg', kind: 'image', valid: b => b[0] === 255 && b[1] === 216 && b[2] === 255 },
  'image/png': { ext: '.png', kind: 'image', valid: b => b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) },
  'image/gif': { ext: '.gif', kind: 'image', valid: b => /^GIF8[79]a/.test(b.toString('ascii', 0, 6)) },
  'image/webp': { ext: '.webp', kind: 'image', valid: b => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  'audio/mpeg': { ext: '.mp3', kind: 'audio', valid: b => b.toString('ascii', 0, 3) === 'ID3' || (b[0] === 255 && (b[1] & 224) === 224) },
  'audio/mp4': { ext: '.m4a', kind: 'audio', valid: b => b.toString('ascii', 4, 8) === 'ftyp' },
  'audio/ogg': { ext: '.ogg', kind: 'audio', valid: b => b.toString('ascii', 0, 4) === 'OggS' },
  'audio/wav': { ext: '.wav', kind: 'audio', valid: b => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE' },
  'audio/aac': { ext: '.aac', kind: 'audio', valid: b => b[0] === 255 && (b[1] & 246) === 240 },
  'audio/webm': { ext: '.webm', kind: 'audio', valid: b => b.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex')) },
};
formats['audio/mp3'] = formats['audio/mpeg'];
formats['audio/x-wav'] = formats['audio/wav'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, crypto.randomUUID() + formats[file.mimetype].ext),
});

function receive(kind: 'image' | 'audio', field: string, count: number) {
  const parser = multer({ storage,
    limits: { fileSize: (kind === 'image' ? 10 : 15) * 1024 * 1024, files: count, fields: 0, parts: count },
    fileFilter: (_req, file, cb) => {
      if (formats[file.mimetype]?.kind === kind) cb(null, true);
      else cb(new Error('Неподдерживаемый формат файла'));
    },
  });
  const middleware = count === 1 ? parser.single(field) : parser.array(field, count);
  return (req: Request, res: Response) => {
    middleware(req, res, async err => {
      const files = req.file ? [req.file] : (req.files as Express.Multer.File[] || []);
      const cleanup = () => Promise.all(files.map(f => fs.promises.unlink(f.path).catch(() => {})));
      try {
        if (err) {
          await cleanup();
          return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Файл слишком большой' : 'Неподдерживаемый файл или превышен лимит загрузки' });
        }
        if (!files.length) return res.status(400).json({ error: 'Файл не загружен' });
        for (const file of files) {
          const handle = await fs.promises.open(file.path, 'r');
          const bytes = Buffer.alloc(16);
          try { await handle.read(bytes, 0, bytes.length, 0); } finally { await handle.close(); }
          if (!formats[file.mimetype].valid(bytes)) {
            await cleanup();
            return res.status(400).json({ error: 'Содержимое файла не соответствует формату' });
          }
        }
        const urls = files.map(f => `/uploads/${f.filename}`);
        return res.json(count === 1 ? { url: urls[0] } : { urls });
      } catch {
        await cleanup();
        return res.status(500).json({ error: 'Ошибка загрузки файла' });
      }
    });
  };
}
// Anonymous uploads support the draft editor. The application applies a shared IP limit.
router.post('/image', receive('image', 'image', 1));
router.post('/gallery', authMiddleware, receive('image', 'images', 10));
router.post('/audio', receive('audio', 'audio', 1));
export default router;
