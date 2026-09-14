'use client';

/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — импорт PDF постранично.

   Каждая страница становится секцией: сама страница ложится подложкой, а
   текстовые куски — настоящими текстовыми слоями с координатами из файла.
   Дальше обычно удаляют либо подложку (оставив живой текст), либо текстовые
   слои (оставив картинку) — об этом сказано в отчёте импорта.

   Читалка pdf.js подключается с CDN и только здесь: тащить её в зависимости
   проекта ради инструмента, который работает лишь в разработке, незачем.
   ═══════════════════════════════════════════════════════════════════════════ */

import { TextLayer, baseLayer } from '../types';

const PDFJS_VERSION = '3.11.174';
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

/* Минимальные описания того, чем мы пользуемся — типов пакета у нас нет. */
interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
}
interface PdfPage {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
    promise: Promise<void>;
  };
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
}
interface PdfDocument {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
}
interface PdfLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
}

declare global {
  interface Window {
    pdfjsLib?: PdfLib;
  }
}

let loading: Promise<PdfLib> | null = null;

function loadPdfJs(): Promise<PdfLib> {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (loading) return loading;

  loading = new Promise<PdfLib>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${PDFJS_BASE}/pdf.min.js`;
    script.onload = () => {
      const lib = window.pdfjsLib;
      if (!lib) {
        reject(new Error('pdf.js загрузился, но не объявился'));
        return;
      }
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
      resolve(lib);
    };
    script.onerror = () => reject(new Error('Не удалось загрузить pdf.js с CDN'));
    document.head.appendChild(script);
  });

  return loading;
}

export interface PdfPageImport {
  /** страница целиком — ляжет подложкой секции */
  image: File;
  /** пропорция страницы: высота к ширине */
  ratio: number;
  texts: TextLayer[];
}

export interface PdfImport {
  pages: PdfPageImport[];
  report: string[];
}

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Страница не закодировалась'))),
      'image/webp',
      0.9,
    ),
  );

/** Разбирает PDF. `canvasWidth` — эталонная ширина будущего проекта. */
export async function importPdf(
  file: File,
  canvasWidth: number,
  onStep?: (message: string) => void,
): Promise<PdfImport> {
  onStep?.('Загружаю читалку PDF…');
  const pdfjs = await loadPdfJs();

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: PdfPageImport[] = [];
  const report: string[] = [];

  for (let number = 1; number <= doc.numPages; number++) {
    onStep?.(`Страница ${number} из ${doc.numPages}`);
    const page = await doc.getPage(number);

    // Считаем масштаб так, чтобы страница легла ровно в ширину холста,
    // а растр вышел с двойной плотностью.
    const unit = page.getViewport({ scale: 1 });
    const toCanvas = canvasWidth / unit.width;
    const viewport = page.getViewport({ scale: toCanvas * 2 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Браузер не дал контекст canvas');
    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await toBlob(canvas);
    const image = new File([blob], `page-${number}.webp`, { type: 'image/webp' });

    /* текстовые куски */
    const content = await page.getTextContent();
    const texts: TextLayer[] = [];

    for (const item of content.items) {
      const value = (item.str || '').trim();
      if (!value) continue;

      // transform: [a, b, c, d, e, f] — e/f это левый нижний угол строки,
      // а d даёт кегль. Пересчитываем в координаты холста с верхним нулём.
      const [, , , d, e, f] = item.transform;
      const size = Math.abs(d) * toCanvas;
      const width = (item.width || value.length * Math.abs(d) * 0.5) * toCanvas;
      const x = e * toCanvas;
      const y = (unit.height - f) * toCanvas - size;

      texts.push({
        ...baseLayer(value.slice(0, 24), x, y, Math.max(width, size), size * 1.25),
        kind: 'text',
        autoHeight: true,
        content: value,
        tag: 'p',
        font: 'var(--font-body, serif)',
        size,
        lineHeight: 1.25,
        tracking: 0,
        align: 'left',
        color: '#000000',
      });
    }

    pages.push({ image, ratio: unit.height / unit.width, texts });
  }

  report.push(`Страниц: ${pages.length}`);
  report.push(`Текстовых кусков: ${pages.reduce((sum, p) => sum + p.texts.length, 0)}`);
  report.push(
    'Страница лежит подложкой, текст — слоями поверх. Оставьте что-то одно: ' +
      'подложку ради точной картинки или текст ради живого содержимого',
  );

  return { pages, report };
}
