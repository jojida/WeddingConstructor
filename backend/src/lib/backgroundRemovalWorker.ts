import { parentPort, workerData } from 'worker_threads';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';

let decoding = true;
async function run() {
  const { inputPath, modelPath } = workerData as { inputPath: string; modelPath: string };
  const image = sharp(inputPath, { limitInputPixels: 16_000_000 });
  const metadata = await image.metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format || '')) throw new Error('Для удаления фона загрузите JPG, PNG или WebP.');
  // Decode/orient once and bound both output size and memory on the small VPS.
  const { data: rgba, info } = await image.rotate()
    .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
    .toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .removeAlpha().resize(512, 512, { fit: 'fill', kernel: 'linear' }).raw().toBuffer();
  const plane = 512 * 512;
  const tensor = new Float32Array(plane * 3);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) tensor[c * plane + i] = pixels[i * 3 + c] / 127.5 - 1;
  }
  decoding = false;
  const session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'], intraOpNumThreads: 1, interOpNumThreads: 1,
    executionMode: 'sequential', graphOptimizationLevel: 'all',
  });
  try {
    const result = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', tensor, [1, 3, 512, 512]) });
    const prediction = result[session.outputNames[0]].data as Float32Array;
    let low = Infinity, high = -Infinity;
    for (let i = 0; i < plane; i++) { low = Math.min(low, prediction[i]); high = Math.max(high, prediction[i]); }
    if (!Number.isFinite(high - low) || high - low < 0.0001) throw new Error('Не удалось выделить людей. Попробуйте другое фото.');
    const mask = Buffer.alloc(plane);
    for (let i = 0; i < plane; i++) mask[i] = Math.round(Math.max(0, Math.min(1, prediction[i])) * 255);
    const alpha = await sharp(mask, { raw: { width: 512, height: 512, channels: 1 } })
      .resize(info.width, info.height, { fit: 'fill', kernel: 'lanczos3' }).greyscale().raw().toBuffer();
    for (let i = 0; i < info.width * info.height; i++) rgba[i * 4 + 3] = Math.round(rgba[i * 4 + 3] * alpha[i] / 255);
    return await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  } finally { await session.release(); }
}

run().then(png => parentPort!.postMessage({ png })).catch(error => {
  const expected = error instanceof Error && /Для удаления|Не удалось выделить/.test(error.message);
  const message = expected ? error.message : decoding
    ? 'Не удалось прочитать фото. Загрузите корректное изображение до 16 мегапикселей.'
    : 'Не удалось обработать фото. Попробуйте позже.';
  parentPort!.postMessage({ error: message, status: decoding || expected ? 400 : 503 });
});
