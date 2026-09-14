'use client';

/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — файлы, судьба которых ещё не решена на диске.

   Правило студии: пока не нажато «Сохранить», в папке шаблона не меняется
   ничего. Поэтому добавленные картинки и шрифты ждут здесь, в памяти, а холст
   показывает их по blob-ссылке; удалённые тоже ждут — файл лежит на месте до
   сохранения, и отмена возвращает его целым. Один раз, при сохранении, всё
   это уезжает на диск.

   Раньше файлы улетали в папку сразу, и брошенный на полпути импорт оставлял
   после себя пустой проект и десяток картинок.

   Ключ здесь — имя файла: внутри папки шаблона оно и есть настоящее имя вещи
   (у картинок в него зашит хеш содержимого).
   ═══════════════════════════════════════════════════════════════════════════ */

/** Куда файл ляжет внутри папки шаблона. */
export type AssetDir = 'assets' | 'assets/fonts';

interface Held {
  dir: AssetDir;
  /** Содержимое для записи; после записи не нужно и освобождается. */
  base64: string | null;
  url: string;
}

const held = new Map<string, Held>();
/** Файлы, лежащие на диске, которые убрали из документа. */
const doomed = new Map<string, AssetDir>();

const MIME: Record<string, string> = {
  webp: 'image/webp',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

const mimeOf = (file: string): string =>
  MIME[file.toLowerCase().split('.').pop() ?? ''] ?? 'application/octet-stream';

/** Кладём файл в память и отдаём ссылку, по которой его покажет холст. */
export function holdAsset(file: string, base64: string, dir: AssetDir = 'assets'): string {
  doomed.delete(file);
  const already = held.get(file);
  if (already) {
    if (!already.base64) already.base64 = base64;
    return already.url;
  }

  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeOf(file) }));
  held.set(file, { dir, base64, url });
  return url;
}

/** Ссылка на файл, который студия держит в памяти. */
export const pendingUrl = (file: string): string | null => held.get(file)?.url ?? null;

/** Есть ли что уносить на диск при сохранении. */
export const hasPending = (): boolean =>
  doomed.size > 0 || [...held.values()].some((h) => h.base64 !== null);

/**
 * Файл убрали из документа. Тот, что ещё не сохранён, просто забываем; тот,
 * что лежит на диске, помечаем — сотрём при сохранении, не раньше: до тех пор
 * отмена (Ctrl+Z) должна возвращать картинку целой.
 */
export function forgetAsset(file: string, dir: AssetDir = 'assets'): void {
  const item = held.get(file);
  if (item) {
    URL.revokeObjectURL(item.url);
    held.delete(file);
    // Записанный файл лежит в папке — значит, его ещё нужно оттуда убрать.
    if (item.base64 === null) doomed.set(file, item.dir);
    return;
  }
  doomed.set(file, dir);
}

/**
 * Что делать с файлами при сохранении.
 *
 * `keep` — имена файлов, на которые документ ссылается сейчас. Всё, что в него
 * не входит, писать незачем, а помеченное на удаление — наоборот, стереть.
 * Так отмена сама себя чинит: вернувшийся в документ файл не удалится, а
 * отменённая загрузка не попадёт на диск.
 */
export function saveList(keep: Set<string>): {
  write: { file: string; base64: string; dir: AssetDir }[];
  remove: { file: string; dir: AssetDir }[];
} {
  const write = [...held.entries()]
    .filter(([file, item]) => item.base64 !== null && keep.has(file))
    .map(([file, item]) => ({ file, base64: item.base64!, dir: item.dir }));

  const remove = [...doomed.entries()]
    .filter(([file]) => !keep.has(file))
    .map(([file, dir]) => ({ file, dir }));

  return { write, remove };
}

/**
 * Файл записан на диск.
 *
 * Содержимое можно отпустить, а вот blob-ссылку — нет: на неё уже смотрят
 * картинки на холсте, и отобрать её сейчас значит показать пустые рамки до
 * следующей перерисовки. Ссылка живёт, пока открыт проект.
 */
export function markSaved(file: string): void {
  const item = held.get(file);
  if (item) item.base64 = null;
}

/** Сохранение прошло: помеченные на удаление либо стёрты, либо вернулись. */
export const clearDoomed = (): void => void doomed.clear();

/** Проект закрыли — всё, что копилось, выбрасываем. */
export function dropPending(): void {
  for (const item of held.values()) URL.revokeObjectURL(item.url);
  held.clear();
  doomed.clear();
}
