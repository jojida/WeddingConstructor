'use client';

/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — приём файла.

   Обработка идёт в браузере: у него уже есть полный конвейер изображений —
   декодер с учётом EXIF, canvas и кодировщик webp. Тащить ради этого нативные
   зависимости в проект незачем.

   Что происходит с файлом: разворот по EXIF → ужатие до удвоенной ширины
   холста → webp → миниатюра → хеш против дублей.
   ═══════════════════════════════════════════════════════════════════════════ */

import { Asset, uid } from '../types';
import { slugify } from '../slug';

/** Качество webp: на фотографиях разница с оригиналом не видна. */
const WEBP_QUALITY = 0.86;
/** Сторона миниатюры для панелей. */
const THUMB_SIDE = 64;

export interface Ingested {
  asset: Asset;
  /** содержимое файла в base64 — уходит на сервер и ложится в assets/ */
  base64: string;
  /** сколько весил исходник, чтобы показать выигрыш */
  originalBytes: number;
}

const isSvg = (file: File) =>
  file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(blob);
  });

/** Собственные размеры SVG: из width/height, иначе из viewBox. */
function svgSize(text: string): { w: number; h: number } {
  const attr = (name: string) => {
    const match = text.match(new RegExp(`${name}\\s*=\\s*"([^"]+)"`, 'i'));
    return match ? parseFloat(match[1]) : NaN;
  };
  const w = attr('width');
  const h = attr('height');
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { w, h };

  const box = text.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (box) {
    const parts = box[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { w: parts[2], h: parts[3] };
    }
  }
  return { w: 300, h: 300 };
}

function drawToCanvas(source: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Браузер не дал контекст canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Не удалось закодировать webp'))),
      'image/webp',
      quality,
    ),
  );

function thumbFrom(source: CanvasImageSource, w: number, h: number): string {
  const scale = THUMB_SIDE / Math.max(w, h);
  const canvas = drawToCanvas(source, w * scale, h * scale);
  return canvas.toDataURL('image/webp', 0.7);
}

/** Загружает SVG как картинку — нужно только ради миниатюры. */
const loadSvgImage = (text: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG не удалось отрисовать'));
    };
    img.src = url;
  });

/**
 * Принимает файл и готовит его к тому, чтобы лечь в шаблон.
 * `existing` — уже известные ассеты: одно и то же фото, брошенное дважды,
 * не задваивает файл.
 */
export async function ingestFile(
  file: File,
  canvasWidth: number,
  existing: Asset[],
): Promise<Ingested | { duplicate: Asset }> {
  const buffer = await file.arrayBuffer();
  const hash = (await sha256(buffer)).slice(0, 16);

  const already = existing.find((a) => a.id === hash);
  if (already) return { duplicate: already };

  const stem = slugify(file.name.replace(/\.[^.]+$/, ''), 32) || 'file';

  if (isSvg(file)) {
    const text = new TextDecoder().decode(buffer);
    const { w, h } = svgSize(text);
    let thumb = '';
    try {
      const img = await loadSvgImage(text);
      thumb = thumbFrom(img, w, h);
    } catch {
      /* без миниатюры переживём */
    }
    return {
      asset: {
        id: hash,
        file: `${stem}-${hash.slice(0, 6)}.svg`,
        kind: 'svg',
        w,
        h,
        bytes: file.size,
        thumb,
      },
      base64: await blobToBase64(new Blob([buffer], { type: 'image/svg+xml' })),
      originalBytes: file.size,
    };
  }

  // imageOrientation разворачивает снимок с телефона по EXIF — иначе фото
  // легло бы на бок ровно так, как оно записано в файле.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const targetWidth = Math.min(bitmap.width, Math.round(canvasWidth * 2));
  const scale = targetWidth / bitmap.width;
  const outW = targetWidth;
  const outH = Math.round(bitmap.height * scale);

  const canvas = drawToCanvas(bitmap, outW, outH);
  const webp = await toBlob(canvas, WEBP_QUALITY);
  const thumb = thumbFrom(bitmap, bitmap.width, bitmap.height);
  bitmap.close?.();

  return {
    asset: {
      id: hash,
      file: `${stem}-${hash.slice(0, 6)}.webp`,
      kind: 'image',
      w: outW,
      h: outH,
      bytes: webp.size,
      thumb,
    },
    base64: await blobToBase64(webp),
    originalBytes: file.size,
  };
}

/** Файл шрифта кладётся как есть — перекодировать его нечем и незачем. */
export async function ingestFont(file: File): Promise<{ file: string; base64: string }> {
  const ext = (file.name.split('.').pop() ?? 'woff2').toLowerCase();
  const stem = slugify(file.name.replace(/\.[^.]+$/, ''), 32) || `font-${uid()}`;
  return { file: `${stem}.${ext}`, base64: await blobToBase64(file) };
}
