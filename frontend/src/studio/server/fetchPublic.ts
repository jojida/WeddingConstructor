import { resolve4 } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';

// Resolve and pin the destination for every redirect to prevent DNS rebinding.
export function publicIPv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b, c] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

export async function fetchPublic(url: URL, redirects = 0): Promise<{ bytes: Buffer; type: string; url: URL }> {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && url.port !== '80' && url.port !== '443') || redirects > 5) throw new Error('Недопустимый адрес импорта');
  const addresses = await resolve4(url.hostname);
  if (!addresses.length || !addresses.every(publicIPv4)) throw new Error('Внутренние адреса недоступны для импорта');
  const result = await new Promise<{ bytes: Buffer; type: string; location?: string }>((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.get(url, {
      agent: false,
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'WeddingCraft-Studio/1.0 (import)', 'Accept-Encoding': 'identity' },
      lookup: (_host, options, callback) => {
        if (options.all) callback(null, addresses.map(address => ({ address, family: 4 })));
        else callback(null, addresses[0], 4);
      },
    }, response => {
      const status = response.statusCode || 500;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        resolve({ bytes: Buffer.alloc(0), type: '', location: response.headers.location });
        return;
      }
      if (status < 200 || status >= 300) { response.resume(); reject(new Error(`Страница ответила ${status}`)); return; }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) { req.destroy(new Error('Файл импорта больше 8 MB')); return; }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ bytes: Buffer.concat(chunks), type: response.headers['content-type'] || 'application/octet-stream' }));
    });
    req.on('error', reject);
  });
  if (result.location) return fetchPublic(new URL(result.location, url), redirects + 1);
  return { ...result, url };
}
