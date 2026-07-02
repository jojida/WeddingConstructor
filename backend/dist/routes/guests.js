"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const plans_1 = require("../lib/plans");
const router = (0, express_1.Router)();
function genToken() {
    // короткий URL-безопасный токен для персональной ссылки ?g=
    return crypto_1.default.randomBytes(6).toString('base64url');
}
async function loadOwnedInvite(inviteId, userId) {
    const invite = await prisma_1.default.invitation.findUnique({ where: { id: inviteId } });
    if (!invite || invite.userId !== userId)
        return null;
    return invite;
}
// ── Публичный резолв персональной ссылки (для страницы приглашения) ──────────
// ВАЖНО: объявлен до /:inviteId, отдаёт только обращение/имя/статус — без утечки.
router.get('/resolve/:token', async (req, res) => {
    const guest = await prisma_1.default.guest.findUnique({ where: { token: req.params.token } });
    if (!guest)
        return res.status(404).json({ error: 'Гость не найден' });
    let attending = null;
    if (guest.responseId) {
        const r = await prisma_1.default.guestResponse.findUnique({ where: { id: guest.responseId } });
        if (r)
            attending = r.attending;
    }
    return res.json({
        greeting: (0, plans_1.computeGreeting)(guest.salutation, guest.names),
        names: guest.names,
        attending,
    });
});
// ── Список гостей приглашения (владелец) ─────────────────────────────────────
router.get('/:inviteId', auth_1.authMiddleware, async (req, res) => {
    const invite = await loadOwnedInvite(req.params.inviteId, req.userId);
    if (!invite)
        return res.status(404).json({ error: 'Приглашение не найдено' });
    const guests = await prisma_1.default.guest.findMany({
        where: { invitationId: invite.id },
        orderBy: { createdAt: 'asc' },
    });
    const responses = await prisma_1.default.guestResponse.findMany({
        where: { invitationId: invite.id, guestId: { not: null } },
    });
    const byGuest = new Map(responses.map((r) => [r.guestId, r]));
    const result = guests.map((g) => {
        const r = byGuest.get(g.id);
        return {
            id: g.id,
            token: g.token,
            salutation: g.salutation,
            names: g.names,
            greeting: (0, plans_1.computeGreeting)(g.salutation, g.names),
            responded: !!r,
            attending: r ? r.attending : null,
            drinkChoice: r ? r.drinkChoice : '',
            wishes: r ? r.wishes : '',
        };
    });
    return res.json({ advanced: (0, plans_1.isAdvanced)(invite.plan), guests: result });
});
// ── Добавить гостя (владелец, только продвинутый тариф) ──────────────────────
router.post('/:inviteId', auth_1.authMiddleware, async (req, res) => {
    const invite = await loadOwnedInvite(req.params.inviteId, req.userId);
    if (!invite)
        return res.status(404).json({ error: 'Приглашение не найдено' });
    if (!(0, plans_1.isAdvanced)(invite.plan)) {
        return res.status(403).json({ error: 'Кабинет гостей доступен на тарифах Стандарт и Премиум' });
    }
    const salutation = String(req.body.salutation || 'дорогие');
    const names = String(req.body.names || '').trim();
    if (!names)
        return res.status(400).json({ error: 'Укажите имя гостя' });
    if (!(0, plans_1.isSalutation)(salutation))
        return res.status(400).json({ error: 'Неверное обращение' });
    const guest = await prisma_1.default.guest.create({
        data: { invitationId: invite.id, token: genToken(), salutation, names },
    });
    return res.json({ ...guest, greeting: (0, plans_1.computeGreeting)(guest.salutation, guest.names), responded: false });
});
// ── Редактировать гостя ──────────────────────────────────────────────────────
router.put('/:guestId', auth_1.authMiddleware, async (req, res) => {
    const guest = await prisma_1.default.guest.findUnique({ where: { id: req.params.guestId } });
    if (!guest)
        return res.status(404).json({ error: 'Гость не найден' });
    const invite = await loadOwnedInvite(guest.invitationId, req.userId);
    if (!invite)
        return res.status(403).json({ error: 'Нет доступа' });
    const salutation = req.body.salutation != null ? String(req.body.salutation) : guest.salutation;
    const names = req.body.names != null ? String(req.body.names).trim() : guest.names;
    if (!(0, plans_1.isSalutation)(salutation))
        return res.status(400).json({ error: 'Неверное обращение' });
    if (!names)
        return res.status(400).json({ error: 'Укажите имя гостя' });
    const updated = await prisma_1.default.guest.update({
        where: { id: guest.id },
        data: { salutation, names },
    });
    return res.json({ ...updated, greeting: (0, plans_1.computeGreeting)(updated.salutation, updated.names) });
});
// ── Удалить гостя ────────────────────────────────────────────────────────────
router.delete('/:guestId', auth_1.authMiddleware, async (req, res) => {
    const guest = await prisma_1.default.guest.findUnique({ where: { id: req.params.guestId } });
    if (!guest)
        return res.status(404).json({ error: 'Гость не найден' });
    const invite = await loadOwnedInvite(guest.invitationId, req.userId);
    if (!invite)
        return res.status(403).json({ error: 'Нет доступа' });
    await prisma_1.default.guest.delete({ where: { id: guest.id } });
    return res.json({ success: true });
});
exports.default = router;
