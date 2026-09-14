'use client';

/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — превью шаблона.

   Показывает страницу такой, какой она станет, — но ничего не пишет на диск.
   Это важно: правило студии в том, что до «Сохранить» папка шаблона не
   меняется, а посмотреть на результат хочется как раз до сохранения.

   Поэтому страница собирается здесь же, в браузере, и открывается соседней
   вкладкой. Файлы шаблона лежат по своим адресам, поэтому ссылки на них
   переписываются в абсолютные, а ещё не сохранённые картинки берутся из
   памяти по blob-ссылке.
   ═══════════════════════════════════════════════════════════════════════════ */

import { Project } from '../types';
import { generateTemplate } from './generate';
import { generatePatch } from './patch';
import { pendingUrl } from '../assets/pending';

/**
 * Относительные адреса собранного шаблона → абсолютные.
 *
 * В самом шаблоне они относительные, потому что страница лежит в своей папке.
 * Превью открывается по blob-ссылке, где относиться не от чего.
 */
function absolutize(text: string, project: Project): string {
  const known = new Set(project.assets.map((a) => a.file));

  return text
    .replace(/\.\.\/assets\//g, '/invite/assets/')
    .replace(/(["'(])assets\/([^"')]+)/g, (_, quote: string, file: string) => {
      // Файл, который ещё не сохранён, лежит в памяти — оттуда и покажем.
      const name = file.split('/').pop() ?? file;
      const blob = known.has(name) ? pendingUrl(name) : null;
      return `${quote}${blob ?? `/invite/${project.slug}/assets/${file}`}`;
    });
}

/**
 * Превью шаблона в режиме правки: настоящая страница плюс наложенные правки.
 *
 * Берём файл шаблона как есть — со всей его разметкой, стилями и скриптом, —
 * и дописываем в конец то же, что уйдёт в _studio.css. Поэтому здесь видно
 * ровно то, что получится: и правки, и программу дня, и анимации.
 */
export async function previewPatched(project: Project): Promise<string> {
  const response = await fetch(`/invite/${project.slug}/index.html`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Шаблон не открылся (${response.status})`);
  const html = await response.text();

  const { css } = generatePatch(project);
  const head =
    `<base href="${location.origin}/invite/${project.slug}/" />`;

  return html
    .replace('<head>', `<head>
  ${head}`)
    .replace(/<\/head>/i, `  <style>
${css}
  </style>
</head>`);
}

/** Собранная страница целиком, одним документом. */
export function previewHtml(project: Project): string {
  const { html, css, script } = generateTemplate(project);

  return absolutize(html, project)
    /* У blob-адреса нет пути, и разрешить относительно него ссылку вида
       «/invite/...» браузер не может — без этой строки в превью не грузится
       ни одна картинка. Поэтому задаём начало отсчёта явно. */
    .replace('<head>', `<head>
  <base href="${location.origin}/" />`)
    // Стили и скрипт вшиваем внутрь: на диске их ещё может не быть.
    .replace(
      '  <link rel="stylesheet" href="styles.css" />',
      `  <style>\n${absolutize(css, project)}\n  </style>`,
    )
    .replace('  <script src="script.js"></script>', `  <script>\n${script}\n  </script>`);
}

/**
 * Открывает превью соседней вкладкой.
 *
 * Через blob-ссылку, а не document.write: страница получает нормальный адрес
 * и обычное происхождение, поэтому и относительные пути, и наблюдатели
 * появления работают ровно так же, как на настоящем сайте.
 */
export async function openPreview(project: Project): Promise<boolean> {
  const html =
    project.mode === 'patch' ? await previewPatched(project) : previewHtml(project);

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Вкладка уже забрала содержимое; держать ссылку живой дальше незачем,
  // но и отзывать её мгновенно нельзя — вкладка не успеет открыться.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/* Превью видно из консоли по той же причине, что стор и импорт: проверять
   собранную страницу глазами удобно, а разбирать её — только текстом. */
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__studioPreview = {
    previewHtml,
    previewPatched,
    openPreview,
  };
}
