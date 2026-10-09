/* «Скетч», блок «Локация». Раньше у шаблона не было поля «Место проведения»: место
   жило внутри текста «Праздник пройдёт на базе отдыха «Барвиха»», поэтому место,
   введённое на первом шаге, в приглашение не попадало. Теперь текст — только
   подводка, а место и адрес — свои строки (public/invite/sketch/script.js). */
export const SKETCH_LEGACY_LOCATION = 'Праздник пройдёт на базе отдыха «Барвиха»';
export const SKETCH_LOCATION_TEXT = 'Праздник пройдёт здесь:';
export const SKETCH_DEMO_VENUE = 'База отдыха «Барвиха»';

interface LocationData { venue?: string; customData?: Record<string, unknown> }

/** Черновик со старым текстом: текст → подводка, а место — своё или прежнее демо
    (тогда приглашение выглядит как раньше). Остальное не трогаем. */
export function withSketchLocation<T extends LocationData>(data: T): T {
  const cd = data.customData || {};
  if (cd.locationText !== SKETCH_LEGACY_LOCATION) return data;
  return {
    ...data,
    venue: data.venue && data.venue.trim() ? data.venue : SKETCH_DEMO_VENUE,
    customData: { ...cd, locationText: SKETCH_LOCATION_TEXT },
  };
}
