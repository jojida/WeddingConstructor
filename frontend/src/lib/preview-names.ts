import { readStorage, writeStorage } from './browser-storage';

/* Имена, которые человек вписал в каталоге шаблонов: они появляются во всех
   превью и на демо, а в редакторе ими заполнен первый шаг. Свои имена в готовом
   приглашении — сильный повод начать делать своё (в каталоге выбор решается:
   16–18.10.26 из 129 открывших список редактор открыли 39).
   Хранятся только в этом браузере — на сервер и в Метрику не уходят. */
const KEY = 'wc_preview_names';
export const NAME_MAX = 24;   // как у полей имён в редакторе

export interface PreviewNames { groom: string; bride: string }
export const NO_NAMES: PreviewNames = { groom: '', bride: '' };

const clean = (value: unknown) => (typeof value === 'string' ? value.slice(0, NAME_MAX) : '');

export function readPreviewNames(): PreviewNames {
  try {
    const saved = JSON.parse(readStorage('localStorage', KEY) || 'null');
    return { groom: clean(saved?.groom), bride: clean(saved?.bride) };
  } catch {
    return NO_NAMES;
  }
}

export function writePreviewNames(names: PreviewNames): void {
  const groom = clean(names.groom), bride = clean(names.bride);
  writeStorage('localStorage', KEY, groom.trim() || bride.trim() ? JSON.stringify({ groom, bride }) : null);
}

/** Вписанные имена поверх примера шаблона; пустое поле — остаётся пример. */
export function withPreviewNames<T extends { groomName?: string; brideName?: string }>(data: T, names: PreviewNames): T {
  const groom = names.groom.trim(), bride = names.bride.trim();
  if (!groom && !bride) return data;
  return { ...data, groomName: groom || data.groomName, brideName: bride || data.brideName };
}
