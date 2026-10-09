import path from 'path';
import { Worker } from 'worker_threads';

export class BackgroundRemovalError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/* One CPU job at a time in one worker thread. The worker keeps the model loaded for
   a short while after a job (or a warm-up request from the editor): the couple usually
   cuts out two photos in a row, and on the small VPS a cold start — native runtime,
   25 MB of weights, graph optimisation — took several seconds of the wait. After
   IDLE_MS without work the worker is terminated to release the model memory. */
const IDLE_MS = 120_000;
const JOB_MS = 45_000;
const modelPath = path.join(__dirname, '../../assets/background-removal/modnet.onnx');

type Reply = { id: number; image?: Uint8Array; error?: string; status?: number };
let worker: Worker | null = null;
let idleTimer: NodeJS.Timeout | null = null;
let current: { id: number; worker: Worker; settle: (error?: Error, image?: Uint8Array) => void } | null = null;
let nextId = 1;

function stopWorker(target: Worker | null = worker) {
  if (!target) return;
  if (target === worker) worker = null;
  void target.terminate().catch(() => {});
}

function armIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { idleTimer = null; if (!current) stopWorker(); }, IDLE_MS);
  idleTimer.unref();
}

function ensureWorker(): Worker {
  if (worker) return worker;
  const created = new Worker(path.join(__dirname, 'backgroundRemovalWorker.js'), { workerData: { modelPath } });
  worker = created;
  created.on('message', (message: Reply) => {
    if (!current || message.id !== current.id) return;
    if (message.image) current.settle(undefined, message.image);
    else current.settle(new BackgroundRemovalError(message.error || 'Не удалось обработать фото.', message.status || 503));
  });
  const lost = (error: BackgroundRemovalError) => {
    if (worker === created) worker = null;
    if (current?.worker === created) current.settle(error);
  };
  created.once('error', () => lost(new BackgroundRemovalError('Не удалось запустить удаление фона. Попробуйте позже.', 503)));
  created.once('exit', () => lost(new BackgroundRemovalError('Обработка фото прервалась. Попробуйте ещё раз.', 503)));
  // An idle warm worker must not keep the process (or a test run) alive. After the
  // listeners: subscribing to 'message' refs the worker's port again.
  created.unref();
  return created;
}

/** Load the model in advance (editor: the pointer is on «Убрать фон»). Cheap when warm. */
export function warmBackgroundRemoval(): void {
  try {
    const w = ensureWorker();
    if (!current) { w.postMessage({ warm: true }); armIdle(); }
  } catch { /* the real request will report the problem */ }
}

export function removeBackground(inputPath: string): Promise<Buffer> {
  if (current) return Promise.reject(new BackgroundRemovalError('Сейчас обрабатывается другое фото. Попробуйте ещё раз через несколько секунд.', 503));
  let w: Worker;
  try { w = ensureWorker(); } catch {
    return Promise.reject(new BackgroundRemovalError('Не удалось запустить удаление фона. Попробуйте позже.', 503));
  }
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      // A stuck job holds the CPU: drop this worker, the next request starts a fresh one
      current?.settle(new BackgroundRemovalError('Обработка заняла слишком много времени. Попробуйте фото меньшего размера.', 503));
      stopWorker(w);
    }, JOB_MS);
    current = {
      id,
      worker: w,
      settle: (error, image) => {
        if (!current || current.id !== id) return;
        current = null;
        clearTimeout(timer);
        if (worker) armIdle();
        if (error) reject(error); else resolve(Buffer.from(image!));
      },
    };
    w.postMessage({ id, inputPath });
  });
}
