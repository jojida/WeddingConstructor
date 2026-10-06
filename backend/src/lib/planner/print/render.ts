// Документ (layout.ts) → PDF через PDFKit: векторный текст, шрифты встраиваются подмножеством.
// Цвета — RGB, без вылетов: для домашнего принтера и цифровой печати. Офсетной типографии
// (CMYK, вылеты, шрифты в кривых) этот файл не заменяет — так и пишем в кабинете.
import PDFDocument from 'pdfkit';
import { FAMILIES, FEATURES, fontFile, measure, pdfFontName, runs } from './fonts';
import type { Doc, Item, TextItem } from './layout';

type Pdf = InstanceType<typeof PDFDocument>;

function drawText(doc: Pdf, item: TextItem): void {
  if (!item.text) return;
  const spacing = item.spacing ?? 0;
  const chars = [...item.text].length;
  const width = measure(item.text, item.family, item.size) + spacing * Math.max(0, chars - 1);
  let x = item.align === 'left' ? item.x : item.align === 'right' ? item.x + item.width - width : item.x + (item.width - width) / 2;
  doc.fillColor(item.color);
  for (const run of runs(item.text)) {
    doc.font(pdfFontName(item.family, run.cyr)).fontSize(item.size);
    // Базовая линия одна для всех кусков, хотя у кириллического и латинского файла разные метрики
    doc.text(run.text, x, item.y, { lineBreak: false, baseline: 'alphabetic', characterSpacing: spacing, features: FEATURES as PDFKit.Mixins.OpenTypeFeatures[] });
    x += measure(run.text, item.family, item.size) + spacing * [...run.text].length;
  }
}

function draw(doc: Pdf, item: Item): void {
  switch (item.kind) {
    case 'text':
      drawText(doc, item);
      return;
    case 'line':
      doc.save().lineWidth(item.width).strokeColor(item.color);
      if (item.dash) doc.dash(item.dash[0], { space: item.dash[1] });
      doc.moveTo(item.x1, item.y1).lineTo(item.x2, item.y2).stroke();
      doc.restore();
      return;
    case 'rect':
      doc.save();
      if (item.dash) doc.dash(item.dash[0], { space: item.dash[1] });
      doc.rect(item.x, item.y, item.w, item.h);
      if (item.fill && item.stroke) doc.lineWidth(item.width ?? 0.5).fillAndStroke(item.fill, item.stroke);
      else if (item.fill) doc.fill(item.fill);
      else doc.lineWidth(item.width ?? 0.5).stroke(item.stroke ?? '#000000');
      doc.restore();
      return;
    case 'diamond':
      doc.save().fillColor(item.color)
        .polygon([item.cx, item.cy - item.r], [item.cx + item.r, item.cy], [item.cx, item.cy + item.r], [item.cx - item.r, item.cy])
        .fill();
      doc.restore();
      return;
    case 'flip':
      doc.save().rotate(180, { origin: [item.cx, item.cy] });
      for (const inner of item.items) draw(doc, inner);
      doc.restore();
      return;
  }
}

export function renderPdf(d: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: d.size, margin: 0, autoFirstPage: false, info: { Title: `WeddingCraft — ${d.title}`, Creator: 'WeddingCraft' } });
    for (const family of FAMILIES) {
      doc.registerFont(pdfFontName(family, true), fontFile(family, true));
      doc.registerFont(pdfFontName(family, false), fontFile(family, false));
    }
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    for (const page of d.pages) {
      doc.addPage({ size: d.size, margin: 0 });
      for (const item of page.items) draw(doc, item);
    }
    doc.end();
  });
}
