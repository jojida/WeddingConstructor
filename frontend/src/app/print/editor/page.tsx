import { Suspense } from 'react';
import type { Metadata } from 'next';
import PrintEditor from './PrintEditor';
export const metadata: Metadata = { title: 'Редактор печатного приглашения', robots: { index: false, follow: false } };
export default function Page() { return <Suspense fallback={<p>Загружаем редактор…</p>}><PrintEditor /></Suspense>; }
