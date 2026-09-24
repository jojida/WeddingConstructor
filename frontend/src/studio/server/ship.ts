/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — доставка шаблона на сайт.

   Экспорт кладёт файлы на диск, но диск — это ещё не сайт. Здесь тот же
   экспорт доводится до конца: коммит, отправка в GitHub, а дальше сервер
   подтягивает её сам (см. scripts/deploy.sh).

   Ключевое здесь — список путей. Рядом с шаблоном лежит незакоммиченный код
   самой студии, и «git add .» утащил бы в коммит и её, и чужие правки в
   работе. Поэтому в коммит попадает ровно то, без чего собранный шаблон не
   заработает на сервере, — и ничего сверх того.
   ═══════════════════════════════════════════════════════════════════════════ */

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { projectDir } from './paths';

const run = promisify(execFile);

/** Ветка, с которой живёт продакшн. */
const BRANCH = 'main';

export interface ShipResult {
  ok: boolean;
  /** короткий хеш созданного коммита */
  commit?: string;
  /** файлы, попавшие в коммит */
  files?: string[];
  /** отправлено ли в GitHub */
  pushed?: boolean;
  /** почему не получилось или почему пропустили */
  note?: string;
}

/** Корень репозитория: студия работает из frontend/, а git считает от корня. */
async function repoRoot(): Promise<string | null> {
  try {
    const { stdout } = await run('git', ['rev-parse', '--show-toplevel'], {
      cwd: process.cwd(),
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Что уезжает на сервер вместе с шаблоном.
 *
 * Первые пять — сам шаблон и общий рантайм, который его страница грузит.
 * Остальные — код сайта, который показывает студийные шаблоны: без
 * studioTemplates.ts сборка падает на первом же импорте в constants.ts.
 */
const shippedPaths = (slug: string): string[] => [
  `frontend/public/invite/${slug}`,
  'frontend/public/invite/_studio-registry.json',
  'frontend/public/invite/assets/studio-runtime.js',
  'frontend/public/invite/assets/studio-blocks.css',
  'frontend/public/invite/assets/photo-frame.js',
  'frontend/src/lib/studio-templates.generated.ts',
  'frontend/src/lib/studioTemplates.ts',
  'frontend/src/components/StudioTemplate.tsx',
  'frontend/src/components/TemplatePreview.tsx',
  'frontend/src/lib/constants.ts',
];

/**
 * Шаблон занял слаг рукописного оригинала?
 *
 * Резервная копия рядом с шаблоном остаётся ровно в этом случае. Такую
 * публикацию нельзя делать молча: у рукописных шаблонов свой script.js на
 * десятки килобайт — программа дня, календарь, анкета, — и на живых сайтах
 * пар он заменится заглушкой студии.
 */
async function tookOverHandmade(slug: string): Promise<boolean> {
  const dir = projectDir(slug);
  if (!dir) return false;
  try {
    const names = await fs.readdir(dir);
    return names.some((n) => n.startsWith('_backup-'));
  } catch {
    return false;
  }
}

/**
 * Коммитит шаблон и отправляет в GitHub.
 *
 * Никогда не бросает: экспорт уже записал файлы, и неудачная отправка не
 * должна выглядеть как неудачный экспорт. О том, что случилось, говорит
 * ShipResult — его показывает студия.
 */
export async function ship(
  slug: string,
  name: string,
  options: { confirmHandmade?: boolean } = {},
): Promise<ShipResult> {
  if (process.env.STUDIO_PUBLISH === 'off') {
    return { ok: false, note: 'публикация выключена (STUDIO_PUBLISH=off)' };
  }

  /*
   * Пересборка поверх рукописного шаблона запрещена — не «требует
   * подтверждения», а запрещена. Одного «ОК» хватало, чтобы живой шаблон
   * лишился программы дня, календаря и анкеты, а пара — всех полей в
   * кабинете. Для правки существующего шаблона есть режим правки: он
   * дописывает разницу и ничего не ломает.
   */
  if (!options.confirmHandmade && (await tookOverHandmade(slug))) {
    return {
      ok: false,
      note:
        `«${slug}» — рукописный шаблон, пересобрать его студия не может: ` +
        'пропадут программа дня, календарь, анкета и все поля кабинета. ' +
        'Откройте его через «Редактировать оригинал» — там правки дописываются, ' +
        'а шаблон остаётся целым.',
    };
  }

  const root = await repoRoot();
  if (!root) return { ok: false, note: 'проект не в git-репозитории' };

  const git = (args: string[]) => run('git', args, { cwd: root, maxBuffer: 8 * 1024 * 1024 });

  try {
    const branch = await git(['branch', '--show-current']);
    if (branch.stdout.trim() !== BRANCH) {
      return { ok: false, note: `Публикация доступна из ветки ${BRANCH}` };
    }
    const existing = await git(['diff', '--cached', '--name-only']);
    if (existing.stdout.trim()) {
      return { ok: false, note: 'В индексе Git есть изменения. Завершите их коммит перед публикацией шаблона.' };
    }
    // Пути, которых на диске нет, git add считает ошибкой и не добавляет
    // ничего вообще — поэтому отбираем существующие.
    const wanted = shippedPaths(slug);
    const present: string[] = [];
    for (const rel of wanted) {
      try {
        await fs.access(path.join(root, rel));
        present.push(rel);
      } catch {
        /* файла нет — значит, он и не нужен */
      }
    }
    if (!present.length) return { ok: false, note: 'нечего публиковать' };

    await git(['add', '--', ...present]);

    // Ничего не изменилось — коммит пустым делать незачем.
    const staged = await git(['diff', '--cached', '--name-only', '--', ...present]);
    const files = staged.stdout.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!files.length) {
      return { ok: true, files: [], pushed: false, note: 'изменений нет, коммит не нужен' };
    }

    await git(['commit', '--only', '-m', `Верстак: шаблон «${name}» (${slug})`, '--', ...present]);
    const head = await git(['rev-parse', '--short', 'HEAD']);
    const commit = head.stdout.trim();

    try {
      await git(['push', 'origin', BRANCH]);
    } catch (e) {
      return {
        ok: true,
        commit,
        files,
        pushed: false,
        note: `коммит создан, но отправить не удалось: ${(e as Error).message.split('\n')[0]}`,
      };
    }

    return { ok: true, commit, files, pushed: true };
  } catch (e) {
    return { ok: false, note: (e as Error).message.split('\n')[0] };
  }
}
