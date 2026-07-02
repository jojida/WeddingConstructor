"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Ensure uploads directory exists
const uploadsDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadsDir))
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        cb(null, `${(0, uuid_1.v4)()}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/'))
            cb(null, true);
        else
            cb(new Error('Только изображения'));
    },
});
// POST /api/upload/image
router.post('/image', upload.single('image'), (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: 'Файл не загружен' });
    const url = `/uploads/${req.file.filename}`;
    return res.json({ url });
});
// POST /api/upload/gallery — несколько фото
router.post('/gallery', auth_1.authMiddleware, upload.array('images', 10), (req, res) => {
    const files = req.files;
    if (!files || files.length === 0)
        return res.status(400).json({ error: 'Файлы не загружены' });
    const urls = files.map(f => `/uploads/${f.filename}`);
    return res.json({ urls });
});
exports.default = router;
