import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/constants';

// Служебные разделы закрыты от обхода; пользовательские сайты-приглашения
// (корневые /<slug>) дополнительно закрыты через noindex в generateMetadata,
// т.к. по маске в robots их не отличить от публичных страниц.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/editor',
        '/auth',
        '/payment',
        '/by-domain/',
        '/api/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
