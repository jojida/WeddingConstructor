import type { Metadata } from 'next';
import { TEMPLATES } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Шаблоны сайтов-приглашений на свадьбу',
  description:
    `Каталог шаблонов электронных свадебных приглашений: ${TEMPLATES.map(t => `«${t.name}»`).join(', ')}. ` +
    'Выберите дизайн, персонализируйте тексты и фото, отправьте гостям одной ссылкой.',
  alternates: { canonical: '/templates' },
  openGraph: {
    title: 'Шаблоны сайтов-приглашений на свадьбу — WeddingCraft',
    description:
      'Каталог шаблонов электронных свадебных приглашений с RSVP-анкетой: акварельные, минималистичные, тёмные и игривые дизайны.',
    url: '/templates',
    images: [{ url: '/invite/calla/assets/couple-photo.jpg', alt: 'Шаблоны свадебных сайтов-приглашений WeddingCraft' }],
  },
};

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
