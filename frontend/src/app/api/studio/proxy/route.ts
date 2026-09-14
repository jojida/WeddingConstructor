/* Прокси для импорта чужой страницы. Только в разработке.

   Зачем: студия разбирает страницу, загрузив её в скрытый фрейм и сняв
   геометрию через getBoundingClientRect. Заглянуть в чужой источник браузер
   не даст, поэтому страница отдаётся с нашего же адреса. Стили и картинки
   при этом грузятся с оригинала — для них ограничений нет. */

import { denyAccess } from '@/studio/server/paths';
import { fetchPublic } from '@/studio/server/fetchPublic';

export async function GET(request: Request) {
  const denied = denyAccess(request);
  if (denied) return denied;

  const target = new URL(request.url).searchParams.get('url') ?? '';
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return Response.json({ error: 'Нужен полный адрес страницы' }, { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return Response.json({ error: 'Поддерживаются только http и https' }, { status: 400 });
  }

  let upstream: Awaited<ReturnType<typeof fetchPublic>>;
  try {
    upstream = await fetchPublic(parsed);
  } catch (e) {
    return Response.json(
      { error: `Страница не открылась: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  // Картинки и шрифты отдаём как есть: их тоже нельзя прочитать напрямую
  // с чужого адреса, а импорту нужны байты, чтобы положить файл в шаблон.
  const type = upstream.type;
  if (!/text\/html/i.test(type)) {
    return new Response(new Uint8Array(upstream.bytes), {
      headers: { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Security-Policy': "sandbox allow-same-origin; script-src 'none'; object-src 'none'; form-action 'none'", 'X-Content-Type-Options': 'nosniff' },
    });
  }

  let html = upstream.bytes.toString('utf8');

  // <base> заставляет относительные пути к стилям и картинкам вести на
  // оригинал, иначе страница приедет без оформления и разбирать будет нечего.
  const base = `<base href="${upstream.url.toString().replace(/"/g, '&quot;')}">`;
  html = /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (m) => m + base)
    : base + html;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "sandbox allow-same-origin; script-src 'none'; object-src 'none'; form-action 'none'",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
