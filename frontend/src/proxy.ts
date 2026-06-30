import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Привязка собственного домена клиента (MVP): если сайт открыт на чужом домене
// (DNS указывает на наш сервер, SSL настроен вручную) — корень `/` рендерит
// соответствующее приглашение. Все прочие пути (ассеты, /invite/…) проходят как есть.
const PRIMARY_HOSTS = new Set(['weddingcraft.ru', 'www.weddingcraft.ru']);

export function proxy(request: NextRequest) {
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  if (!host) return NextResponse.next();
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) return NextResponse.next();
  if (host.startsWith('api.')) return NextResponse.next();
  if (host.endsWith('.vercel.app')) return NextResponse.next();
  if (PRIMARY_HOSTS.has(host)) return NextResponse.next();

  // Чужой (привязанный) домен → отрисовать его приглашение, сохранив query (?g=)
  const url = request.nextUrl.clone();
  url.pathname = `/by-domain/${host}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: '/',
};
