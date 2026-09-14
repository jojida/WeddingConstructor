'use client';

/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — готовые блоки шаблона.

   Программа дня, календарь, карусель, отсчёт и анкета — это не вёрстка,
   которую можно двигать по частям, а живые куски: их наполняет script.js
   шаблона. Календарь, например, при загрузке превращается в 43 ячейки, и
   импорт добросовестно делал из них 43 слоя — список слоёв превращался в
   свалку, а любой из этих слоёв можно было утащить мышкой и сломать сетку.

   Поэтому такой кусок берётся целиком: один слой на весь блок, внутрь
   редактор не заходит. Двигать и тянуть его можно, разбирать — нет.

   Таблица, а не хитрая эвристика: разметка блоков у каждого шаблона своя,
   и честнее держать список на виду, чем угадывать.
   ═══════════════════════════════════════════════════════════════════════════ */

import { BlockKind } from '../types';

interface BlockRoot {
  /** по чему узнаём корень блока */
  match: string;
  kind: BlockKind;
  name: string;
}

/*
 * Собрано по разметке всех шести шаблонов галереи. Имена классов у каждого
 * свои — отсюда и перечисления через запятую:
 *
 *   программа дня  Каллы .timeline-section · Скетч и Тёмная .timeline
 *                  Флоральный .sched-timeline · Арка и Средиземноморье
 *                  .timeline-inner
 *   календарь      Каллы .guests__cal · Тёмная .date-calendar
 *   отсчёт         Каллы .cd__timer · Флоральный, Арка, Средиземноморье
 *                  .countdown · Тёмная .countdown-grid
 *   дресс-код      Каллы .carousel · Тёмная .palette
 *   анкета         у всех <form>
 */
const BLOCK_ROOTS: BlockRoot[] = [
  {
    match: '.timeline-section, .timeline-inner, .timeline, .sched-timeline, .program__list',
    kind: 'schedule',
    name: 'Программа дня',
  },
  {
    match: '.guests__cal, .date-calendar, .calendar, .cal',
    kind: 'calendar',
    name: 'Календарь',
  },
  {
    match: '.cd__timer, .countdown, .countdown-grid, .countdown-inner, .timer',
    kind: 'countdown',
    name: 'Отсчёт',
  },
  { match: '.carousel, .slider, .palette', kind: 'dresscode', name: 'Дресс-код' },
  { match: 'form', kind: 'rsvp', name: 'Анкета гостя' },
];

export interface BlockMatch {
  kind: BlockKind;
  name: string;
}

/**
 * Корень готового блока — или null, если элемент обычный.
 *
 * Проверяем сам элемент, а не его потомков: обход идёт сверху вниз, и первым
 * встретится именно корень. Внутрь после этого не спускаемся.
 */
export function blockAt(el: Element): BlockMatch | null {
  for (const root of BLOCK_ROOTS) {
    try {
      if (el.matches(root.match)) return { kind: root.kind, name: root.name };
    } catch {
      /* селектор не понравился движку — пропускаем */
    }
  }
  return null;
}
