import { hasIntro } from './plans';

/* Заставка приглашения: своя у шаблона (двери «Витража», видео
   «Средиземноморья», анимация обложки…) или один из общих конвертов —
   их пара может поставить любому шаблону (27.11.26). Страница шаблона узнаёт
   выбор из адреса ещё до отрисовки: public/invite/assets/intro-choice.js.

   Данные — customData.introStyle (пусто — своя заставка шаблона) и
   customData.sealColor (цвет печати конверта, SEAL_COLORS в constants.ts). */

/** Общие конверты: модули public/invite/assets/envelope-{slide,flap}.js и envelope3d.js */
export const UNIVERSAL_INTROS = ['slide', 'flap', 'wax3d'] as const;
export type UniversalIntro = (typeof UNIVERSAL_INTROS)[number];

export const isUniversalIntro = (v: unknown): v is UniversalIntro =>
  typeof v === 'string' && (UNIVERSAL_INTROS as readonly string[]).includes(v);

interface IntroData {
  plan?: string;
  enabledSections?: Record<string, boolean>;
  customData?: Record<string, unknown>;
}

/** Параметры заставки в адресе страницы шаблона (обёртки *Template.tsx):
    intro=0 — анимации открытия нет (не входит в тариф или пара убрала раздел
    «Заставка»), introStyle — общий конверт вместо своей заставки, seal — цвет печати. */
export function introParams(p: URLSearchParams, data: IntroData): void {
  if (!hasIntro(data.plan) || data.enabledSections?.envelope === false) {
    p.set('intro', '0');
    return;
  }
  const cd = data.customData || {};
  if (isUniversalIntro(cd.introStyle)) p.set('introStyle', cd.introStyle);
  if (typeof cd.sealColor === 'string' && /^[a-z]+$/.test(cd.sealColor)) p.set('seal', cd.sealColor);
}
