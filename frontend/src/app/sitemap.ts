import type { MetadataRoute } from 'next';
import { SITE_URL, TEMPLATES } from '@/lib/constants';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const templatePages: MetadataRoute.Sitemap = TEMPLATES.map((tpl) => ({
    url: `${SITE_URL}/demo/${tpl.id}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.8,
    images: [`${SITE_URL}${tpl.preview}`],
  }));

  return [
    { url: SITE_URL, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/templates`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    ...templatePages,
    { url: `${SITE_URL}/oferta`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
