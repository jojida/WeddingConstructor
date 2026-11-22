import type { Metadata } from 'next';
import PrintCatalog from './PrintCatalog';
import { SITE_URL } from '@/lib/constants';
import { PRINT_FAQ, PRINT_PRICE, PRINT_TEMPLATES, printPreview } from '@/lib/print';
import { socialMeta } from '@/lib/social-meta';

const TITLE = `Печатные приглашения на свадьбу — шаблоны за ${PRINT_PRICE} ₽`;
/* «Пригласительные» и «бумажные» — так печатные приглашения ищут чаще (Вордстат, 09–10.2026:
   «печать пригласительных на свадьбу» — 284 запроса в месяц, «пригласительные на свадьбу
   бумажные» — 204), а в описании этих слов не было. */
const DESCRIPTION =
  'Шаблоны бумажных пригласительных на свадьбу: выберите дизайн, добавьте имена и дату, скачайте PDF формата A6 ' +
  `для печати дома или в типографии. ${PRINT_PRICE} ₽ за макет, предпросмотр бесплатный.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/print' },
  // Свои теги превью ссылки: без них ссылка на /print показывалась с заголовком и адресом главной
  ...socialMeta('/print', TITLE, DESCRIPTION),
};

/* Разметка: цена макета (в выдаче может показываться под ссылкой), хлебные крошки и вопросы
   со страницы. До этого у /print разметки не было вовсе. */
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Печатные приглашения', item: `${SITE_URL}/print` },
      ],
    },
    {
      '@type': 'Product',
      name: 'Печатное приглашение на свадьбу — макет в PDF',
      description: DESCRIPTION,
      image: PRINT_TEMPLATES.map(t => `${SITE_URL}${printPreview(t.id).src}`),
      url: `${SITE_URL}/print`,
      brand: { '@type': 'Brand', name: 'WeddingCraft' },
      offers: {
        '@type': 'Offer',
        price: String(PRINT_PRICE),
        priceCurrency: 'RUB',
        availability: 'https://schema.org/InStock',
        url: `${SITE_URL}/print`,
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: PRINT_FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ],
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <PrintCatalog />
    </>
  );
}
