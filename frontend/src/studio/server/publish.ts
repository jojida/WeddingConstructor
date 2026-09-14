/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — появление шаблона в галерее.

   Экспорт не правит рукописный код: он пишет файлы шаблона, снимает обложку
   и переписывает ровно два своих файла — реестр-JSON и сгенерированный модуль,
   который рукописный constants.ts подмешивает к каталогу.
   ═══════════════════════════════════════════════════════════════════════════ */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Project, sectionHeightPx, DEFAULT_MAX_WIDTH } from '../types';
import {
  buildFields,
  buildDefaults,
  GeneratedSection,
  GeneratedDefaults,
} from '../export/generate';
import { INVITE_ROOT, projectDir } from './paths';

const run = promisify(execFile);

/** Пропорция карточки в каталоге: высота к ширине. */
const CARD_RATIO = 1.55;

const REGISTRY_FILE = path.join(INVITE_ROOT, '_studio-registry.json');
const GENERATED_FILE = path.join(process.cwd(), 'src', 'lib', 'studio-templates.generated.ts');

export interface StudioTemplateEntry {
  id: string;
  name: string;
  description: string;
  tags: string[];
  colors: string[];
  preview: string;
  defaultCover: string;
  defaultGallery: string[];
  sampleBride: string;
  sampleGroom: string;
  background: string;
  /** схема панели кабинета — собрана из пометок на слоях */
  fields: GeneratedSection[];
  /** чем панель заполнится в первый раз — тем, что стоит в дизайне */
  defaults: GeneratedDefaults;
}

/* ─── обложка ─────────────────────────────────────────────────────────────── */

const CHROME_CANDIDATES = [
  process.env.STUDIO_CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean) as string[];

async function findChrome(): Promise<string | null> {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      /* пробуем следующий */
    }
  }
  return null;
}

/**
 * Снимок первой секции готовой страницы — он же карточка в галерее.
 * Скриншот снимается с той же страницы, которую увидит гость, поэтому
 * обложка не может разойтись с дизайном.
 */
export async function shootCover(
  project: Project,
  origin: string,
): Promise<{ file: string } | { skipped: string }> {
  const dir = projectDir(project.slug);
  if (!dir) return { skipped: 'недопустимый слаг' };

  const chrome = await findChrome();
  if (!chrome) return { skipped: 'не найден Chrome для снимка обложки' };

  if (!project.sections.length) return { skipped: 'в шаблоне нет секций' };

  const width = Math.min(project.canvas.maxWidth ?? DEFAULT_MAX_WIDTH, DEFAULT_MAX_WIDTH);

  // Карточка в каталоге вертикальная, поэтому снимаем верх страницы в её
  // пропорции: иначе широкий снимок обрезался бы по бокам и съедал края
  // дизайна. Короткий шаблон снимаем целиком — тянуть нечего.
  const scale = width / project.canvas.width;
  const documentHeight = project.sections.reduce(
    (sum, section) => sum + sectionHeightPx(section, project.canvas.width) * scale,
    0,
  );
  const height = Math.round(Math.min(documentHeight, width * CARD_RATIO));

  const out = path.join(dir, 'assets', 'cover.png');
  await fs.mkdir(path.dirname(out), { recursive: true });

  // --hide-scrollbars важен: без него ширина вьюпорта уезжает на ширину
  // полосы прокрутки, и правый край дизайна обрезается.
  await run(
    chrome,
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      `--screenshot=${out}`,
      `--window-size=${width},${height}`,
      '--virtual-time-budget=5000',
      `${origin}/invite/${project.slug}/index.html`,
    ],
    { timeout: 45_000, windowsHide: true },
  );

  await fs.access(out);
  return { file: `/invite/${project.slug}/assets/cover.png` };
}

/* ─── реестр ──────────────────────────────────────────────────────────────── */

export function catalogEntry(project: Project, cover: string): StudioTemplateEntry {
  return {
    id: project.slug,
    name: project.catalog.name || project.slug,
    description: project.catalog.description,
    tags: project.catalog.tags,
    colors: project.catalog.colors,
    preview: cover,
    defaultCover: cover,
    defaultGallery: [],
    sampleBride: project.catalog.sampleBride,
    sampleGroom: project.catalog.sampleGroom,
    background: project.sections[0]?.background.color ?? '#ffffff',
    fields: buildFields(project),
    defaults: buildDefaults(project),
  };
}

async function readRegistry(): Promise<StudioTemplateEntry[]> {
  try {
    const raw = JSON.parse(await fs.readFile(REGISTRY_FILE, 'utf8'));
    return Array.isArray(raw?.entries) ? raw.entries : [];
  } catch {
    return [];
  }
}

async function writeGenerated(entries: StudioTemplateEntry[]): Promise<void> {
  const body = `/* ─────────────────────────────────────────────────────────────────────────────
   Файл создаёт «Верстак» при экспорте шаблона. Правки руками пропадут при
   следующем экспорте — настраивайте шаблон в студии на /studio.
   Источник данных: public/invite/_studio-registry.json
   ───────────────────────────────────────────────────────────────────────────── */

import type { StudioTemplateEntry } from './studioTemplates';

export const STUDIO_TEMPLATES: StudioTemplateEntry[] = ${JSON.stringify(entries, null, 2)};
`;
  await fs.writeFile(GENERATED_FILE, body, 'utf8');
}

/** Добавляет шаблон в каталог или обновляет уже опубликованный. */
export async function publish(entry: StudioTemplateEntry): Promise<StudioTemplateEntry[]> {
  const entries = await readRegistry();
  const index = entries.findIndex((e) => e.id === entry.id);
  if (index >= 0) entries[index] = entry;
  else entries.push(entry);

  await fs.writeFile(REGISTRY_FILE, JSON.stringify({ entries }, null, 2), 'utf8');
  await writeGenerated(entries);
  return entries;
}

/** Убирает шаблон из каталога, файлы шаблона при этом остаются на месте. */
export async function unpublish(slug: string): Promise<StudioTemplateEntry[]> {
  const entries = (await readRegistry()).filter((e) => e.id !== slug);
  await fs.writeFile(REGISTRY_FILE, JSON.stringify({ entries }, null, 2), 'utf8');
  await writeGenerated(entries);
  return entries;
}

export { readRegistry };
