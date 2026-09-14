'use client';

/* Импорт страницы целиком: загрузка → разбор → втягивание картинок → проект. */

import { useStudio } from '../store';
import { Asset, FontDef, ProjectMode, Section, uid } from '../types';
import { slugify } from '../slug';
import { importDocument, relinkAssets, ImportedPage } from './fromDom';
import { importPdf } from './fromPdf';

/* Родовые имена — это не шрифт, а указание браузеру. Подключать нечего. */
const GENERIC = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', '-apple-system',
  'blinkmacsystemfont', 'inherit', 'initial',
]);

const families = (stack: string): string[] =>
  stack
    .split(',')
    .map((part) => part.trim().replace(/^["']|["']$/g, ''))
    .filter((family) => family && !GENERIC.has(family.toLowerCase()));

/**
 * Найденные на странице шрифты становятся шрифтами шаблона. Считаем их
 * гугловскими: подавляющее большинство сайтов берёт их именно оттуда, а если
 * семейство окажется своим, запрос просто ничего не вернёт и останется
 * запасной шрифт из того же стека.
 */
function registerFonts(stacks: string[], sections: Section[]): FontDef[] {
  const fonts: FontDef[] = [];
  const keyByStack = new Map<string, string>();

  for (const stack of stacks) {
    const list = families(stack);
    if (!list.length) continue;
    const key = slugify(list[0]);
    if (!key) continue;
    keyByStack.set(stack, key);
    if (fonts.some((f) => f.key === key)) continue;
    const spec = (family: string) => family.replace(/\s+/g, '+');
    fonts.push({
      key,
      stack,
      source: 'google',
      googleSpec: spec(list[0]),
      googleExtra: list.slice(1).map(spec),
    });
  }

  for (const section of sections) {
    for (const layer of section.layers) {
      if (layer.kind !== 'text') continue;
      const key = keyByStack.get(layer.font);
      if (key) layer.font = `var(--font-${key})`;
    }
  }

  return fonts;
}

export const proxyUrl = (url: string) => `/api/studio/proxy?url=${encodeURIComponent(url)}`;

/** Грузит страницу в скрытый фрейм и отдаёт её документ. */
function loadInFrame(src: string, width: number): Promise<{ doc: Document; dispose: () => void }> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    // Фрейм должен быть настоящего размера: геометрию считает браузер, и в
    // окне нулевой ширины он посчитает её для нулевой ширины.
    frame.style.cssText =
      `position:fixed;left:-10000px;top:0;width:${width}px;height:1400px;border:0;visibility:hidden`;
    frame.src = src;

    const timer = window.setTimeout(() => {
      frame.remove();
      reject(new Error('Страница не загрузилась за 30 секунд'));
    }, 30_000);

    frame.onload = () => {
      window.clearTimeout(timer);
      const doc = frame.contentDocument;
      if (!doc) {
        frame.remove();
        reject(new Error('Не удалось прочитать страницу'));
        return;
      }
      const settle = async () => {
        /*
         * Появление секций при прокрутке сдвигает элементы на 26px вниз, пока
         * анимация не отработала. Замерив страницу в этот момент, импорт
         * забирал промежуточные координаты — и весь макет уезжал вниз.
         * Поэтому сначала приводим страницу в конечное состояние:
         * выключаем переходы и включаем то, что показывается при прокрутке.
         */
        const style = doc.createElement('style');
        style.textContent =
          '*,*::before,*::after{transition:none!important;animation:none!important}';
        doc.head.appendChild(style);
        doc
          .querySelectorAll('[class*="fade"],[class*="reveal"],[class*="anim"]')
          .forEach((el) => el.classList.add('in'));

        // Прокрутка целиком будит наблюдатели появления у чужих страниц.
        const win = frame.contentWindow;
        if (win) {
          const total = doc.documentElement.scrollHeight;
          for (let y = 0; y < total; y += 600) {
            win.scrollTo(0, y);
            await new Promise((r) => window.setTimeout(r, 20));
          }
          win.scrollTo(0, 0);
        }

        await new Promise((r) => window.setTimeout(r, 500));
        resolve({ doc, dispose: () => frame.remove() });
      };

      // Даём дорисоваться шрифтам и картинкам — иначе геометрия будет от
      // недогруженной страницы.
      if (doc.fonts?.ready) doc.fonts.ready.then(settle, settle);
      else settle();
    };

    frame.onerror = () => {
      window.clearTimeout(timer);
      frame.remove();
      reject(new Error('Страница не открылась'));
    };

    document.body.appendChild(frame);
  });
}

