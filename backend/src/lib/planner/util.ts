// Общие мелочи планировщика (меню и рассадка): лимиты, чистка текста, склонения,
// замок на приглашение и ошибка с HTTP-статусом для роутов.

export const LIMITS = {
  persons: 500,        // людей на приглашение
  tables: 100,
  options: 12,         // вариантов блюда
  partyPeople: 20,     // человек в одном ответе (как у анкеты)
  name: 120,
  tag: 40,
  diet: 200,
  tableName: 40,
  optionLabel: 60,
  optionNote: 200,
  capacityMax: 50,
  seatBatch: 50,       // людей за один запрос посадки
  notices: 100,        // сколько сообщений хранить
  importLines: 300,    // строк при вставке списка гостей
  importBytes: 20_000,
} as const;

/** Ошибка сервиса с готовым ответом: роут отдаёт { error, ...extra } со статусом. */
export class PlannerError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
    this.name = 'PlannerError';
  }
}

/** Строка из тела запроса: управляющие символы и лишние пробелы убираются, текст
    приводится к NFC (чтобы «й» и «ё» не разваливались на две буквы). Не строка или
    длиннее max — null (роут отвечает 400); пустое значение — ''. */
export function cleanText(value: unknown, max: number): string | null {
  if (value == null) return '';
  if (typeof value !== 'string') return null;
  const text = value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : null;
}

/** Ключ для сравнения имён: регистр, «ё» и лишние пробелы не важны. */
export function nameKey(value: string): string {
  return value.normalize('NFC').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

/** 1 стол, 2 стола, 5 столов. */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Целое в границах из тела запроса; не число — null. */
export function intInRange(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

export const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

/** Имя ошибки для лога: сообщения Prisma содержат значения из запроса — это данные гостей. */
export function errName(e: unknown): string {
  if (e && typeof e === 'object') {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    const name = (e as { name?: unknown }).name;
    if (typeof name === 'string') return name;
  }
  return 'Error';
}

// Замок на приглашение: синхронизация состава идёт по одному запросу за раз, иначе две
// вкладки владельца создали бы по заготовке каждая. Бэкенд работает одним процессом
// (как и ограничитель запросов); от гонок за места этот замок не нужен — они закрыты в SQL.
const chains = new Map<string, Promise<unknown>>();

export function withInviteLock<T>(inviteId: string, task: () => Promise<T>): Promise<T> {
  const previous = chains.get(inviteId) ?? Promise.resolve();
  const run = previous.then(task);
  const tail = run.then(() => undefined, () => undefined);
  chains.set(inviteId, tail);
  void tail.then(() => { if (chains.get(inviteId) === tail) chains.delete(inviteId); });
  return run;
}
