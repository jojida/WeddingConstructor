/* Экспорт шаблона. Только в разработке.

   Два разных дела под одной кнопкой:

   build — собрать шаблон целиком (новый шаблон с нуля или из PDF);
   patch — дописать правки к существующему, не трогая ни разметку, ни стили,
           ни script.js. Тогда программа дня, календарь, карусель и анкета
           продолжают работать, а пара правит свои поля как раньше. */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { denyAccess, notThere, projectDir, readProject } from '@/studio/server/paths';
import { catalogEntry, publish, shootCover, unpublish } from '@/studio/server/publish';
import { ship } from '@/studio/server/ship';
import { generateTemplate } from '@/studio/export/generate';
import { generatePatch, linkPatch, PATCH_FILE } from '@/studio/export/patch';

type Ctx = { params: Promise<{ slug: string }> };

/* GET у этого маршрута смысла не имеет, но и существование пути показывать
   незачем: без обработчика Next ответил бы 405 и выдал бы, что путь есть. */
export function GET() {
  return notThere();
}

export async function POST(request: Request, { params }: Ctx) {
  const denied = denyAccess(request);
  if (denied) return denied;

  const { slug } = await params;
  const dir = projectDir(slug);
  if (!dir) return Response.json({ error: 'Недопустимый слаг' }, { status: 400 });

  const project = await readProject(slug);
  if (!project) {
    return Response.json({ error: `Проект «${slug}» не найден` }, { status: 404 });
  }

  const name = project.catalog.name || slug;
  const confirmHandmade = new URL(request.url).searchParams.get('confirm') === '1';

  /* Разметку с вписанными текстами присылает браузер: там она разбиралась тем
     же движком, что считал адреса слоёв. Сервер её только записывает. */
  let patchedHtml: string | undefined;
  try {
    const body = await request.json();
    if (typeof body?.html === 'string' && body.html.length > 100) patchedHtml = body.html;
  } catch {
    /* тела нет — обычный экспорт без правок текста */
  }

  /* ─── правка существующего шаблона ──────────────────────────────────────── */

  if (project.mode === 'patch') {
    const indexPath = path.join(dir, 'index.html');
    let html: string;
    try {
      html = await fs.readFile(indexPath, 'utf8');
    } catch {
      return Response.json(
        { error: `Шаблон «${slug}» не найден на диске — править нечего` },
        { status: 404 },
      );
    }

    const patch = generatePatch(project);
    await fs.writeFile(path.join(dir, PATCH_FILE), patch.css, 'utf8');

    /* Разметку трогаем ровно дважды: ссылка на файл правок (один раз за всю
       жизнь шаблона) и вписанные тексты. Всё остальное остаётся слово в слово. */
    const base = patchedHtml ?? html;
    const linked = linkPatch(base);
    const touchedHtml = linked !== html;
    if (touchedHtml) await fs.writeFile(indexPath, linked, 'utf8');

    /* Карточку в галерее не трогаем: шаблон уже в каталоге, со своим
       описанием и своей схемой полей. Подменять её студийной — ровно та
       ошибка, из-за которой пара оставалась без полей. */
    const shipped = await ship(slug, name, { confirmHandmade: true });

    return Response.json({
      ok: true,
      mode: 'patch',
      shipped,
      url: `/invite/${slug}/`,
      files: touchedHtml ? [PATCH_FILE, 'index.html'] : [PATCH_FILE],
      touched: patch.touched,
      textsSkipped: patch.skippedBound.length,
      textsApplied: patchedHtml ? patch.texts.length : 0,
      bytes: { css: patch.css.length },
    });
  }

  /* ─── сборка нового шаблона ─────────────────────────────────────────────── */

  const { html, css, script } = generateTemplate(project);
  await fs.writeFile(path.join(dir, 'index.html'), html, 'utf8');
  await fs.writeFile(path.join(dir, 'styles.css'), css, 'utf8');
  await fs.writeFile(path.join(dir, 'script.js'), script, 'utf8');

  // Обложку снимаем с уже записанной страницы: то, что увидит гость, и то,
  // что увидит пара в каталоге, — один и тот же рендер.
  const origin = new URL(request.url).origin;
  const shot = await shootCover(project, origin).catch((e: Error) => ({
    skipped: e.message,
  }));

  const cover = 'file' in shot ? shot.file : '';
  const entries = await publish(catalogEntry(project, cover));

  /* Шаблон на диске — это ещё не шаблон на сайте. Довозим: коммит и отправка
     в GitHub, дальше сервер подтягивает её сам. Неудача здесь не отменяет
     экспорт — файлы уже записаны, о причине скажет shipped.note. */
  const shipped = await ship(slug, name, { confirmHandmade });

  return Response.json({
    ok: true,
    mode: 'build',
    shipped,
    url: `/invite/${slug}/`,
    files: ['index.html', 'styles.css', 'script.js'],
    cover: cover || null,
    coverSkipped: 'skipped' in shot ? shot.skipped : null,
    inCatalog: entries.length,
    bytes: { html: html.length, css: css.length },
  });
}

/** Убрать шаблон из галереи. Файлы шаблона остаются — живые сайты не ломаем. */
export async function DELETE(request: Request, { params }: Ctx) {
  const denied = denyAccess(request);
  if (denied) return denied;

  const { slug } = await params;
  if (!projectDir(slug)) {
    return Response.json({ error: 'Недопустимый слаг' }, { status: 400 });
  }

  const entries = await unpublish(slug);
  return Response.json({ ok: true, inCatalog: entries.length });
}
