import crypto from 'crypto';
import { jwtSecret } from './security';

const ROUTE_TTL = 30 * 24 * 60 * 60_000;
const positiveId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const signature = (support: string, payload: string) => crypto.createHmac('sha256', jwtSecret())
  .update(`telegram-support:v1:${support}:${payload}`).digest('base64url');

/** The first line is server generated; display names and question text cannot route replies. */
export function supportRoute(support: string, recipient: number, messageId: number, now = Date.now()): string {
  if (!positiveId(recipient) || !positiveId(messageId)) throw new Error('Invalid Telegram route');
  const payload = `${recipient}.${messageId}.${Math.floor(now / 1000)}`;
  return `#wc1_${payload}.${signature(support, payload)}`;
}

export function supportRecipient(support: string, replied: unknown, now = Date.now()): number | null {
  if (!replied || typeof replied !== 'object') return null;
  const message = replied as { from?: { id?: unknown; is_bot?: unknown }; text?: unknown; caption?: unknown };
  const botId = Number((process.env.TELEGRAM_BOT_TOKEN || '').split(':')[0]);
  if (!positiveId(botId) || message.from?.id !== botId || message.from?.is_bot !== true) return null;
  const src = typeof message.text === 'string' ? message.text : typeof message.caption === 'string' ? message.caption : '';
  const match = /^#wc1_(\d{1,16})\.(\d{1,16})\.(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(src.split('\n', 1)[0]);
  if (!match) return null;
  const recipient = Number(match[1]), messageId = Number(match[2]), issuedAt = Number(match[3]) * 1000;
  if (!positiveId(recipient) || !positiveId(messageId) || issuedAt > now + 60_000 || now - issuedAt > ROUTE_TTL) return null;
  const expected = signature(support, `${match[1]}.${match[2]}.${match[3]}`);
  return crypto.timingSafeEqual(Buffer.from(match[4]), Buffer.from(expected)) ? recipient : null;
}

/** Bounded per-chat budget; capacity pressure never clears other users' limits. */
export function messageGate(limit: number, windowMs: number, ackMs = 0, capacity = 5000) {
  const entries = new Map<number, { count: number; until: number; ackAt: number }>();
  return (chatId: number, now = Date.now()): { ok: boolean; ack: boolean } => {
    let entry = entries.get(chatId);
    if (!entry || entry.until <= now) {
      if (!entry && entries.size >= capacity) {
        for (const [id, value] of entries) if (value.until <= now) entries.delete(id);
        if (entries.size >= capacity) return { ok: false, ack: false };
      }
      entry = { count: 0, until: now + windowMs, ackAt: -Infinity };
      entries.set(chatId, entry);
    }
    if (++entry.count > limit) return { ok: false, ack: false };
    const ack = now - entry.ackAt >= ackMs;
    if (ack) entry.ackAt = now;
    return { ok: true, ack };
  };
}
