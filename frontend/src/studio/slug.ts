/* Слаг из русского названия: кириллица переводится в латиницу, остальное —
   в дефисы. Используется и для папки шаблона, и для имён классов в экспорте. */

const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function slugify(value: string, max = 40): string {
  return value
    .toLowerCase()
    .split('')
    .map((ch) => (ch in MAP ? MAP[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
}

/** Слаг, которого ещё нет в наборе: к повторам добавляется -2, -3 … */
export function uniqueSlug(value: string, taken: Set<string>, fallback = 'x'): string {
  const base = slugify(value) || fallback;
  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) candidate = `${base}-${n++}`;
  taken.add(candidate);
  return candidate;
}
