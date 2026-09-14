/* Чтение и сохранение одного проекта студии. Только в разработке. */

import {
  denyAccess,
  projectDir,
  readProject,
  writeProject,
  templateKind,
  backupTemplate,
} from '@/studio/server/paths';
import { Project } from '@/studio/types';

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const denied = denyAccess(request);
  if (denied) return denied;

  const { slug } = await params;
  if (!projectDir(slug)) {
    return Response.json({ error: 'Недопустимый слаг' }, { status: 400 });
  }

  const project = await readProject(slug);
  if (!project) {
    return Response.json({ error: `Проект «${slug}» не найден` }, { status: 404 });
  }
  return Response.json({ project });
}

/**
 * Сохранение — единственное место, где проект появляется на диске.
 * До него студия держит документ в браузере: закрытие без сохранения
 * не должно оставлять после себя ничего.
 */
export async function PUT(request: Request, { params }: Ctx) {
  const denied = denyAccess(request);
  if (denied) return denied;

  const { slug } = await params;
  if (!projectDir(slug)) {
    return Response.json({ error: 'Недопустимый слаг' }, { status: 400 });
  }

  let project: Project;
  let adopt = false;
  try {
    const body = await request.json();
    project = body.project;
    adopt = body.adopt === true;
  } catch {
    return Response.json({ error: 'Тело запроса не разобрано' }, { status: 400 });
  }

  // Слаг неизменяем: от него зависят уже опубликованные сайты пар.
  if (project?.slug !== slug) {
    return Response.json(
      { error: 'Слаг проекта нельзя менять после создания' },
      { status: 400 },
    );
  }

  /*
   * Первое сохранение поверх рукописного шаблона: у таких шаблонов свой
   * script.js на десятки килобайт, студия его не воспроизводит. Кладём копию
   * оригинала рядом — и только после этого пишем проект. Дальше слаг уже
   * «студийный», и лишних копий не появится.
   */
  let backup: string | null = null;
  const kind = await templateKind(slug);
  /* Режим правки шаблон не переписывает — терять нечего, и копия только
     раздувала бы папку и коммит. Оригиналы и так лежат в git. */
  if (kind === 'handmade' && project?.mode !== 'patch') {
    if (!adopt) {
      return Response.json(
        {
          error: `Слаг «${slug}» занят шаблоном сайта — сохранение отменено.`,
          handmade: true,
        },
        { status: 409 },
      );
    }
    backup = await backupTemplate(slug);
  }

  await writeProject(project);
  return Response.json({ ok: true, updatedAt: project.updatedAt, backup });
}
