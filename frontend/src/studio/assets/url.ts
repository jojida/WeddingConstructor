'use client';

/* Адрес файла шаблона для холста.

   Пока проект не сохранён, файл лежит не в папке, а в памяти — берём его
   blob-ссылку. Как только сохранение прошло, тот же файл читается из папки
   шаблона, ровно по тому адресу, который получит и готовая страница. */

import { Project } from '../types';
import { pendingUrl } from './pending';

export type AssetUrl = (id: string) => string | null;

export function assetUrlFor(project: Project): AssetUrl {
  return (id) => {
    const asset = project.assets.find((a) => a.id === id);
    if (asset) return pendingUrl(asset.file) ?? `/invite/${project.slug}/assets/${asset.file}`;

    /* В режиме правки картинки в шаблон не копировались: слой хранит адрес
       файла самого шаблона, и показывать его надо прямо по нему. */
    if (id.startsWith('/') || id.startsWith('http')) return id;
    return null;
  };
}

/** То же для файла шрифта: он лежит в assets/fonts/. */
export const fontUrlFor =
  (project: Project) =>
  (file: string): string =>
    pendingUrl(file) ?? `/invite/${project.slug}/assets/fonts/${file}`;
