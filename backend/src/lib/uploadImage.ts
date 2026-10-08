import sharp from 'sharp';
import fs from 'fs';

const IMAGE_FORMATS: Record<string, string> = {
  'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
};

export class InvalidUploadImage extends Error {}

/** Decode before publishing, discard EXIF/GPS/XMP and trailing payloads. */
export async function normalizeUploadImage(file: string, mime: string): Promise<Buffer> {
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
    // Rotate only still images: multipage formats preserve their frame geometry.
    const normalized = (meta.pages || 1) === 1 ? input.rotate() : input;
    const bytes = await normalized.toBuffer();
    if (bytes.length > 10 * 1024 * 1024) throw new InvalidUploadImage();
    return bytes;
  } catch {
    throw new InvalidUploadImage('Изображение повреждено или слишком велико');
  }
}
