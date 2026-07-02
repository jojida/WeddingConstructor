"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const router = (0, express_1.Router)();
const email_1 = require("../lib/email");
// POST /api/auth/send-code
router.post('/send-code', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email)
            return res.status(400).json({ error: 'Укажите email' });
        // Генерируем 6-значный код
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут
        // Сохраняем код в БД
        await prisma_1.default.verificationCode.upsert({
            where: { email },
            update: { code, expiresAt },
            create: { email, code, expiresAt },
        });
        // Всегда выводим код в консоль для разработки и тестов
        console.log(`\n🔑 [AUTH CODE] Код для входа ${email}: ${code}\n`);
        // Отвечаем СРАЗУ — код уже сохранён в БД. Письмо шлём в фоне (best-effort),
        // чтобы медленный/заблокированный SMTP не подвешивал HTTP-запрос.
        res.json({ success: true, message: 'Код отправлен' });
        if ((0, email_1.isEmailConfigured)()) {
            (0, email_1.sendEmail)({
                to: email,
                subject: 'Код для входа — WeddingCraft',
                text: `Ваш код подтверждения: ${code}\nОн действителен 10 минут.`,
                html: `<p>Ваш код подтверждения:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p style="color:#777">Он действителен 10 минут.</p>`,
            })
                .then(() => console.log(`✉️  [AUTH CODE] письмо отправлено на ${email}`))
                .catch((err) => console.error('[AUTH CODE] Не удалось отправить письмо:', (err && err.message) || err));
        }
        return;
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Ошибка отправки кода' });
    }
});
// POST /api/auth/verify-code
router.post('/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code)
            return res.status(400).json({ error: 'Укажите email и код' });
        const verification = await prisma_1.default.verificationCode.findUnique({ where: { email } });
        if (!verification || verification.code !== code) {
            return res.status(401).json({ error: 'Неверный код' });
        }
        if (verification.expiresAt < new Date()) {
            return res.status(401).json({ error: 'Срок действия кода истек' });
        }
        // Удаляем использованный код
        await prisma_1.default.verificationCode.delete({ where: { email } });
        // Ищем или создаем пользователя
        let user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma_1.default.user.create({
                data: {
                    email,
                    name: email.split('@')[0], // Имя по умолчанию
                },
            });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
        return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});
// GET /api/auth/me
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer '))
            return res.status(401).json({ error: 'Не авторизован' });
        const token = authHeader.slice(7);
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
        const user = await prisma_1.default.user.findUnique({ where: { id: payload.userId } });
        if (!user)
            return res.status(404).json({ error: 'Пользователь не найден' });
        return res.json({ id: user.id, email: user.email, name: user.name });
    }
    catch {
        return res.status(401).json({ error: 'Неверный токен' });
    }
});
exports.default = router;
