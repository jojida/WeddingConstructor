"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const notify_1 = require("../lib/notify");
const router = (0, express_1.Router)();
const DRINK_LABELS = {
    wine: '🍷 Вино',
    champagne: '🥂 Шампанское',
    juice: '🧃 Сок',
    water: '💧 Вода',
    no_alcohol: '🚫 Без алкоголя',
    other: '🍹 Другое',
};
// POST /api/rsvp/:slug — публичная отправка анкеты гостем
router.post('/:slug', async (req, res) => {
    const slug = req.params.slug;
    try {
        const invite = await prisma_1.default.invitation.findUnique({ where: { slug } });
        if (!invite)
            return res.status(404).json({ error: 'Приглашение не найдено' });
        if (invite.status === 'draft')
            return res.status(403).json({ error: 'Приглашение ещё не активно' });
        const { guestName, attending, drinkChoice, wishes, guestToken } = req.body;
        // Персональная ссылка (продвинутый тариф): связываем ответ с гостем.
        let guest = null;
        if (guestToken) {
            guest = await prisma_1.default.guest.findUnique({ where: { token: String(guestToken) } });
            if (guest && guest.invitationId !== invite.id)
                guest = null; // токен от другого приглашения
        }
        const finalName = (guestName && String(guestName).trim()) || (guest ? guest.names : '');
        if (!finalName)
            return res.status(400).json({ error: 'Укажите ваше имя' });
        const response = await prisma_1.default.guestResponse.create({
            data: {
                invitationId: invite.id,
                guestId: guest ? guest.id : null,
                guestName: finalName,
                attending: attending !== false,
                drinkChoice: drinkChoice || '',
                wishes: wishes || '',
            },
        });
        if (guest) {
            await prisma_1.default.guest.update({ where: { id: guest.id }, data: { responseId: response.id } });
        }
        // Уведомление владельцу по выбранному каналу (best-effort, не блокирует ответ)
        (0, notify_1.notifyOwner)(invite, {
            guestName: finalName,
            attending: attending !== false,
            drinkChoice: drinkChoice || '',
            wishes: wishes || '',
        });
        return res.json({ success: true, id: response.id });
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Ошибка сохранения ответа' });
    }
});
// GET /api/rsvp/:invitationId — список ответов (только для владельца)
router.get('/:invitationId', auth_1.authMiddleware, async (req, res) => {
    const invitationId = req.params.invitationId;
    const invite = await prisma_1.default.invitation.findUnique({ where: { id: invitationId } });
    if (!invite || invite.userId !== req.userId) {
        return res.status(403).json({ error: 'Нет доступа' });
    }
    const responses = await prisma_1.default.guestResponse.findMany({
        where: { invitationId },
        orderBy: { createdAt: 'desc' },
    });
    const stats = {
        total: responses.length,
        attending: responses.filter(r => r.attending).length,
        notAttending: responses.filter(r => !r.attending).length,
        drinks: responses.reduce((acc, r) => {
            if (r.attending && r.drinkChoice) {
                acc[r.drinkChoice] = (acc[r.drinkChoice] || 0) + 1;
            }
            return acc;
        }, {}),
    };
    return res.json({ responses, stats, drinkLabels: DRINK_LABELS });
});
exports.default = router;
