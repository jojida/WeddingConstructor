/* Приём файла в папку шаблона. Только в разработке.
   Писать разрешено ровно в assets/ и assets/fonts/ выбранного шаблона. */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { denyAccess, notThere, projectDir } from '@/studio/server/paths';

type Ctx = { params: Promise<{ slug: string }> };

/* GET у этого маршрута смысла не имеет, но и существование пути показывать
   незачем: без обработчика Next ответил бы 405 и выдал бы, что путь есть. */
export function GET() {
  return notThere();
}

/** Имя файла без путей и сюрпризов. */
const SAFE_NAME = /^[a-z0-9][a-z0-9._-]{0,80}$/i;

const SUBDIRS = new Set(['assets', 'assets/fonts']);

export async function POST(request: Request, { params }: Ctx) {
  const denied = denyAccess(request);
  if (denied) return denied;

  const { slug } = await params;
  const dir = projectDir(slug);
  if (!dir) return Response.json({ error: 'Недопустимый слаг' }, { status: 400 });

  let body: { file?: string; base64?: string; dir?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Тело запроса не разобрано' }, { status: 400 });
  }

  const name = body.file ?? '';
  const subdir = body.dir ?? 'assets';

  if (!SAFE_NAME.test(name) || name.includes('..')) {
    return Response.json({ error: `Недопустимое имя файла: ${name}` }, { status: 400 });
  }
  if (!SUBDIRS.has(subdir)) {
    return Response.json({ error: 'Недопустимая папка' }, { status: 400 });
  }
  if (!body.base64) {
    return Response.json({ error: 'Содержимое файла не передано' }, { status: 400 });
  }

  const target = path.join(dir, ...subdir.split('/'), name);
  const relative = path.relative(dir, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return Response.json({ error: 'Путь уводит за пределы шаблона' }, { status: 400 });
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  const bytes = Buffer.from(body.base64, 'base64');
  await fs.writeFile(target, bytes);

  return Response.json({ ok: true, file: name, bytes: bytes.length });
}

/** Удаление файла — когда ассет больше не нужен. */
export async function DELETE(request: Request, { params }: Ctx) {
  const denied = denyAccess(request);
  if (denied) return denied;

  const { slug } = await params;
  const dir = projectDir(slug);
  if (!dir) return Response.json({ error: 'Недопустимый слаг' }, { status: 400 });

  const name = new URL(request.url).searchParams.get('file') ?? '';
  const subdir = new URL(request.url).searchParams.get('dir') ?? 'assets';
  if (!SAFE_NAME.test(name) || !SUBDIRS.has(subdir)) {
    return Response.json({ error: 'Недопустимый файл' }, { status: 400 });
  }

  await fs.rm(path.join(dir, ...subdir.split('/'), name), { force: true });
  return Response.json({ ok: true });
}
