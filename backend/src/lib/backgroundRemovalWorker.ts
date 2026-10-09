import os from 'os';
import { parentPort, workerData } from 'worker_threads';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';

interface Job { id: number; inputPath: string }

// Модель загружается один раз на жизнь потока: пара обычно убирает фон у двух фото
// подряд, и второе не ждёт повторной загрузки 25 МБ весов и оптимизации графа.
const { modelPath } = workerData as { modelPath: string };
// The thread lives on between jobs: libvips' cache would keep input files open (and their
// disk space taken after the upload is deleted).
sharp.cache(false);
const threads = Math.max(1, Math.min(2, typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length));
let sessionPromise: Promise<ort.InferenceSession> | null = null;
const session = () => sessionPromise ??= ort.InferenceSession.create(modelPath, {
  executionProviders: ['cpu'], intraOpNumThreads: threads, interOpNumThreads: 1,
  executionMode: 'sequential', graphOptimizationLevel: 'all',
});

async function run(inputPath: string, stage: { decoding: boolean }): Promise<Buffer> {
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
  stage.decoding = false;
  const model = await session();
  const result = await model.run({ [model.inputNames[0]]: new ort.Tensor('float32', tensor, [1, 3, 512, 512]) });
  const prediction = result[model.outputNames[0]].data as Float32Array;
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < plane; i++) { low = Math.min(low, prediction[i]); high = Math.max(high, prediction[i]); }
  if (!Number.isFinite(high - low) || high - low < 0.0001) throw new Error('Не удалось выделить людей. Попробуйте другое фото.');
  const mask = Buffer.alloc(plane);
  for (let i = 0; i < plane; i++) mask[i] = Math.round(Math.max(0, Math.min(1, prediction[i])) * 255);
  const alpha = await sharp(mask, { raw: { width: 512, height: 512, channels: 1 } })
    .resize(info.width, info.height, { fit: 'fill', kernel: 'lanczos3' }).greyscale().raw().toBuffer();
  for (let i = 0; i < info.width * info.height; i++) rgba[i * 4 + 3] = Math.round(rgba[i * 4 + 3] * alpha[i] / 255);
  // WebP вместо PNG: прозрачность без потерь (alphaQuality 100), цвет — q95, на глаз
  // не отличить (PSNR ≈ 46 дБ), а файл в ~20 раз меньше: 1800 px PNG весил 5–7 МБ,
  // и именно его потом скачивали редактор и каждый гость.
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 95, alphaQuality: 100, effort: 4 }).toBuffer();
}

parentPort!.on('message', (job: Job | { warm: true }) => {
  if ('warm' in job) { session().catch(() => { sessionPromise = null; }); return; }
  const stage = { decoding: true };
  run(job.inputPath, stage).then(image => parentPort!.postMessage({ id: job.id, image })).catch(error => {
    const expected = error instanceof Error && /Для удаления|Не удалось выделить/.test(error.message);
    const message = expected ? error.message : stage.decoding
      ? 'Не удалось прочитать фото. Загрузите корректное изображение до 16 мегапикселей.'
      : 'Не удалось обработать фото. Попробуйте позже.';
    if (!stage.decoding && !expected) sessionPromise = null;   // сломанную сессию не переиспользуем
    parentPort!.postMessage({ id: job.id, error: message, status: stage.decoding || expected ? 400 : 503 });
  });
});
