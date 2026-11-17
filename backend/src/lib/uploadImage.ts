import sharp from 'sharp';
import fs from 'fs';

const IMAGE_FORMATS: Record<string, string> = {
  'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
};

/** Longest side of a published photo. A phone shows at most ~1300 px (430 css px
    × 3), a wide desktop cover ~2000; a 24 MP original costs every guest ten times
    the bytes for the same picture. */
export const WEB_MAX_SIDE = 2000;
/** Printed cards: the print editor scales to 2400 px itself (≈290 dpi on A5). */
export const PRINT_MAX_SIDE = 2400;

export class InvalidUploadImage extends Error {}

export interface NormalizedImage {
  data: Buffer;
  /** Opaque PNG photos become JPEG: the caller renames the file to this extension. */
  ext: '.jpg' | '.png' | '.webp' | '.gif';
}

export interface NormalizeOptions {
  maxSide?: number;
  /** JPEG/WebP quality of an opaque photo. */
  quality?: number;
}

/** Decode before publishing, discard EXIF/GPS/XMP and trailing payloads, apply
    orientation and shrink still photos to what a screen needs. */
export async function normalizeUploadImage(file: string, mime: string, options: NormalizeOptions = {}): Promise<NormalizedImage> {
  const maxSide = options.maxSide || WEB_MAX_SIDE;
  const quality = options.quality || 82;
  try {
    // Buffer input also avoids libvips retaining a file handle while Windows
    // replaces the quarantined file with its normalized version.
    const bytesIn = await fs.promises.readFile(file);
    if (bytesIn.length > 10 * 1024 * 1024) throw new InvalidUploadImage();
    const input = sharp(bytesIn, { animated: true, limitInputPixels: 24_000_000, failOn: 'warning' });
    const meta = await input.metadata();
    const height = meta.pageHeight || meta.height || 0;
    const pixels = (meta.width || 0) * height * (meta.pages || 1);
    if (meta.format !== IMAGE_FORMATS[mime] || pixels === 0 || pixels > 24_000_000 ||
        Math.max(meta.width || 0, height) > 12000) throw new InvalidUploadImage();
    let out: NormalizedImage;
    if (meta.format === 'gif' || (meta.pages || 1) > 1) {
      // GIF and animations keep their frames, timing and geometry. Rotate only
      // still images: multipage formats preserve their frame geometry.
      const normalized = (meta.pages || 1) === 1 ? input.rotate() : input;
      out = { data: await normalized.toBuffer(), ext: meta.format === 'gif' ? '.gif' : '.webp' };
    } else {
      const still = input.rotate().resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true });
      if (meta.format === 'jpeg') {
        out = { data: await still.jpeg({ quality, mozjpeg: true }).toBuffer(), ext: '.jpg' };
      } else if (meta.format === 'png') {
        // A screenshot or exported photo in PNG weighs megabytes: as JPEG it is
        // ten times lighter. Transparency (cutouts) keeps the format, and so do
        // small pictures — icons and drawings would get JPEG halos for no gain.
        const photo = bytesIn.length > 512 * 1024 &&
          (!meta.hasAlpha || (await sharp(bytesIn, { failOn: 'warning' }).stats()).isOpaque);
        out = photo
          ? { data: await still.jpeg({ quality, mozjpeg: true }).toBuffer(), ext: '.jpg' }
          : { data: await still.png({ compressionLevel: 9 }).toBuffer(), ext: '.png' };
      } else {
        out = { data: await still.webp(meta.hasAlpha ? { quality: 90, alphaQuality: 100 } : { quality }).toBuffer(), ext: '.webp' };
      }
    }
    if (out.data.length > 10 * 1024 * 1024) throw new InvalidUploadImage();
    return out;
  } catch {
    throw new InvalidUploadImage('Изображение повреждено или слишком велико');
  }
}