const fileNameFrom = (url: string): string => {
  try {
    const name = new URL(url, location.origin).pathname.split('/').pop() || 'image';
    return decodeURIComponent(name);
  } catch {
    return 'image';
  }
};

export interface ImportOptions {
  url: string;
  slug: string;
  name: string;
  width: number;
  /** занять слаг рукописного шаблона (его файлы сначала копируются) */
  adopt?: boolean;
  /**
   * patch — правим существующий шаблон: экспорт допишет разницу и не тронет
   * ни разметку, ни script.js. build — собираем новый шаблон с нуля.
   */
  mode?: ProjectMode;
  onStep?: (message: string) => void;
}

/**
 * Адрес шаблона сайта. «Средиземноморье» лежит не в своей папке, а прямо в
 * корне invite — это историческая особенность, и её надо учитывать.
 */
export const galleryTemplateUrl = (id: string): string =>
  id === 'mediterranean' ? '/invite/index.html' : `/invite/${id}/index.html`;

/** Оригинал «Средиземноморья» занять нельзя: его файлы лежат в общей папке. */
export const canAdoptTemplate = (id: string): boolean => id !== 'mediterranean';

/** Создаёт новый проект из чужой страницы. Возвращает отчёт для показа. */
export async function importPageIntoNewProject(options: ImportOptions): Promise<string[]> {
  const { url, slug, name, width, adopt, mode = 'build', onStep } = options;
  const store = useStudio.getState();

  onStep?.('Загружаю страницу…');
  const { doc, dispose } = await loadInFrame(proxyUrl(url), width);

  let page: ImportedPage;
  try {
    onStep?.('Разбираю на слои…');
    page = importDocument(doc, width);
  } finally {
    dispose();
  }

  onStep?.('Создаю проект…');
  await store.createProject(slug, name, width, adopt, mode);

  /* В режиме правки картинки копировать некуда и незачем: они уже лежат в
     папке шаблона, и слои смотрят на них по исходным адресам. Копии только
     раздували бы папку и попадали в коммит — «сохранить», а не «добавить». */
  const byUrl = new Map<string, Asset>();
  let failed = 0;

  if (mode === 'build') {
    onStep?.(`Втягиваю картинки: ${page.images.length}`);
    for (const [index, src] of page.images.entries()) {
      onStep?.(`Картинка ${index + 1} из ${page.images.length}`);
      try {
        const response = await fetch(proxyUrl(src));
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        const file = new File([blob], fileNameFrom(src), { type: blob.type });
        byUrl.set(src, await useStudio.getState().uploadAsset(file));
      } catch {
        failed += 1;
      }
    }
  }

  relinkAssets(page.sections, byUrl, mode === 'patch');
  const fonts = registerFonts(page.fonts, page.sections);

  useStudio.getState().commit('Импорт страницы', (draft) => {
    draft.sections = page.sections;
    draft.fonts = fonts;
  });
  useStudio.getState().setActiveSection(page.sections[0]?.id ?? null);

  const report = [...page.report];
  report.push(`Шрифтов подключено: ${fonts.length}`);
  if (failed) report.push(`Не удалось забрать картинок: ${failed}`);
  report.push('Слои расставлены по геометрии оригинала — дальше правьте руками');
  return report;
}


/** Создаёт новый проект из PDF: страница — секция. */
export async function importPdfIntoNewProject(options: {
  file: File;
  slug: string;
  name: string;
  width: number;
  onStep?: (message: string) => void;
}): Promise<string[]> {
  const { file, slug, name, width, onStep } = options;

  const { pages, report } = await importPdf(file, width, onStep);
  if (!pages.length) throw new Error('В файле нет страниц');

  onStep?.('Создаю проект…');
  await useStudio.getState().createProject(slug, name, width);

  const sections: Section[] = [];
  for (const [index, page] of pages.entries()) {
    onStep?.(`Кладу страницу ${index + 1} из ${pages.length}`);
    const asset = await useStudio.getState().uploadAsset(page.image);
    sections.push({
      id: uid(),
      name: `Страница ${index + 1}`,
      height: { mode: 'ratio', value: page.ratio },
      background: { color: '#ffffff', image: asset.id },
      layers: page.texts,
    });
  }

  useStudio.getState().commit('Импорт PDF', (draft) => {
    draft.sections = sections;
  });
  useStudio.getState().setActiveSection(sections[0].id);

  return report;
}


/* Импорт виден из консоли по той же причине, что и стор: разбор чужой
   страницы отлаживается только сравнением чисел с оригиналом, а через
   интерфейс каждый прогон — это десяток кликов. Только в разработке. */
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__studioImport = {
    importPageIntoNewProject,
    importPdfIntoNewProject,
    galleryTemplateUrl,
  };
}
