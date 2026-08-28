import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Только изображения'));
  },
});

// Фоновая музыка: свой лимит (аудио тяжелее фото) и свой список форматов.
const AUDIO_MIME = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm'];
const uploadAudio = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (req, file, cb) => {
    if (AUDIO_MIME.includes(file.mimetype) || file.mimetype.startsWith('audio/')) cb(null, true);
    else cb(new Error('Только аудиофайлы (MP3, M4A, OGG, WAV)'));
  },
});

// POST /api/upload/image
router.post('/image', upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  const url = `/uploads/${req.file.filename}`;
  return res.json({ url });
});

// POST /api/upload/gallery — несколько фото
router.post('/gallery', authMiddleware, upload.array('images', 10), (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) return res.status(400).json({ error: 'Файлы не загружены' });
  const urls = files.map(f => `/uploads/${f.filename}`);
  return res.json({ urls });
});

// POST /api/upload/audio — фоновая мелодия приглашения
// Без authMiddleware — как и загрузка фото: редактор работает до регистрации.
router.post('/audio', (req: Request, res: Response) => {
  uploadAudio.single('audio')(req, res, (err: any) => {
    if (err) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({ error: tooBig ? 'Файл больше 15 MB' : (err.message || 'Ошибка загрузки') });
    }
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    return res.json({ url: `/uploads/${req.file.filename}` });
  });
});

export default router;
