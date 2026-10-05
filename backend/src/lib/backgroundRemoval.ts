import path from 'path';
import { Worker } from 'worker_threads';

export class BackgroundRemovalError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// One small CPU job at a time; terminate its worker to release model memory.
let active = false;
export function removeBackground(inputPath: string): Promise<Buffer> {
  if (active) return Promise.reject(new BackgroundRemovalError('Сейчас обрабатывается другое фото. Попробуйте ещё раз через несколько секунд.', 503));
  active = true;
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(path.join(__dirname, 'backgroundRemovalWorker.js'), {
        workerData: { inputPath, modelPath: path.join(__dirname, '../../assets/background-removal/modnet.onnx') },
      });
    } catch {
      active = false;
      reject(new BackgroundRemovalError('Не удалось запустить удаление фона. Попробуйте позже.', 503));
      return;
    }
    let finished = false;
    const finish = async (error?: Error, output?: Uint8Array) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      await worker.terminate().catch(() => {});
      active = false;
      if (error) reject(error); else resolve(Buffer.from(output!));
    };
    const timer = setTimeout(() => void finish(new BackgroundRemovalError('Обработка заняла слишком много времени. Попробуйте фото меньшего размера.', 503)), 45_000);
    worker.once('message', (message: { png?: Uint8Array; error?: string; status?: number }) => {
      if (message.png) void finish(undefined, message.png);
      else void finish(new BackgroundRemovalError(message.error || 'Не удалось обработать фото.', message.status || 503));
    });
    worker.once('error', () => void finish(new BackgroundRemovalError('Не удалось запустить удаление фона. Попробуйте позже.', 503)));
    worker.once('exit', () => void finish(new BackgroundRemovalError('Обработка фото прервалась. Попробуйте ещё раз.', 503)));
  });
}
