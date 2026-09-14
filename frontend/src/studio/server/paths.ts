/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — доступ к файлам проектов (только серверная сторона).

   Студия пишет ровно в одно место: public/invite/<slug>/. Любой путь за
   пределами этой папки отбрасывается — проверка на выход по «..» обязательна,
   потому что slug приходит из URL.
   ═══════════════════════════════════════════════════════════════════════════ */

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { SLUG_RE, Project } from '../types';

export const INVITE_ROOT = path.join(process.cwd(), 'public', 'invite');

export const PROJECT_FILE = '_studio.json';

/** Студия существует только в разработке — в продакшне маршрутов нет. */
export const isDev = () => process.env.NODE_ENV === 'development';

/** Ответ для случая «мы в продакшне»: маршрута как будто не существует. */
export const notThere = () => new Response(null, { status: 404 });

/** Заголовок, в котором студия присылает пароль доступа. */
export const TOKEN_HEADER = 'x-studio-token';

/**
 * Пускать ли запрос к студии.
 *
 * В продакшне — никогда. В разработке: STUDIO_TOKEN обязателен, каждый запрос
 * обязан его принести. Без этого открытая на сеть студия давала бы любому
 * желающему писать файлы в проект и ходить прокси по любым адресам.
 * Возвращает готовый отказ или null, если всё в порядке.
 */
export function denyAccess(request?: Request): Response | null {
  if (!isDev()) return notThere();
  if (!request) return notThere();
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    return Response.json({ error: 'Недопустимый источник запроса' }, { status: 403 });
  }

  const expected = process.env.STUDIO_TOKEN;
  if (!expected) {
    return Response.json({ error: 'Для доступа к студии задайте STUDIO_TOKEN', needToken: true }, { status: 401 });
  }

  const fromHeader = request?.headers.get(TOKEN_HEADER) ?? '';
  if (fromHeader === expected) return null;

  /* Запросы, которые браузер делает сам — iframe импорта, картинки — заголовок
     нести не умеют. Поэтому тот же пароль дублируется в cookie. */
  const cookie = request?.headers.get('cookie') ?? '';
  const match = /(?:^|;\s*)wc_studio_token=([^;]*)/.exec(cookie);
  try { if (match && decodeURIComponent(match[1]) === expected) return null; } catch { /* malformed cookie */ }

  return Response.json(
    { error: 'Нужен пароль студии', needToken: true },
    { status: 401 },
  );
}

/**
 * Папка проекта, если slug допустим и не уводит за пределы public/invite.
 * Возвращает null, если что-то не так — вызывающий отвечает 400.
 */
export function projectDir(slug: string): string | null {
  if (!SLUG_RE.test(slug)) return null;
  const dir = path.join(INVITE_ROOT, slug);
  const rel = path.relative(INVITE_ROOT, dir);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return dir;
}

export function projectFile(slug: string): string | null {
  const dir = projectDir(slug);
  return dir && path.join(dir, PROJECT_FILE);
}

export async function readProject(slug: string): Promise<Project | null> {
  const file = projectFile(slug);
  if (!file) return null;
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as Project;
  } catch {
    return null;
  }
}

export async function writeProject(project: Project): Promise<void> {
  const dir = projectDir(project.slug);
  const file = projectFile(project.slug);
  if (!dir || !file) throw new Error('Недопустимый слаг проекта');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(project, null, 2), 'utf8');
}

/* ─── что лежит в папке шаблона ───────────────────────────────────────────── */

export type TemplateKind =
  /** папки нет — слаг свободен */
  | 'free'
  /** проект студии: рядом лежит _studio.json */
  | 'studio'
  /** шаблон, собранный руками: есть index.html, но проекта студии нет */
  | 'handmade';

export async function templateKind(slug: string): Promise<TemplateKind> {
  const dir = projectDir(slug);
  if (!dir) return 'free';
  if (await readProject(slug)) return 'studio';
  try {
    await fs.access(path.join(dir, 'index.html'));
    return 'handmade';
  } catch {
    return 'free';
  }
}

/**
 * Копия рукописных файлов шаблона перед тем, как студия их заменит.
 * У этих шаблонов свой script.js на десятки килобайт — программа дня,
 * календарь, карусель, анкета. Студия такое не воспроизводит, поэтому
 * оригинал обязан остаться на диске.
 */
export async function backupTemplate(slug: string): Promise<string | null> {
  const dir = projectDir(slug);
  if (!dir) return null;

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const target = path.join(dir, `_backup-${stamp}`);
  await fs.mkdir(target, { recursive: true });

  let saved = 0;
  for (const name of ['index.html', 'styles.css', 'script.js']) {
    try {
      await fs.copyFile(path.join(dir, name), path.join(target, name));
      saved += 1;
    } catch {
      /* файла нет — и не надо */
    }
  }

  if (!saved) {
    await fs.rm(target, { recursive: true, force: true });
    return null;
  }
  return path.basename(target);
}

export interface ProjectSummary {
  slug: string;
  name: string;
  width: number;
  sections: number;
  updatedAt: string;
}

/** Все папки в public/invite, где лежит файл проекта студии. */
export async function listProjects(): Promise<ProjectSummary[]> {
  let entries: string[] = [];
  try {
    const dirents = await fs.readdir(INVITE_ROOT, { withFileTypes: true });
    entries = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }

  const found: ProjectSummary[] = [];
  for (const slug of entries) {
    const project = await readProject(slug);
    if (!project) continue;
    found.push({
      slug: project.slug,
      name: project.catalog?.name || project.slug,
      width: project.canvas?.width ?? 0,
      sections: project.sections?.length ?? 0,
      updatedAt: project.updatedAt ?? '',
    });
  }
  return found.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
