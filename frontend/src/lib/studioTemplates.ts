/* Шаблоны, собранные в «Верстаке».

   Данные лежат в соседнем сгенерированном файле — его переписывает студия при
   каждом экспорте. Здесь только тип и helpers, чтобы рукописный код никогда
   не приходилось патчить генератором. */

import type { TemplateSection, TemplateDefaults } from './constants';
import { STUDIO_TEMPLATES } from './studio-templates.generated';

export interface StudioTemplateEntry {
  id: string;
  name: string;
  description: string;
  tags: string[];
  colors: string[];
  preview: string;
  defaultCover: string;
  defaultGallery: string[];
  sampleBride: string;
  sampleGroom: string;
  /** фон под iframe — цвет первой секции, чтобы не мигало белым при загрузке */
  background: string;
  /** схема полей кабинета — её собирает студия из пометок на слоях */
  fields: TemplateSection[];
  /** значения по умолчанию: то, что стоит в дизайне */
  defaults: TemplateDefaults;
}

export { STUDIO_TEMPLATES };

export const isStudioTemplate = (id: string): boolean =>
  STUDIO_TEMPLATES.some((t) => t.id === id);

export const studioTemplate = (id: string): StudioTemplateEntry | null =>
  STUDIO_TEMPLATES.find((t) => t.id === id) ?? null;
