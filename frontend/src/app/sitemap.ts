import { execFileSync } from 'node:child_process';
import type { MetadataRoute } from 'next';
import { SITE_URL, TEMPLATES } from '@/lib/constants';
import { ARTICLES } from '@/lib/articles';

/* lastmod — когда менялись файлы самой страницы (последний коммит git при сборке),
   а не время сборки: иначе каждый деплой «обновлял» все адреса, и поисковики
   перестают верить lastmod. Нет git (сборка из архива) — фиксированная дата, не текущая.
   Пути — от папки frontend, откуда идёт сборка. */
const FALLBACK = new Date('2026-10-31T00:00:00+03:00');
const dates = new Map<string, Date>();

function changed(...paths: string[]): Date {
  const key = paths.join('\n');
  const known = dates.get(key);
  if (known) return known;
  let date = FALLBACK;
  try {
    // --literal-pathspecs: «[templateId]» в пути — имя папки, а не маска
    const out = execFileSync('git', ['--literal-pathspecs', 'log', '-1', '--format=%cI', '--', ...paths], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000,
    }).trim();
    const parsed = new Date(out);
    if (out && !Number.isNaN(parsed.getTime())) date = parsed;
  } catch { /* git недоступен — остаётся FALLBACK */ }
  dates.set(key, date);
  return date;
}

// Демо: код страницы демо, её тексты и файлы самого шаблона.
// «Средиземноморье» лежит в корне /invite, рядом с папками других шаблонов.
const templateFiles = (id: string) => id === 'mediterranean'
  ? ['public/invite/index.html', 'public/invite/script.js', 'public/invite/styles.css']
  : [`public/invite/${id}`];

export default function sitemap(): MetadataRoute.Sitemap {
  const templatePages: MetadataRoute.Sitemap = TEMPLATES.map((tpl) => ({
    url: `${SITE_URL}/demo/${tpl.id}`,
    lastModified: changed('src/app/demo/[templateId]', 'src/lib/template-texts.ts', ...templateFiles(tpl.id)),
    changeFrequency: 'monthly',
    priority: 0.8,
    images: [`${SITE_URL}${tpl.preview}`],
  }));

  // У статьи — её собственная дата обновления текста: правка оформления блога
  // или опечатки в коде не делает статью «новой»
  const articlePages: MetadataRoute.Sitemap = ARTICLES.map((a) => ({
    url: `${SITE_URL}/blog/${a.slug}`,
    lastModified: new Date(`${a.updated}T00:00:00Z`),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [
    { url: SITE_URL, lastModified: changed('src/app/page.tsx', 'src/app/page.module.css', 'src/components/landing'), changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/templates`, lastModified: changed('src/app/templates'), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/print`, lastModified: changed('src/app/print/page.tsx', 'src/app/print/PrintCatalog.tsx'), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/rassadka-gostey-na-svadbu`, lastModified: changed('src/app/rassadka-gostey-na-svadbu'), changeFrequency: 'monthly', priority: 0.8 },
    ...templatePages,
    { url: `${SITE_URL}/blog`, lastModified: changed('src/app/blog/page.tsx', 'src/lib/articles/index.ts'), changeFrequency: 'weekly', priority: 0.7 },
    ...articlePages,
    { url: `${SITE_URL}/contacts`, lastModified: changed('src/app/contacts'), changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/oferta`, lastModified: changed('src/app/oferta'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: changed('src/app/privacy'), changeFrequency: 'yearly', priority: 0.3 },
  ];
}
