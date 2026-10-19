// Бот MAX — второй бесплатный канал напоминаний гостям (первый — Telegram, lib/telegram.ts).
//
// Бот один на весь сервис. Владелец заводит его на business.max.ru (нужен проверенный
// профиль ИП или самозанятого, бот проходит модерацию) и кладёт в .env MAX_BOT_TOKEN —
// имя бота и вебхук настраиваются сами при старте сервера.
//
// API: https://dev.max.ru/docs-api. Здесь учтены его грабли:
//  • токен — в заголовке Authorization как есть, без «Bearer»;
//  • личный диалог адресуется по user_id, а не по chat_id;
//  • сертификат API выдан НУЦ Минцифры. Его корень (Russian Trusted Root CA, SHA-1
//    8F:F9:15:CC:AB:7B:C1:6F:8C:5C:80:99:D5:3E:0E:11:5B:3A:EC:2F) лежит в
//    assets/certs и добавляется к доверенным только для запросов к MAX; MAX_CA_FILE — свой файл;
//  • подписки на вебхук MAX копит, а со временем может сбросить: при старте лишние удаляем,
//    свою ставим заново и раз в 6 часов проверяем, что она на месте.

import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import tls from 'tls';
import { maxWebhookSecret } from './security';

const HOUR = 3600_000;
const UPDATE_TYPES = ['bot_started', 'bot_stopped', 'message_created', 'message_callback'];
let cachedName = '';
let agent: https.Agent | null = null;

export const maxConfigured = (): boolean => !!process.env.MAX_BOT_TOKEN;

/** Ник бота для ссылки https://max.ru/<ник>?start=… — из GET /me, env — запасной вариант. */
export const maxBotName = (): string => (maxConfigured() ? cachedName || process.env.MAX_BOT_USERNAME || '' : '');

const apiBase = () => (process.env.MAX_API_URL || 'https://platform-api2.max.ru').replace(/\/$/, '');

function maxAgent(): https.Agent {
  if (agent) return agent;
  const extra: string[] = [];
  for (const file of [process.env.MAX_CA_FILE, path.join(__dirname, '../../assets/certs/russian-trusted-root-ca.crt')]) {
    if (!file) continue;
    try { extra.push(fs.readFileSync(file, 'utf8')); } catch { /* нет файла — обойдёмся системными */ }
  }
  agent = new https.Agent({ keepAlive: true, ca: [...tls.rootCertificates, ...extra] });
  return agent;
}

export interface MaxResult { ok: boolean; status: number; data: any }

/** Вызов API MAX. null — бот не подключён или MAX не ответил (в логе — без токена и данных). */
export function maxApi(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  route: string,
  opts: { query?: Record<string, string | number | boolean>; body?: unknown } = {},
): Promise<MaxResult | null> {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) return Promise.resolve(null);
  const url = new URL(apiBase() + route);
  for (const [k, v] of Object.entries(opts.query || {})) url.searchParams.set(k, String(v));
  const body = opts.body === undefined ? undefined : JSON.stringify(opts.body);
  const secure = url.protocol === 'https:';
  return new Promise((resolve) => {
    const req = (secure ? https : http).request(url, {
      method,
      agent: secure ? maxAgent() : undefined,
      timeout: 10_000,
      headers: { Authorization: token, ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}) },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { if (text.length < 1_000_000) text += chunk; });
      res.on('end', () => {
        let data: any = null;
        try { data = text ? JSON.parse(text) : null; } catch { data = null; }
        const status = res.statusCode || 0;
        if (status >= 400) console.error(`MAX ${method} ${route}: ${status}${typeof data?.code === 'string' ? ` ${data.code}` : ''}`);
        resolve({ ok: status >= 200 && status < 300, status, data });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => {
      // Обычно это сертификат (нет корня Минцифры) или сеть
      console.error(`MAX ${method} ${route}: нет ответа (${(e as NodeJS.ErrnoException).code || e.message})`);
      resolve(null);
    });
    if (body) req.write(body);
    req.end();
  });
}

/** Кнопка в формате Telegram (так их строит lib/reminders.ts) — переводим в формат MAX. */
export type Btn = { text: string; url?: string; callback_data?: string };

export function maxKeyboard(rows: Btn[][]): unknown[] {
  const buttons = rows
    .map((r) => r.map((b) => (b.url ? { type: 'link', text: b.text, url: b.url } : { type: 'callback', text: b.text, payload: b.callback_data || '' })))
    .filter((r) => r.length);
  return buttons.length ? [{ type: 'inline_keyboard', payload: { buttons } }] : [];
}

/** Сообщение пользователю в личный диалог с ботом. */
export function maxSend(userId: string, text: string, buttons: Btn[][] = []): Promise<MaxResult | null> {
  return maxApi('POST', '/messages', {
    query: { user_id: userId, disable_link_preview: true },
    body: { text: text.slice(0, 4000), attachments: maxKeyboard(buttons) },
  });
}

async function ensureSubscription(url: string, onlyIfMissing: boolean): Promise<void> {
  const current = await maxApi('GET', '/subscriptions');
  const subs: { url?: unknown }[] = Array.isArray(current?.data?.subscriptions) ? current!.data.subscriptions : [];
  if (onlyIfMissing && subs.some((s) => s.url === url)) return;
  for (const s of subs) {
    if (typeof s.url === 'string' && s.url !== url) await maxApi('DELETE', '/subscriptions', { query: { url: s.url } });
  }
  const res = await maxApi('POST', '/subscriptions', { body: { url, update_types: UPDATE_TYPES, secret: maxWebhookSecret() } });
  if (res?.ok && res.data?.success !== false) console.log(`🤖 MAX: вебхук ${onlyIfMissing ? 'восстановлен' : 'установлен'} на ${url}`);
  else console.error('MAX: вебхук не установлен');
}

/** Разовая настройка при старте: узнать ник бота и подписаться на события. */
export async function initMax(): Promise<void> {
  if (!maxConfigured()) return;
  const me = await maxApi('GET', '/me');
  if (me?.ok && typeof me.data?.username === 'string' && me.data.username) {
    cachedName = me.data.username;
    console.log(`🤖 MAX-бот: ${cachedName}`);
  } else {
    console.error('MAX: бот не ответил на /me — проверьте MAX_BOT_TOKEN');
  }
  // Вебхук MAX принимает только https на 443 — локально не ставим
  const base = (process.env.BACKEND_URL || '').replace(/\/$/, '');
  if (!base.startsWith('https://')) {
    console.log('🤖 MAX: вебхук не установлен — BACKEND_URL не https (локальная разработка)');
    return;
  }
  const url = `${base}/api/max/webhook`;
  await ensureSubscription(url, false);
  setInterval(() => { void ensureSubscription(url, true); }, 6 * HOUR).unref();
}
