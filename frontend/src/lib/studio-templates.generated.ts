/* ─────────────────────────────────────────────────────────────────────────────
   Файл создаёт «Верстак» при экспорте шаблона. Правки руками пропадут при
   следующем экспорте — настраивайте шаблон в студии на /studio.
   Источник данных: public/invite/_studio-registry.json
   ───────────────────────────────────────────────────────────────────────────── */

import type { StudioTemplateEntry } from './studioTemplates';

export const STUDIO_TEMPLATES: StudioTemplateEntry[] = [
  {
    "id": "calla-kopiya",
    "name": "Каллы — копия",
    "description": "",
    "tags": [],
    "colors": [],
    "preview": "/invite/calla-kopiya/assets/cover.png",
    "defaultCover": "/invite/calla-kopiya/assets/cover.png",
    "defaultGallery": [],
    "sampleBride": "Невеста",
    "sampleGroom": "Жених",
    "background": "rgb(215, 211, 203)",
    "fields": [],
    "defaults": {}
  },
  {
    "id": "calla",
    "name": "Каллы",
    "description": "",
    "tags": [],
    "colors": [],
    "preview": "/invite/calla/assets/cover.png",
    "defaultCover": "/invite/calla/assets/cover.png",
    "defaultGallery": [],
    "sampleBride": "Невеста",
    "sampleGroom": "Жених",
    "background": "rgb(215, 211, 203)",
    "fields": [],
    "defaults": {}
  }
];
