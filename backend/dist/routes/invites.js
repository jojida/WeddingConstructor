"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Слова, которые нельзя использовать как slug, чтобы не конфликтовать
// с маршрутами фронтенда (weddingcraft.ru/<slug>).
const RESERVED_SLUGS = new Set([
    'api', 'auth', 'by-domain', 'dashboard', 'demo', 'editor', 'invite', 'payment',
    'templates', 'admin', 'login', 'register', 'signup', 'about', 'pricing', 'help',
    'static', 'assets', '_next', 'favicon', 'robots', 'sitemap', 'www', 'public', 'uploads',
]);
// Приватные поля приглашения — не отдавать в публичных ответах (by-slug/by-domain).
function stripPrivate(invite) {
    const { notifyChannel, notifyEmail, notifyTelegramChatId, telegramConnectToken, paymentId, ...pub } = invite;
    return pub;
}
function publicInvite(invite) {
    return {
        ...stripPrivate(invite),
        galleryPhotos: JSON.parse(invite.galleryPhotos || '[]'),
        schedule: JSON.parse(invite.schedule || '[]'),
        dressCodeColors: JSON.parse(invite.dressCodeColors || '[]'),
        enabledSections: JSON.parse(invite.enabledSections || '{}'),
        customData: JSON.parse(invite.customData || '{}'),
    };
}
function generateSlug(groomName, brideName) {
    const clean = (s) => s.toLowerCase()
        .replace(/[аА]/g, 'a').replace(/[бБ]/g, 'b').replace(/[вВ]/g, 'v')
        .replace(/[гГ]/g, 'g').replace(/[дД]/g, 'd').replace(/[еЕёЁ]/g, 'e')
        .replace(/[жЖ]/g, 'zh').replace(/[зЗ]/g, 'z').replace(/[иИ]/g, 'i')
        .replace(/[йЙ]/g, 'j').replace(/[кК]/g, 'k').replace(/[лЛ]/g, 'l')
        .replace(/[мМ]/g, 'm').replace(/[нН]/g, 'n').replace(/[оО]/g, 'o')
        .replace(/[пП]/g, 'p').replace(/[рР]/g, 'r').replace(/[сС]/g, 's')
        .replace(/[тТ]/g, 't').replace(/[уУ]/g, 'u').replace(/[фФ]/g, 'f')
        .replace(/[хХ]/g, 'h').replace(/[цЦ]/g, 'ts').replace(/[чЧ]/g, 'ch')
        .replace(/[шШ]/g, 'sh').replace(/[щЩ]/g, 'sch').replace(/[ъЪьЬ]/g, '')
        .replace(/[ыЫ]/g, 'y').replace(/[эЭ]/g, 'eh').replace(/[юЮ]/g, 'yu')
        .replace(/[яЯ]/g, 'ya').replace(/[^a-z0-9]/g, '');
    const g = clean(groomName) || 'groom';
    const b = clean(brideName) || 'bride';
    return `${g}-i-${b}-${(0, uuid_1.v4)().slice(0, 6)}`;
}
// GET /api/invites — список приглашений текущего пользователя
router.get('/', auth_1.authMiddleware, async (req, res) => {
    const invites = await prisma_1.default.invitation.findMany({
        where: { userId: req.userId },
        orderBy: { updatedAt: 'desc' },
    });
    res.json(invites);
});
// POST /api/invites — создать черновик
router.post('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const { templateId = 'classic' } = req.body;
        const slug = generateSlug('', '');
        const invite = await prisma_1.default.invitation.create({
            data: { userId: req.userId, templateId, slug },
        });
        res.json(invite);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Ошибка создания приглашения' });
    }
});
// PUT /api/invites/:id — обновить данные
router.put('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const invite = await prisma_1.default.invitation.findUnique({ where: { id: id } });
        if (!invite || invite.userId !== req.userId) {
            return res.status(404).json({ error: 'Приглашение не найдено' });
        }
        const { groomName, brideName, weddingDate, weddingTime, venue, venueAddress, mapLink, story, inviteText, dressCode, dressCodeColors, dressCodePhoto, schedule, coverPhoto, coverVideo, galleryPhotos, colorScheme, musicUrl, templateId, title, enabledSections, customData, } = req.body;
        // Slug стабилен: задаётся один раз при создании, далее меняется только
        // вручную через PATCH /:id/slug. Обновление данных адрес сайта НЕ меняет.
        const slug = invite.slug;
        const updated = await prisma_1.default.invitation.update({
            where: { id: id },
            data: {
                groomName, brideName, weddingDate, weddingTime, venue, venueAddress,
                mapLink, story, inviteText, dressCode, dressCodePhoto,
                dressCodeColors: dressCodeColors ? JSON.stringify(dressCodeColors) : undefined,
                coverPhoto, coverVideo,
                schedule: schedule ? JSON.stringify(schedule) : undefined,
                galleryPhotos: galleryPhotos ? JSON.stringify(galleryPhotos) : undefined,
                enabledSections: enabledSections ? JSON.stringify(enabledSections) : undefined,
                customData: customData !== undefined ? JSON.stringify(customData) : undefined,
                colorScheme, musicUrl, templateId, title, slug,
            },
        });
        return res.json(updated);
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Ошибка обновления' });
    }
});
// GET /api/invites/by-slug/:slug — получить для отображения (публично после оплаты)
// ВАЖНО: должен быть объявлен ДО /:id, иначе Express будет матчить "by-slug" как id
router.get('/by-slug/:slug', async (req, res) => {
    const invite = await prisma_1.default.invitation.findUnique({ where: { slug: req.params.slug } });
    if (!invite)
        return res.status(404).json({ error: 'Приглашение не найдено' });
    // Оплата временно отключена — сайт доступен сразу после создания.
    return res.json(publicInvite(invite));
});
// GET /api/invites/by-domain/:host — резолв привязанного домена клиента (MVP)
router.get('/by-domain/:host', async (req, res) => {
    const host = String(req.params.host || '').toLowerCase().replace(/^www\./, '');
    if (!host)
        return res.status(404).json({ error: 'Не найдено' });
    const invite = await prisma_1.default.invitation.findFirst({ where: { customDomain: host } });
    if (!invite)
        return res.status(404).json({ error: 'Домен не привязан' });
    // Оплата временно отключена — сайт доступен сразу.
    return res.json(publicInvite(invite));
});
// PATCH /api/invites/:id/settings — уведомления и свой домен (владелец)
router.patch('/:id/settings', auth_1.authMiddleware, async (req, res) => {
    const invite = await prisma_1.default.invitation.findUnique({ where: { id: req.params.id } });
    if (!invite || invite.userId !== req.userId)
        return res.status(404).json({ error: 'Не найдено' });
    const data = {};
    if (req.body.notifyChannel != null) {
        const ch = String(req.body.notifyChannel);
        if (!['none', 'telegram', 'email'].includes(ch))
            return res.status(400).json({ error: 'Неверный канал' });
        data.notifyChannel = ch;
    }
    if (req.body.notifyEmail != null)
        data.notifyEmail = String(req.body.notifyEmail).trim();
    if (req.body.customDomain != null) {
        data.customDomain = String(req.body.customDomain).trim().toLowerCase()
            .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    }
    const updated = await prisma_1.default.invitation.update({ where: { id: invite.id }, data });
    return res.json(stripPrivate(updated));
});
// PATCH /api/invites/:id/slug — задать «красивый» адрес сайта (weddingcraft.ru/<slug>)
router.patch('/:id/slug', auth_1.authMiddleware, async (req, res) => {
    const invite = await prisma_1.default.invitation.findUnique({ where: { id: req.params.id } });
    if (!invite || invite.userId !== req.userId)
        return res.status(404).json({ error: 'Не найдено' });
    const raw = String(req.body.slug || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(raw)) {
        return res.status(400).json({ error: 'Адрес: 3–40 символов, латиница, цифры и дефис (не с дефиса)' });
    }
    if (RESERVED_SLUGS.has(raw))
        return res.status(400).json({ error: 'Этот адрес зарезервирован, выберите другой' });
    const taken = await prisma_1.default.invitation.findUnique({ where: { slug: raw } });
    if (taken && taken.id !== invite.id)
        return res.status(409).json({ error: 'Этот адрес уже занят' });
    const updated = await prisma_1.default.invitation.update({ where: { id: invite.id }, data: { slug: raw } });
    return res.json({ slug: updated.slug });
});
// POST /api/invites/:id/telegram-connect — выдать deep-link для подключения Telegram
router.post('/:id/telegram-connect', auth_1.authMiddleware, async (req, res) => {
    const invite = await prisma_1.default.invitation.findUnique({ where: { id: req.params.id } });
    if (!invite || invite.userId !== req.userId)
        return res.status(404).json({ error: 'Не найдено' });
    let token = invite.telegramConnectToken;
    if (!token) {
        token = crypto_1.default.randomBytes(8).toString('base64url');
        await prisma_1.default.invitation.update({ where: { id: invite.id }, data: { telegramConnectToken: token } });
    }
    const username = process.env.TELEGRAM_BOT_USERNAME || '';
    return res.json({
        token,
        botUsername: username,
        deepLink: username ? `https://t.me/${username}?start=${token}` : '',
        connected: !!invite.notifyTelegramChatId,
    });
});
// GET /api/invites/:id — получить черновик (авторизованно)
router.get('/:id', auth_1.authMiddleware, async (req, res) => {
    const invite = await prisma_1.default.invitation.findUnique({ where: { id: req.params.id } });
    if (!invite || invite.userId !== req.userId) {
        return res.status(404).json({ error: 'Приглашение не найдено' });
    }
    return res.json({
        ...invite,
        galleryPhotos: JSON.parse(invite.galleryPhotos || '[]'),
        schedule: JSON.parse(invite.schedule || '[]'),
        dressCodeColors: JSON.parse(invite.dressCodeColors || '[]'),
        enabledSections: JSON.parse(invite.enabledSections || '{}'),
        customData: JSON.parse(invite.customData || '{}'),
    });
});
// DELETE /api/invites/:id
router.delete('/:id', auth_1.authMiddleware, async (req, res) => {
    const invite = await prisma_1.default.invitation.findUnique({ where: { id: req.params.id } });
    if (!invite || invite.userId !== req.userId) {
        return res.status(404).json({ error: 'Приглашение не найдено' });
    }
    await prisma_1.default.invitation.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
});
exports.default = router;
