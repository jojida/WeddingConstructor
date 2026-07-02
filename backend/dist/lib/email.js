"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEmailConfigured = isEmailConfigured;
exports.sendEmail = sendEmail;
// Единая точка отправки писем.
// Хостер блокирует исходящий SMTP (порты 465/587), поэтому шлём через HTTP API
// почтового сервиса (порт 443). Поддержаны Resend и Brevo — задайте ключ того,
// который используете. Если ни один не задан — фолбэк на SMTP (локальная разработка).
// Приоритет: RESEND_API_KEY → BREVO_API_KEY → SMTP.
const nodemailer_1 = __importDefault(require("nodemailer"));
const FROM_EMAIL = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@weddingcraft.ru';
const FROM_NAME = process.env.MAIL_FROM_NAME || 'WeddingCraft';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const smtpTransport = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST || 'smtp.yandex.ru',
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // 465 → SSL, 587 → STARTTLS
    auth: { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
});
/** true, если хоть какой-то способ отправки настроен. */
function isEmailConfigured() {
    return !!process.env.RESEND_API_KEY || !!process.env.BREVO_API_KEY
        || !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}
/** Отправляет письмо. Бросает исключение при ошибке — вызывающий код обрабатывает best-effort. */
async function sendEmail(mail) {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: `${FROM_NAME} <${FROM_EMAIL}>`,
                to: [mail.to],
                subject: mail.subject,
                text: mail.text,
                ...(mail.html ? { html: mail.html } : {}),
            }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Resend API ${res.status}: ${body.slice(0, 300)}`);
        }
        return;
    }
    const key = process.env.BREVO_API_KEY;
    if (key) {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'api-key': key,
                'Content-Type': 'application/json',
                accept: 'application/json',
            },
            body: JSON.stringify({
                sender: { name: FROM_NAME, email: FROM_EMAIL },
                to: [{ email: mail.to }],
                subject: mail.subject,
                textContent: mail.text,
                ...(mail.html ? { htmlContent: mail.html } : {}),
            }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Brevo API ${res.status}: ${body.slice(0, 300)}`);
        }
        return;
    }
    // Фолбэк на SMTP (локальная разработка)
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        await smtpTransport.sendMail({
            from: process.env.SMTP_FROM || `"${FROM_NAME}" <${process.env.SMTP_USER}>`,
            to: mail.to,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
        });
        return;
    }
    throw new Error('Email не настроен: задайте BREVO_API_KEY (или SMTP_USER/SMTP_PASS)');
}
