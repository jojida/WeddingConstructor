import type { MetadataRoute } from 'next';
import { SITE_URL, TEMPLATES } from '@/lib/constants';
import { ARTICLES } from '@/lib/articles';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const templatePages: MetadataRoute.Sitemap = TEMPLATES.map((tpl) => ({
    url: `${SITE_URL}/demo/${tpl.id}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.8,
    images: [`${SITE_URL}${tpl.preview}`],
  }));

  // Дата статьи — её собственная, а не дата сборки: иначе поисковик при каждом
  // деплое считал бы все статьи изменёнными
  const articlePages: MetadataRoute.Sitemap = ARTICLES.map((a) => ({
    url: `${SITE_URL}/blog/${a.slug}`,
    lastModified: new Date(`${a.updated}T00:00:00Z`),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [
    { url: SITE_URL, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/templates`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/print`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/rassadka-gostey-na-svadbu`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    ...templatePages,
    { url: `${SITE_URL}/blog`, lastModified, changeFrequency: 'weekly', priority: 0.7 },
    ...articlePages,
    { url: `${SITE_URL}/contacts`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/oferta`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
