"use strict";
// Тарифы и общие хелперы продукта.
//
// Функциональных уровня два:
//   • простой      — basic            (сайт + RSVP + уведомления)
//   • продвинутый  — standard|premium (+ кабинет гостей, персональные ссылки, свой домен)
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdvanced = isAdvanced;
exports.isPaid = isPaid;
exports.isSalutation = isSalutation;
exports.computeGreeting = computeGreeting;
/** Продвинутый тариф: доступны кабинет гостей и персональные ссылки. */
function isAdvanced(plan) {
    return plan === 'standard' || plan === 'premium';
}
/** Оплачен ли тариф (доступны уведомления, свой домен и т.п.). */
function isPaid(status) {
    return status === 'paid' || status === 'published';
}
const SALUTATIONS = ['дорогой', 'дорогая', 'дорогие', 'семья'];
function isSalutation(s) {
    return SALUTATIONS.includes(s);
}
function capitalizeFirst(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
/**
 * Персональное обращение к гостю:
 *   семья  → «Семья Кореловых»
 *   иначе  → «Дорогой Денис» / «Дорогая Мария» / «Дорогие Денис и Мария»
 */
function computeGreeting(salutation, names) {
    const n = (names || '').trim();
    if (salutation === 'семья')
        return n ? `Семья ${n}` : 'Семья';
    return `${capitalizeFirst(salutation || 'дорогие')} ${n}`.trim();
}
