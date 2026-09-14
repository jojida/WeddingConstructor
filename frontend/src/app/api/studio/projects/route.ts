/* Список проектов студии и проверка слага перед созданием. Только в разработке. */

import { denyAccess, listProjects, templateKind } from '@/studio/server/paths';
import { SLUG_RE } from '@/studio/types';

export async function GET(request: Request) {
  const denied = denyAccess(request);
  if (denied) return denied;
  return Response.json({ projects: await listProjects() });
}

/**
 * Можно ли завести проект на этом слаге.
 *
 * Ничего не пишет — новый проект живёт в браузере, пока не нажато
 * «Сохранить». Иначе брошенный на полпути импорт оставлял бы в папке пустой
 * проект: слаг «занят», а открывается пустота.
 */
export async function POST(request: Request) {
  const denied = denyAccess(request);
  if (denied) return denied;

  let slug = '';
  let adopt = false;
  try {
    const body = await request.json();
    slug = body.slug ?? body.project?.slug ?? '';
    adopt = body.adopt === true;
  } catch {
    return Response.json({ error: 'Тело запроса не разобрано' }, { status: 400 });
  }

  if (!slug || !SLUG_RE.test(slug)) {
    return Response.json(
      { error: 'Слаг: строчные латинские буквы, цифры и дефис, от 3 символов' },
      { status: 400 },
    );
  }

  const kind = await templateKind(slug);

  if (kind === 'studio') {
    return Response.json({ error: `Проект «${slug}» уже существует` }, { status: 409 });
  }

  /*
   * Слаг занят рукописным шаблоном. Молча занять его нельзя: экспорт потом
   * перезапишет index.html и script.js, а на этом шаблоне стоят уже
   * опубликованные сайты пар. Забираем только по явной просьбе — а копия
   * оригинала откладывается позже, при первом сохранении, когда файлы
   * действительно меняются.
   */
  if (kind === 'handmade' && !adopt) {
    return Response.json(
      {
        error: `Слаг «${slug}» занят шаблоном сайта. Возьмите другой слаг или откройте оригинал через «Редактировать оригинал».`,
        handmade: true,
      },
      { status: 409 },
    );
  }

  return Response.json({ ok: true, slug, kind });
}
