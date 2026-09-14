import crypto from 'crypto';

let developmentSecret: string | undefined;
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }
  return developmentSecret ??= crypto.randomBytes(32).toString('hex');
}
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : null;
}
export function hashCode(email: string, code: string): string {
  return crypto.createHmac('sha256', jwtSecret()).update(`${email}:${code}`).digest('hex');
}
export function telegramWebhookSecret(): string {
  return process.env.TELEGRAM_WEBHOOK_SECRET || crypto.createHmac('sha256', jwtSecret())
    .update('telegram-webhook').digest('hex');
}
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
