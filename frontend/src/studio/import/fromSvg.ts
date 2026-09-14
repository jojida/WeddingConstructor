'use client';

/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — импорт SVG послойно.

   Экспорт из Canva приходит одним файлом, внутри которого лежат отдельные
   группы: подложка, цветы, надписи. Бросить его на холст целиком можно и так,
   но тогда это одна неразбираемая картинка.

   Здесь каждая группа верхнего уровня становится своим слоем. Координаты
   берутся числами из самого файла через getBBox — никакого угадывания
   по картинке.
   ═══════════════════════════════════════════════════════════════════════════ */

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SvgPiece {
  /** готовый самостоятельный SVG для этого куска */
  file: File;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SvgImport {
  pieces: SvgPiece[];
  /** пропорция исходника: высота к ширине */
  ratio: number;
  report: string[];
}

/** Куски, из которых ничего не нарисуешь. */
const SKIP = new Set(['defs', 'style', 'title', 'desc', 'metadata']);

function viewBoxOf(svg: SVGSVGElement): { x: number; y: number; w: number; h: number } {
  const box = svg.viewBox?.baseVal;
  if (box && box.width > 0 && box.height > 0) {
    return { x: box.x, y: box.y, w: box.width, h: box.height };
  }
  const w = parseFloat(svg.getAttribute('width') || '') || 300;
  const h = parseFloat(svg.getAttribute('height') || '') || 300;
  return { x: 0, y: 0, w, h };
}

/**
 * Разбирает SVG на слои. `canvasWidth` — ширина холста проекта: координаты
 * сразу пересчитываются в неё.
 */
export async function importSvg(file: File, canvasWidth: number): Promise<SvgImport> {
  const text = await file.text();
  const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
  const source = parsed.documentElement as unknown as SVGSVGElement;
  const report: string[] = [];

  if (source.tagName.toLowerCase() !== 'svg') {
    throw new Error('Это не SVG');
  }

  const box = viewBoxOf(source);
  const scale = canvasWidth / box.w;

  // Чтобы браузер посчитал границы, документ должен быть на странице.
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0;pointer-events:none';
  const live = document.importNode(source, true) as unknown as SVGSVGElement;
  live.setAttribute('width', String(box.w));
  live.setAttribute('height', String(box.h));
  holder.appendChild(live);
  document.body.appendChild(holder);

  const pieces: SvgPiece[] = [];

  try {
    const children = Array.from(live.children).filter(
      (el) => !SKIP.has(el.tagName.toLowerCase()),
    );

    // Общие определения (градиенты, маски) нужны каждому куску, иначе
    // вырезанная группа потеряет заливку.
    const defs = Array.from(live.children).filter(
      (el) => el.tagName.toLowerCase() === 'defs' || el.tagName.toLowerCase() === 'style',
    );

    children.forEach((child, index) => {
      let bbox: DOMRect;
      try {
        bbox = (child as SVGGraphicsElement).getBBox();
      } catch {
        return;
      }
      if (bbox.width < 1 || bbox.height < 1) return;

      const piece = document.createElementNS(SVG_NS, 'svg');
      piece.setAttribute('xmlns', SVG_NS);
      // viewBox по границам куска — картинка ровно заполняет свой слой.
      piece.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
      piece.setAttribute('width', String(Math.round(bbox.width)));
      piece.setAttribute('height', String(Math.round(bbox.height)));
      defs.forEach((d) => piece.appendChild(d.cloneNode(true)));
      piece.appendChild(child.cloneNode(true));

      const markup = new XMLSerializer().serializeToString(piece);
      const label = child.getAttribute('id') || child.tagName.toLowerCase();
      const name = `${label}-${index + 1}`.slice(0, 40);

      pieces.push({
        file: new File([markup], `${name}.svg`, { type: 'image/svg+xml' }),
        name,
        x: (bbox.x - box.x) * scale,
        y: (bbox.y - box.y) * scale,
        w: bbox.width * scale,
        h: bbox.height * scale,
      });
    });
  } finally {
    holder.remove();
  }

  report.push(`Кусков в файле: ${pieces.length}`);
  if (!pieces.length) report.push('Разобрать не вышло — файл ляжет одной картинкой');

  return { pieces, ratio: box.h / box.w, report };
}
