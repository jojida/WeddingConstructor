/* Верстак — внутренний редактор шаблонов.

   Маршрут существует только в разработке: в продакшн-сборке проверка ниже
   инлайнится и страница отдаёт 404. Для посетителей сайта студии нет. */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StudioApp from '@/studio/StudioApp';

/* В продакшне у страницы нет даже названия: она отдаёт 404, и упоминание
   студии не должно попадать в собранные файлы. */
export const metadata: Metadata =
  process.env.NODE_ENV === 'production'
    ? { robots: { index: false, follow: false } }
    : { title: 'Верстак', robots: { index: false, follow: false } };

export default function StudioPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <StudioApp />;
}
