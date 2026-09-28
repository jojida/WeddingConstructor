import type { Metadata } from 'next';
import PrintCatalog from './PrintCatalog';
export const metadata: Metadata = { title: 'Печатные приглашения на свадьбу — шаблоны за 290 ₽', description: 'Выберите дизайн, добавьте имена и дату. PDF-приглашение A6 для самостоятельной печати — 290 ₽, без подписки. Бесплатный предпросмотр.', alternates: { canonical: '/print' } };
export default function Page() { return <PrintCatalog />; }
