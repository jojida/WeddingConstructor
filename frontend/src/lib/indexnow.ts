/* IndexNow — сайт сам сообщает поисковикам, какие страницы появились или изменились.
   Яндекс и Bing принимают такие сообщения и приходят за страницей быстрее, чем дошли бы до
   неё по карте сайта (в Вебмастере после аварии 10.2026 карта не перечитывалась неделями).

   Как работает. После каждой выкладки сервер перезапускается (scripts/deploy.sh), и через
   20 секунд instrumentation.ts вызывает pingIndexNow. Она читает собранную карту сайта,
   сравнивает даты страниц с прошлой отправкой (файл .indexnow-sent.json рядом с package.json)
   и шлёт только новые и изменённые адреса. Самый первый запуск отправит все.

   Ключ — не секрет: он лежит в открытом файле public/<ключ>.txt и подтверждает только то,
   что запрос пришёл от владельца сайта. Выключить отправку: переменная окружения INDEXNOW=off.

   Только встроенные модули и относительные пути: файл читают и tests/indexnow.cjs. */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export const INDEXNOW_KEY = 'a1fed8c63751d44cc4a732e236c6b3c6';
const SITE = 'https://weddingcraft.ru';
const ENDPOINT = 'https://yandex.com/indexnow';
const STATE_FILE = '.indexnow-sent.json';
/* Признак боевого сервера: только его сборка смотрит на боевой API (frontend/.env.production).
   Локальный `next start` с тем же кодом поисковикам ничего не шлёт. */
const PRODUCTION_API = 'https://api.weddingcraft.ru';

export interface SitemapEntry { url: string; lastmod: string }

/** Адреса страниц и даты их изменения из sitemap.xml. Картинки (<image:loc>) не берём. */
export function parseSitemap(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const url = block.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim();
    const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim() ?? '';
    if (url) entries.push({ url, lastmod });
  }
  return entries;
}

const isOurs = (url: string): boolean => {
  try { return new URL(url).origin === SITE; } catch { return false; }
};

/** Что отправлять: адреса, которых не было в прошлой отправке, и те, у кого изменилась дата. */
export function changedUrls(entries: SitemapEntry[], sent: Record<string, string>): string[] {
  return entries.filter(entry => isOurs(entry.url) && sent[entry.url] !== entry.lastmod).map(entry => entry.url);
}

export type PingResult = 'off' | 'no-sitemap' | 'nothing' | 'sent' | 'failed';

interface PingOptions {
  dir?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  log?: (line: string) => void;
}

/** Отправляет поисковикам новые и изменённые адреса. Никогда не бросает исключение:
    неудачная отправка повторится при следующем запуске сервера. */
export async function pingIndexNow({ dir = process.cwd(), env = process.env, fetchImpl = fetch, log = console.log }: PingOptions = {}): Promise<PingResult> {
  // Во время сборки сервер ещё отдаёт прошлую версию — сообщать о новой рано
  if (env.NODE_ENV !== 'production' || env.NEXT_PHASE === 'phase-production-build') return 'off';
  if (env.NEXT_PUBLIC_API_URL !== PRODUCTION_API || env.INDEXNOW === 'off') return 'off';

  let xml: string;
  try {
    xml = await fs.readFile(path.join(dir, env.WC_BUILD_DIR || '.next', 'server', 'app', 'sitemap.xml.body'), 'utf8');
  } catch {
    log('[indexnow] карта сайта не найдена — отправлять нечего');
    return 'no-sitemap';
  }

  const entries = parseSitemap(xml);
  const statePath = path.join(dir, STATE_FILE);
  let sent: Record<string, string> = {};
  try { sent = JSON.parse(await fs.readFile(statePath, 'utf8')); } catch { /* первой отправки ещё не было */ }

  const urls = changedUrls(entries, sent);
  if (!urls.length) return 'nothing';

  try {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: new URL(SITE).host, key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList: urls }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      log(`[indexnow] отказ ${response.status}: адресов не принято — ${urls.length}, повтор при следующем запуске`);
      return 'failed';
    }
  } catch (error) {
    log(`[indexnow] нет связи: ${error instanceof Error ? error.message : String(error)}`);
    return 'failed';
  }

  try {
    await fs.writeFile(statePath, JSON.stringify(Object.fromEntries(entries.filter(entry => isOurs(entry.url)).map(entry => [entry.url, entry.lastmod])), null, 1));
  } catch (error) {
    // Не записали — в следующий раз адреса уйдут повторно, это безвредно
    log(`[indexnow] отправлено, но список не сохранён: ${error instanceof Error ? error.message : String(error)}`);
  }
  log(`[indexnow] отправлено адресов: ${urls.length}`);
  return 'sent';
}
