"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEmailConfigured = isEmailConfigured;
exports.sendEmail = sendEmail;
// Единая точка отправки писем.
// Приоритет — Brevo HTTP API (https, порт 443): хостер блокирует исходящий SMTP,
// поэтому обычный nodemailer/SMTP с этого сервера не работает. Если BREVO_API_KEY
// не задан (напр. локальная разработка) — падаем обратно на SMTP.
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
    return !!process.env.BREVO_API_KEY || !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}
/** Отправляет письмо. Бросает исключение при ошибке — вызывающий код обрабатывает best-effort. */
async function sendEmail(mail) {
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
