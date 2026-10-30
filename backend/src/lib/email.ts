// Единая точка отправки писем.
// Хостер блокирует исходящий SMTP (порты 465/587), поэтому шлём через HTTP API
// почтового сервиса (порт 443). Поддержаны Resend и Brevo — задайте ключ того,
// который используете. Если ни один не задан — фолбэк на SMTP (локальная разработка).
// Приоритет: RESEND_API_KEY → BREVO_API_KEY → SMTP. Коды входа на российские
// почты — сначала через RuSender (см. sendViaRuSender).
import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';

const FROM_EMAIL = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@weddingcraft.ru';
const FROM_NAME = process.env.MAIL_FROM_NAME || 'WeddingCraft';
// Куда попадёт ответ пользователя на письмо (напр. на код). Ящик поддержки.
const REPLY_TO_EMAIL = process.env.MAIL_REPLY_TO || 'support@weddingcraft.ru';

const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const smtpTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.yandex.ru',
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // 465 → SSL, 587 → STARTTLS
  requireTLS: true,
  auth: { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Куда уйдёт ответ. По умолчанию — MAIL_REPLY_TO (ящик поддержки). */
  replyTo?: string;
  /** Доп. заголовки, например List-Unsubscribe у писем серии. */
  headers?: Record<string, string>;
  /** Код входа и личные письма владельца: на российские почты уходят через RuSender, если он настроен. */
  critical?: boolean;
  /** Отправитель вместо MAIL_FROM — личное письмо владельца от support@ (scripts/send-letter.cjs).
      Только адрес на нашем домене: RuSender и Brevo пропускают отправителей проверенного домена. */
  from?: { email: string; name?: string };
}

/* Mail.ru и Яндекс отклоняют или прячут часть писем Brevo: журнал Brevo 17.10.26 —
   mail.ru «550 spam message rejected», а с 10.10 из 9 человек с yandex.ru код так и
   не ввели 6. Поэтому коды входа на эти почты идут через RuSender — российский
   сервис с налаженной доставкой (RUSENDER_API_KEY — токен rs_ck_v1_… с правом
   external_mail.send, RUSENDER_KEY_ID — ID ключа отправки). Письма серии сюда не
   идут: они расходовали бы лимит тарифа и репутацию ключа, нужные кодам.
   Любая ошибка RuSender (лимит, неактивный ключ, сеть) — письмо уходит обычным
   путём, вход не ломается. */
const RU_MAILBOXES = new Set([
  'mail.ru', 'bk.ru', 'inbox.ru', 'list.ru', 'internet.ru',
  'yandex.ru', 'ya.ru', 'yandex.com', 'yandex.by', 'yandex.kz', 'yandex.ua', 'narod.ru',
  'rambler.ru', 'ro.ru', 'lenta.ru', 'autorambler.ru', 'myrambler.ru',
]);

async function sendViaRuSender(mail: Mail): Promise<boolean> {
  const token = process.env.RUSENDER_API_KEY;
  const keyId = process.env.RUSENDER_KEY_ID || '';
  const domain = mail.to.trim().toLowerCase().split('@')[1] || '';
  if (!token || !/^\d+$/.test(keyId) || !RU_MAILBOXES.has(domain)) return false;
  try {
    const res = await fetch(`https://api.rusender.ru/api/v1/external-mails/send/${keyId}`, {
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        idempotencyKey: randomUUID(),
        mail: {
          to: { email: mail.to },
          // Адрес отправителя обязан быть на домене ключа отправки, иначе RuSender ответит 404
          from: { email: mail.from?.email || process.env.RUSENDER_FROM || 'noreply@weddingcraft.ru', name: mail.from?.name || FROM_NAME },
          subject: mail.subject,
          text: mail.text,
          ...(mail.html ? { html: mail.html } : {}),
        },
      }),
    });
    await res.body?.cancel();
    if (res.ok) {
      console.log('✉️ Письмо отправлено через RuSender');
      return true;
    }
    console.error(`RuSender API ${res.status} — письмо уходит через основной сервис`);
  } catch {
    console.error('RuSender недоступен — письмо уходит через основной сервис');
  }
  return false;
}

/** true, если хоть какой-то способ отправки настроен. */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY || !!process.env.BREVO_API_KEY
    || !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Отправляет письмо. Бросает исключение при ошибке — вызывающий код обрабатывает best-effort. */
export async function sendEmail(mail: Mail): Promise<void> {
  if (mail.critical && await sendViaRuSender(mail)) return;

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${mail.from?.name || FROM_NAME} <${mail.from?.email || FROM_EMAIL}>`,
        to: [mail.to],
        reply_to: mail.replyTo || REPLY_TO_EMAIL,
        subject: mail.subject,
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
        ...(mail.headers ? { headers: mail.headers } : {}),
      }),
    });
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`Resend API ${res.status}`);
    }
    return;
  }

  const key = process.env.BREVO_API_KEY;
  if (key) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
      method: 'POST',
      headers: {
        'api-key': key,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: mail.from?.name || FROM_NAME, email: mail.from?.email || FROM_EMAIL },
        to: [{ email: mail.to }],
        replyTo: { email: mail.replyTo || REPLY_TO_EMAIL },
        subject: mail.subject,
        textContent: mail.text,
        ...(mail.html ? { htmlContent: mail.html } : {}),
        ...(mail.headers ? { headers: mail.headers } : {}),
      }),
    });
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`Brevo API ${res.status}`);
    }
    return;
  }

  // Фолбэк на SMTP (локальная разработка)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    await smtpTransport.sendMail({
      from: mail.from ? `"${mail.from.name || FROM_NAME}" <${mail.from.email}>`
        : process.env.SMTP_FROM || `"${FROM_NAME}" <${process.env.SMTP_USER}>`,
      to: mail.to,
      replyTo: mail.replyTo || REPLY_TO_EMAIL,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      headers: mail.headers,
    });
    return;
  }

  throw new Error('Email не настроен: задайте BREVO_API_KEY (или SMTP_USER/SMTP_PASS)');
}
