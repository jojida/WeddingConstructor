'use client';

/* Шрифты открытого проекта — в документ студии.

   Без этого холст рисовал бы текст подстановочным шрифтом, а экспорт —
   настоящим: «холст = результат» ломается ровно там, где это заметнее всего.
   Поэтому переменные --font-* и сами файлы подключаются точно так же, как их
   получит готовый шаблон. */

import { useEffect } from 'react';
import { Project } from './types';
import { fontFaces, fontVars } from './export/generate';
import { fontUrlFor } from './assets/url';

export function useProjectFonts(project: Project | null): void {
  const fonts = project?.fonts;
  const slug = project?.slug;
  /* Файлы попадают сюда дважды: до сохранения шрифт лежит в памяти, после —
     в папке шаблона. Адрес меняется, значит @font-face надо переписать. */
  const assets = project?.assets;

  useEffect(() => {
    if (!project || !fonts?.length || !slug) return;

    const google = fonts.filter((f) => f.source === 'google' && f.googleSpec);
    let link: HTMLLinkElement | null = null;
    if (google.length) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.dataset.studio = 'fonts';
      link.href = `https://fonts.googleapis.com/css2?${google
        .map((f) => `family=${f.googleSpec}`)
        .join('&')}&display=swap`;
      document.head.appendChild(link);
    }

    const style = document.createElement('style');
    style.dataset.studio = 'fonts';
    style.textContent =
      `${fontFaces({ fonts } as Project, `/invite/${slug}/assets/fonts/`, fontUrlFor(project))}\n` +
      `:root {\n${fontVars({ fonts } as Project)}\n}`;
    document.head.appendChild(style);

    return () => {
      link?.remove();
      style.remove();
    };
  }, [project, fonts, slug, assets]);
}
