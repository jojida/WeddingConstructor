// Подробности ответа гостя: «придёт / нет / пока не знает», дети и ответы на
// дополнительные вопросы анкеты. Вопросы задаёт общий модуль шаблонов
// frontend/public/invite/assets/rsvp-count.js — он же шлёт текст вопроса
// вместе с ответом, поэтому кабинету и уведомлениям не нужен свой справочник.

export type Attendance = 'yes' | 'no' | 'maybe';

export interface RsvpAnswer {
  id: string;                  // ключ вопроса: menu, transfer, custom…
  q: string;                   // текст вопроса, как его видел гость
  a: string;                   // ответ; у мультивыбора варианты через «, »
  t: 'one' | 'many' | 'text';  // выбор одного, нескольких или свободный ответ
}

const ATTENDANCE: readonly string[] = ['yes', 'no', 'maybe'];
export const isAttendance = (v: unknown): v is Attendance => typeof v === 'string' && ATTENDANCE.includes(v);

/** Статус ответа. У записанных до «Пока не знаю» колонка пуста — берём attending. */
export function attendanceOf(r: { attendance?: string | null; attending: boolean }): Attendance {
  return isAttendance(r.attendance) ? r.attendance : (r.attending ? 'yes' : 'no');
}

const MAX_ANSWERS = 12;
const ID_RE = /^[a-z0-9_-]{1,40}$/;
const TYPES: readonly string[] = ['one', 'many', 'text'];

/** Проверка ответов из формы. null — присланное не похоже на ответы (400),
    пустые ответы просто отбрасываются. */
export function cleanAnswers(raw: unknown): RsvpAnswer[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_ANSWERS) return null;
  const out: RsvpAnswer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const { id, q, a, t } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !ID_RE.test(id)) return null;
    if (typeof q !== 'string' || q.length > 200) return null;
    if (typeof a !== 'string' || a.length > 1000) return null;
    const type = t == null ? 'text' : t;
    if (typeof type !== 'string' || !TYPES.includes(type)) return null;
    const answer = a.trim();
    if (!answer || out.some((x) => x.id === id)) continue;
    out.push({ id, q: q.trim() || id, a: answer, t: type as RsvpAnswer['t'] });
  }
  return out;
}

/** Ответы из колонки answers (JSON). Битое или старое значение — пустой список. */
export function parseAnswers(json?: string | null): RsvpAnswer[] {
  try {
    const list = JSON.parse(json || '[]');
    return cleanAnswers(list) || [];
  } catch {
    return [];
  }
}

export interface AnswerSummary { id: string; q: string; counts: Record<string, number> }

/** Сводка по вопросам с вариантами: «Горячее: Мясо 5 · Рыба 3». Свободные ответы
    в сводку не идут — их пара читает в карточке гостя. */
export function summarizeAnswers(lists: RsvpAnswer[][]): AnswerSummary[] {
  const byId = new Map<string, AnswerSummary>();
  for (const answers of lists) {
    for (const x of answers) {
      if (x.t === 'text') continue;
      let s = byId.get(x.id);
      if (!s) { s = { id: x.id, q: x.q, counts: Object.create(null) as Record<string, number> }; byId.set(x.id, s); }
      const options = x.t === 'many' ? x.a.split(',').map((o) => o.trim()).filter(Boolean) : [x.a];
      for (const o of options) s.counts[o] = (s.counts[o] || 0) + 1;
    }
  }
  return [...byId.values()];
}
