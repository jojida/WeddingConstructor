'use client';

/* ═══════════════════════════════════════════════════════════════════════════
   Верстак — стор документа.

   Правило: ни один компонент не мутирует документ напрямую. Любая правка
   проходит через commit(label, recipe) — он кладёт снимок в историю, клонирует
   документ, отдаёт клон рецепту. Отсюда бесплатно берутся отмена и повтор.
   ═══════════════════════════════════════════════════════════════════════════ */

import { create } from 'zustand';
import toast from 'react-hot-toast';
import {
  Project,
  Asset,
  FontDef,
  Layer,
  SectionHeight,
  CatalogCard,
  ProjectMode,
  emptyProject,
  emptySection,
  sectionHeightPx,
  newTextLayer,
  newShapeLayer,
  newImageLayer,
  baseLayer,
  uid,
} from './types';
import { ingestFile, ingestFont } from './assets/ingest';
import {
  holdAsset,
  forgetAsset,
  markSaved,
  saveList,
  clearDoomed,
  dropPending,
  hasPending,
} from './assets/pending';
import { assetUrlFor } from './assets/url';
import { generatePatch } from './export/patch';
import { applyTextEdits } from './export/patchHtml';
import { importSvg } from './import/fromSvg';
import { slugify } from './slug';

const HISTORY_LIMIT = 100;

interface Snapshot {
  label: string;
  project: Project;
}

export interface View {
  zoom: number;
  /** сдвиг содержимого в экранных пикселях */
  x: number;
  y: number;
}

/**
 * Секции на холсте стыкуются вплотную — ровно так они лягут на странице.
 * Промежуток раньше был удобен для подписей, но врал: на сайте его нет, и
 * декор, выходящий за край секции, вёл себя иначе, чем в редакторе.
 */
export const SECTION_GAP = 0;

/** Чем кончился экспорт: файлы записаны всегда, публикация — как повезёт. */
export interface ExportResult {
  url: string;
  shipped: {
    ok: boolean;
    commit?: string;
    files?: string[];
    pushed?: boolean;
    note?: string;
  };
}

export interface ProjectSummary {
  slug: string;
  name: string;
  width: number;
  sections: number;
  updatedAt: string;
}

export type Tool = 'select' | 'text' | 'rect' | 'ellipse' | 'block';

export type AlignMode =
  | 'left'
  | 'hcenter'
  | 'right'
  | 'top'
  | 'vcenter'
  | 'bottom';

/** Правки одного поля подряд склеиваются в одну запись истории. */
const MERGE_WINDOW_MS = 900;

interface StudioState {
  project: Project | null;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  error: string | null;

  past: Snapshot[];
  future: Snapshot[];

  /**
   * Проект занял слаг рукописного шаблона. Сохранение обязано сказать об этом
   * серверу: тот отложит копию оригинала, прежде чем писать поверх.
   */
  adopted: boolean;

  view: View;
  activeSectionId: string | null;
  selection: string[];
  /** слой, который сейчас правят прямо на холсте */
  editingLayerId: string | null;
  tool: Tool;
  setTool: (tool: Tool) => void;
  /** сервер попросил пароль — студия открыта не только на этой машине */
  needToken: boolean;
  submitToken: (value: string) => void;

  /* — документ — */
  commit: (label: string, recipe: (draft: Project) => void, mergeKey?: string) => void;
  undo: () => void;
  redo: () => void;

  /* — жест: перетаскивание и ресайз пишут в историю одну запись — */
  beginGesture: () => void;
  mutate: (recipe: (draft: Project) => void) => void;
  endGesture: (label: string) => void;
  cancelGesture: () => void;

  /* — выделение — */
  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  setEditingLayer: (id: string | null) => void;

  /* — слои — */
  addText: (sectionId: string, x: number, y: number) => void;
  addShape: (sectionId: string, shape: 'rect' | 'ellipse', x: number, y: number) => void;
  addBlock: (sectionId: string, x: number, y: number) => void;
  patchLayer: (id: string, patch: Record<string, unknown>, mergeKey?: string) => void;
  renameLayer: (id: string, name: string) => void;
  setLayerFlag: (id: string, flag: 'hidden' | 'locked', value: boolean) => void;
  reorderLayer: (id: string, delta: number) => void;
  layerToEdge: (id: string, edge: 'front' | 'back') => void;
  duplicateSelection: () => void;
  deleteSelection: () => void;
  nudgeSelection: (dx: number, dy: number) => void;
  alignSelection: (mode: AlignMode) => void;
  distributeSelection: (axis: 'x' | 'y') => void;
  groupSelection: () => void;
  ungroupSelection: () => void;

  /* — файлы шаблона — */
  uploadAsset: (file: File) => Promise<Asset>;
  dropOnCanvas: (files: File[], sectionId: string, x: number, y: number) => Promise<void>;
  dropOnSection: (files: File[], sectionId: string) => Promise<void>;
  replaceLayerAsset: (layerId: string, file: File) => Promise<void>;
  removeAsset: (assetId: string) => Promise<void>;
  explodeSvgLayer: (layerId: string) => Promise<number>;
  addFontFile: (file: File, family: string) => Promise<void>;
  addGoogleFont: (family: string) => void;
  removeFont: (key: string) => void;

  /* — файлы — */
  createProject: (
    slug: string,
    name: string,
    width: number,
    /** забрать слаг у рукописного шаблона, сделав копию его файлов */
    adopt?: boolean,
    /** patch — править существующий шаблон, build — собрать новый */
    mode?: ProjectMode,
  ) => Promise<void>;
  openProject: (slug: string) => Promise<void>;
  saveProject: () => Promise<void>;
  exportProject: (confirmHandmade?: boolean) => Promise<ExportResult>;
  closeProject: () => void;

  /* — секции — */
  addSection: () => void;
  renameSection: (id: string, name: string) => void;
  setSectionHeight: (id: string, height: SectionHeight) => void;
  setSectionBackground: (id: string, color: string) => void;
  setSectionClip: (id: string, clip: boolean) => void;
  removeSection: (id: string) => void;
  moveSection: (id: string, delta: number) => void;
  setActiveSection: (id: string | null) => void;

  /* — проект — */
  setCanvasWidth: (width: number) => void;
  patchCatalog: (patch: Partial<CatalogCard>) => void;

  /* — вид — */
  setView: (view: Partial<View>) => void;
  zoomAt: (factor: number, screenX: number, screenY: number) => void;
  zoomTo: (zoom: number) => void;
  fitToViewport: (viewportW: number, viewportH: number) => void;
}

const clone = <T,>(value: T): T =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);

/* Состояние вне стора: его читают и пишут только действия ниже, а перерисовка
   от него не зависит — поэтому в state ему делать нечего. */
let gestureBase: Project | null = null;
let lastMerge: { key: string; at: number } = { key: '', at: 0 };

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Полная высота всех секций с промежутками, в пикселях холста. */
export function documentHeight(project: Project): number {
  return project.sections.reduce(
    (sum, s, i) =>
      sum + sectionHeightPx(s, project.canvas.width) + (i ? SECTION_GAP : 0),
    0,
  );
}

/* Пароль студии живёт в браузере: сервер требует его, когда студия открыта
   не только на этой машине. Локально, без STUDIO_TOKEN, ничего не меняется. */
const TOKEN_KEY = 'wc_studio_token';

export function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeToken(value: string): void {
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* приватный режим — переживём */
  }

  /* Тот же пароль в cookie: заголовок умеет слать только наш код, а импорт
     грузит страницу в iframe, и там запрос делает сам браузер. */
  try {
    const base = `${TOKEN_KEY}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
    document.cookie = value ? `${base}; max-age=2592000` : `${base}; max-age=0`;
  } catch {
    /* нет document — значит, и cookie не нужны */
  }
}

/** Пароль из хранилища должен быть и в cookie — иначе импорт получит отказ. */
export function syncTokenCookie(): void {
  const token = readToken();
  if (token) writeToken(token);
}

async function api(path: string, init?: RequestInit) {
  const token = readToken();
  const res = await fetch(`/api/studio${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-studio-token': token } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const body = await res.json().catch(() => ({}));

  if (res.status === 401 && body?.needToken) {
    useStudio.setState({ needToken: true });
    throw new Error('Нужен пароль студии');
  }
  if (!res.ok) throw new Error(body?.error || `Запрос не удался (${res.status})`);

  useStudio.setState({ needToken: false });
  return body;
}

export const useStudio = create<StudioState>((set, get) => ({
  project: null,
  loading: false,
  saving: false,
  dirty: false,
  adopted: false,
  error: null,

  past: [],
  future: [],

  view: { zoom: 1, x: 0, y: 0 },
  activeSectionId: null,
  selection: [],
  editingLayerId: null,
  tool: 'select',
  needToken: false,

  setTool: (tool) => set({ tool }),

  submitToken: (value) => {
    writeToken(value.trim());
    set({ needToken: false, error: null });
  },

  /* ─── документ ─────────────────────────────────────────────────────────── */

  commit: (label, recipe, mergeKey) => {
    const { project, past } = get();
    if (!project) return;

    const draft = clone(project);
    recipe(draft);
    draft.updatedAt = new Date().toISOString();

    // Набор текста и таскание ползунка не должны засорять историю: правки
    // одного поля подряд склеиваются, отмена возвращает к состоянию до правки.
    const now = Date.now();
    const merge =
      !!mergeKey && lastMerge.key === mergeKey && now - lastMerge.at < MERGE_WINDOW_MS;
    lastMerge = { key: mergeKey ?? '', at: now };

    set({
      project: draft,
      past: merge ? past : [...past, { label, project }].slice(-HISTORY_LIMIT),
      future: [],
      dirty: true,
    });
  },

  /* ─── жесты ────────────────────────────────────────────────────────────── */

  beginGesture: () => {
    const { project } = get();
    if (project) gestureBase = project;
  },

  /** Правка без записи в историю — во время перетаскивания. */
  mutate: (recipe) => {
    const { project } = get();
    if (!project) return;
    const draft = clone(project);
    recipe(draft);
    draft.updatedAt = new Date().toISOString();
    set({ project: draft, dirty: true });
  },

  endGesture: (label) => {
    const { project, past } = get();
    if (!gestureBase || !project || gestureBase === project) {
      gestureBase = null;
      return;
    }
    lastMerge = { key: '', at: 0 };
    set({ past: [...past, { label, project: gestureBase }].slice(-HISTORY_LIMIT), future: [] });
    gestureBase = null;
  },

  cancelGesture: () => {
    if (!gestureBase) return;
    set({ project: gestureBase });
    gestureBase = null;
  },

  /* ─── выделение ────────────────────────────────────────────────────────── */

  /** Выбор одного слоя связки подтягивает всю связку. */
  select: (ids) => {
    const { project } = get();
    if (!project) {
      set({ selection: ids, editingLayerId: null });
      return;
    }
    const all = project.sections.flatMap((s) => s.layers);
    const groups = new Set(
      ids.map((id) => all.find((l) => l.id === id)?.groupId).filter(Boolean) as string[],
    );
    const expanded = groups.size
      ? [...new Set([...ids, ...all.filter((l) => l.groupId && groups.has(l.groupId)).map((l) => l.id)])]
      : ids;
    set({ selection: expanded, editingLayerId: null });
  },

  toggleSelect: (id) =>
    set((s) => ({
      selection: s.selection.includes(id)
        ? s.selection.filter((x) => x !== id)
        : [...s.selection, id],
      editingLayerId: null,
    })),

  clearSelection: () => set({ selection: [], editingLayerId: null }),

  setEditingLayer: (id) => set({ editingLayerId: id }),

  /* ─── слои ─────────────────────────────────────────────────────────────── */

  addText: (sectionId, x, y) => {
    const project = get().project;
    if (!project) return;
    const size = Math.round(project.canvas.width * 0.055);
    const width = Math.round(project.canvas.width * 0.7);
    const layer = newTextLayer(Math.round(x - width / 2), Math.round(y), width, size);
    get().commit('Текстовый слой', (d) => {
      d.sections.find((s) => s.id === sectionId)?.layers.push(layer);
    });
    set({ selection: [layer.id], activeSectionId: sectionId });
  },

  addShape: (sectionId, shape, x, y) => {
    const project = get().project;
    if (!project) return;
    const side = Math.round(project.canvas.width * 0.3);
    const layer = newShapeLayer(
      shape,
      Math.round(x - side / 2),
      Math.round(y - side / 2),
      side,
      side,
    );
    get().commit(shape === 'rect' ? 'Прямоугольник' : 'Овал', (d) => {
      d.sections.find((s) => s.id === sectionId)?.layers.push(layer);
    });
    set({ selection: [layer.id], activeSectionId: sectionId });
  },

  addBlock: (sectionId, x, y) => {
    const project = get().project;
    if (!project) return;
    const w = Math.round(project.canvas.width * 0.8);
    const h = Math.round(project.canvas.width * 0.55);
    const layer: Layer = {
      ...baseLayer('Программа дня', Math.round(x - w / 2), Math.round(y - h / 2), w, h),
      kind: 'block',
      block: 'schedule',
      params: { size: Math.round(project.canvas.width * 0.045) },
    };
    get().commit('Блок', (d) => {
      d.sections.find((s) => s.id === sectionId)?.layers.push(layer);
    });
    set({ selection: [layer.id], activeSectionId: sectionId });
  },

  patchLayer: (id, patch, mergeKey) =>
    get().commit(
      'Свойства слоя',
      (d) => {
        for (const section of d.sections) {
          const layer = section.layers.find((l) => l.id === id);
          if (layer) {
            Object.assign(layer, patch);
            return;
          }
        }
      },
      mergeKey,
    ),

  renameLayer: (id, name) =>
    get().commit(
      'Имя слоя',
      (d) => {
        for (const section of d.sections) {
          const layer = section.layers.find((l) => l.id === id);
          if (layer) layer.name = name;
        }
      },
      `name:${id}`,
    ),

  setLayerFlag: (id, flag, value) =>
    get().commit(flag === 'hidden' ? 'Видимость слоя' : 'Блокировка слоя', (d) => {
      for (const section of d.sections) {
        const layer = section.layers.find((l) => l.id === id);
        if (layer) layer[flag] = value;
      }
    }),

  reorderLayer: (id, delta) =>
    get().commit('Порядок слоёв', (d) => {
      for (const section of d.sections) {
        const from = section.layers.findIndex((l) => l.id === id);
        if (from < 0) continue;
        const to = from + delta;
        if (to < 0 || to >= section.layers.length) return;
        const [moved] = section.layers.splice(from, 1);
        section.layers.splice(to, 0, moved);
        return;
      }
    }),

  layerToEdge: (id, edge) =>
    get().commit('Порядок слоёв', (d) => {
      for (const section of d.sections) {
        const from = section.layers.findIndex((l) => l.id === id);
        if (from < 0) continue;
        const [moved] = section.layers.splice(from, 1);
        if (edge === 'front') section.layers.push(moved);
        else section.layers.unshift(moved);
        return;
      }
    }),

  duplicateSelection: () => {
    const { project, selection } = get();
    if (!project || !selection.length) return;
    const fresh: string[] = [];
    get().commit('Дубликат', (d) => {
      for (const section of d.sections) {
        for (const layer of section.layers.filter((l) => selection.includes(l.id))) {
          const copy: Layer = clone(layer);
          copy.id = uid();
          copy.name = `${layer.name} копия`;
          copy.x += 16;
          copy.y += 16;
          section.layers.push(copy);
          fresh.push(copy.id);
        }
      }
    });
    set({ selection: fresh });
  },

  deleteSelection: () => {
    const { selection } = get();
    if (!selection.length) return;
    get().commit('Удалить слои', (d) => {
      for (const section of d.sections) {
        section.layers = section.layers.filter((l) => !selection.includes(l.id));
      }
    });
    set({ selection: [] });
  },

  nudgeSelection: (dx, dy) => {
    const { selection } = get();
    if (!selection.length) return;
    get().commit(
      'Сдвиг',
      (d) => {
        for (const section of d.sections) {
          for (const layer of section.layers) {
            if (!selection.includes(layer.id) || layer.locked) continue;
            layer.x += dx;
            layer.y += dy;
          }
        }
      },
      `nudge:${selection.join(',')}`,
    );
  },

  alignSelection: (mode) => {
    const { project, selection } = get();
    if (!project || !selection.length) return;
    const w = project.canvas.width;

    get().commit('Выравнивание', (d) => {
      for (const section of d.sections) {
        const picked = section.layers.filter((l) => selection.includes(l.id) && !l.locked);
        if (!picked.length) continue;

        // Один слой равняется по секции, несколько — по своей общей рамке.
        const single = picked.length === 1;
        const h = sectionHeightPx(section, w);
        const box = single
          ? { x: 0, y: 0, w, h }
          : {
              x: Math.min(...picked.map((l) => l.x)),
              y: Math.min(...picked.map((l) => l.y)),
              w:
                Math.max(...picked.map((l) => l.x + l.w)) -
                Math.min(...picked.map((l) => l.x)),
              h:
                Math.max(...picked.map((l) => l.y + l.h)) -
                Math.min(...picked.map((l) => l.y)),
            };

        for (const layer of picked) {
          if (mode === 'left') layer.x = box.x;
          if (mode === 'hcenter') layer.x = box.x + (box.w - layer.w) / 2;
          if (mode === 'right') layer.x = box.x + box.w - layer.w;
          if (mode === 'top') layer.y = box.y;
          if (mode === 'vcenter') layer.y = box.y + (box.h - layer.h) / 2;
          if (mode === 'bottom') layer.y = box.y + box.h - layer.h;
        }
      }
    });
  },

  distributeSelection: (axis) => {
    const { selection } = get();
    if (selection.length < 3) return;
    get().commit('Распределение', (d) => {
      for (const section of d.sections) {
        const picked = section.layers
          .filter((l) => selection.includes(l.id) && !l.locked)
          .sort((a, b) => (axis === 'x' ? a.x - b.x : a.y - b.y));
        if (picked.length < 3) continue;

        const first = picked[0];
        const last = picked[picked.length - 1];
        const span =
          axis === 'x' ? last.x + last.w - first.x : last.y + last.h - first.y;
        const used = picked.reduce((sum, l) => sum + (axis === 'x' ? l.w : l.h), 0);
        const gap = (span - used) / (picked.length - 1);

        let cursor = axis === 'x' ? first.x : first.y;
        for (const layer of picked) {
          if (axis === 'x') {
            layer.x = cursor;
            cursor += layer.w + gap;
          } else {
            layer.y = cursor;
            cursor += layer.h + gap;
          }
        }
      }
    });
  },

  undo: () => {
    const { past, future, project } = get();
    if (!past.length || !project) return;
    const previous = past[past.length - 1];
    set({
      project: previous.project,
      past: past.slice(0, -1),
      future: [{ label: previous.label, project }, ...future].slice(0, HISTORY_LIMIT),
      dirty: true,
    });
  },

  redo: () => {
    const { past, future, project } = get();
    if (!future.length || !project) return;
    const next = future[0];
    set({
      project: next.project,
      past: [...past, { label: next.label, project }].slice(-HISTORY_LIMIT),
      future: future.slice(1),
      dirty: true,
    });
  },

  groupSelection: () => {
    const { selection } = get();
    if (selection.length < 2) return;
    const groupId = uid();
    get().commit('Связать слои', (d) => {
      for (const section of d.sections) {
        for (const layer of section.layers) {
          if (selection.includes(layer.id)) layer.groupId = groupId;
        }
      }
    });
  },

  ungroupSelection: () => {
    const { selection } = get();
    if (!selection.length) return;
    get().commit('Разорвать связку', (d) => {
      for (const section of d.sections) {
        for (const layer of section.layers) {
          if (selection.includes(layer.id)) delete layer.groupId;
        }
      }
    });
  },

  /* ─── файлы шаблона ────────────────────────────────────────────────────── */

  /**
   * Один файл → готовый ассет в шаблоне. Одно и то же фото, брошенное дважды,
   * не задваивает файл: сравниваем по хешу содержимого.
   */
  uploadAsset: async (file) => {
    const { project } = get();
    if (!project) throw new Error('Проект не открыт');

    const result = await ingestFile(file, project.canvas.width, project.assets);
    if ('duplicate' in result) return result.duplicate;

    // Файл ждёт сохранения в памяти; на холсте он виден по blob-ссылке.
    holdAsset(result.asset.file, result.base64, 'assets');

    get().commit('Файл добавлен', (d) => {
      if (!d.assets.some((a) => a.id === result.asset.id)) d.assets.push(result.asset);
    });

    // Растр студия ужимает сама, а вектор кладётся как есть: SVG из Canva
    // легко весит мегабайты, и такой файл потащит за собой страницу гостя.
    if (result.asset.bytes > 400 * 1024) {
      toast(
        `«${result.asset.file}» весит ${Math.round(result.asset.bytes / 1024)} КБ — ` +
          'тяжело для страницы, лучше заменить на растр',
        { duration: 6000 },
      );
    }
    return result.asset;
  },

  /** Файлы, брошенные на холст: слои встают в точке отпускания лесенкой. */
  dropOnCanvas: async (files, sectionId, x, y) => {
    const created: string[] = [];
    for (const [index, file] of files.entries()) {
      const asset = await get().uploadAsset(file);
      const project = get().project;
      if (!project) return;

      // Картинка больше холста — вписываем, пропорции сохраняем.
      const maxW = project.canvas.width;
      const w = Math.min(asset.w, maxW);
      const h = (w * asset.h) / asset.w;
      const offset = index * 16;
      const layer = newImageLayer(
        asset,
        x - w / 2 + offset,
        y - h / 2 + offset,
        w,
        h,
        file.name.replace(/\.[^.]+$/, '') || 'Картинка',
      );
      get().commit('Картинка', (d) => {
        d.sections.find((s) => s.id === sectionId)?.layers.push(layer);
      });
      created.push(layer.id);
    }
    if (created.length) set({ selection: created, activeSectionId: sectionId });
  },

  /** Файлы, брошенные на секцию в списке слоёв: встают по центру секции. */
  dropOnSection: async (files, sectionId) => {
    const project = get().project;
    if (!project) return;
    const section = project.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const cx = project.canvas.width / 2;
    const cy = sectionHeightPx(section, project.canvas.width) / 2;
    await get().dropOnCanvas(files, sectionId, cx, cy);
  },

  /** Файл поверх существующей картинки: рамка, кроп и позиция остаются. */
  replaceLayerAsset: async (layerId, file) => {
    const asset = await get().uploadAsset(file);
    get().commit('Замена картинки', (d) => {
      for (const section of d.sections) {
        const layer = section.layers.find((l) => l.id === layerId);
        if (layer && layer.kind === 'image') layer.assetId = asset.id;
      }
    });
  },

  /**
   * Разбирает SVG-слой на отдельные слои по группам внутри файла.
   * Экспорт из Canva приходит одним куском, а править его нужно по частям.
   */
  explodeSvgLayer: async (layerId) => {
    const { project } = get();
    if (!project) return 0;

    let target: Layer | undefined;
    let sectionId = '';
    for (const section of project.sections) {
      const found = section.layers.find((l) => l.id === layerId);
      if (found) {
        target = found;
        sectionId = section.id;
        break;
      }
    }
    if (!target || target.kind !== 'image' || !target.assetId) return 0;

    const asset = project.assets.find((a) => a.id === target.assetId);
    if (!asset || asset.kind !== 'svg') return 0;

    const source = assetUrlFor(project)(asset.id);
    if (!source) return 0;
    const response = await fetch(source);
    const file = new File([await response.blob()], asset.file, { type: 'image/svg+xml' });

    const { pieces } = await importSvg(file, target.w);
    if (pieces.length < 2) return 0;

    const made: { layer: Layer }[] = [];
    for (const piece of pieces) {
      const uploaded = await get().uploadAsset(piece.file);
      made.push({
        layer: newImageLayer(
          uploaded,
          target.x + piece.x,
          target.y + piece.y,
          piece.w,
          piece.h,
          piece.name,
        ),
      });
    }

    get().commit('Разобрать SVG', (d) => {
      const section = d.sections.find((s) => s.id === sectionId);
      if (!section) return;
      const at = section.layers.findIndex((l) => l.id === layerId);
      section.layers.splice(at, 1, ...made.map((m) => m.layer));
    });
    set({ selection: made.map((m) => m.layer.id) });
    return made.length;
  },

  removeAsset: async (assetId) => {
    const { project } = get();
    if (!project) return;
    const asset = project.assets.find((a) => a.id === assetId);
    if (!asset) return;

    // С диска файл исчезнет при сохранении: до тех пор Ctrl+Z вернёт картинку
    // целой, а закрытие без сохранения оставит папку нетронутой.
    forgetAsset(asset.file, 'assets');
    get().commit('Файл удалён', (d) => {
      d.assets = d.assets.filter((a) => a.id !== assetId);
      for (const section of d.sections) {
        for (const layer of section.layers) {
          if (layer.kind === 'image' && layer.assetId === assetId) layer.assetId = null;
        }
      }
    });
  },

  /* ─── шрифты ───────────────────────────────────────────────────────────── */

  addFontFile: async (file, family) => {
    const { project } = get();
    if (!project) throw new Error('Проект не открыт');
    const prepared = await ingestFont(file);

    holdAsset(prepared.file, prepared.base64, 'assets/fonts');

    const key = slugify(family) || `font-${uid().slice(0, 4)}`;
    get().commit('Шрифт добавлен', (d) => {
      const existing = d.fonts.find((f) => f.key === key);
      if (existing) {
        existing.files = [...new Set([...(existing.files ?? []), prepared.file])];
        return;
      }
      const font: FontDef = {
        key,
        stack: `"${family}", serif`,
        source: 'local',
        files: [prepared.file],
      };
      d.fonts.push(font);
    });
  },

  addGoogleFont: (family) => {
    const key = slugify(family);
    if (!key) return;
    get().commit('Шрифт добавлен', (d) => {
      if (d.fonts.some((f) => f.key === key)) return;
      d.fonts.push({
        key,
        stack: `"${family}", serif`,
        source: 'google',
        googleSpec: family.trim().replace(/\s+/g, '+'),
      });
    });
  },

  removeFont: (key) => {
    const font = get().project?.fonts.find((f) => f.key === key);
    for (const file of font?.files ?? []) forgetAsset(file, 'assets/fonts');
    get().commit('Шрифт убран', (d) => {
      d.fonts = d.fonts.filter((f) => f.key !== key);
    });
  },

  /* ─── файлы ────────────────────────────────────────────────────────────── */

  createProject: async (slug, name, width, adopt = false, mode = 'build') => {
    set({ loading: true, error: null });
    try {
      /* Сервер только проверяет, свободен ли слаг. Ни проекта, ни его файлов
         на диске не появляется, пока не нажато «Сохранить»: брошенный на
         полпути импорт не должен оставлять после себя пустую папку. */
      await api('/projects', { method: 'POST', body: JSON.stringify({ slug, adopt }) });
      dropPending();
      const project = emptyProject(slug, name, width, mode);
      set({
        project,
        past: [],
        future: [],
        // Проекта на диске ещё нет — сохранять есть что с первой секунды.
        dirty: true,
        adopted: adopt,
        loading: false,
        activeSectionId: project.sections[0]?.id ?? null,
        selection: [],
        editingLayerId: null,
        view: { zoom: 1, x: 0, y: 0 },
      });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },

  openProject: async (slug) => {
    set({ loading: true, error: null });
    try {
      const { project } = await api(`/projects/${slug}`);
      dropPending();
      set({
        project,
        past: [],
        future: [],
        dirty: false,
        adopted: false,
        loading: false,
        activeSectionId: project.sections[0]?.id ?? null,
        selection: [],
        editingLayerId: null,
        view: { zoom: 1, x: 0, y: 0 },
      });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },

  /**
   * Единственное место, где студия меняет папку шаблона.
   *
   * Сначала файлы, потом документ: сохранённый проект не должен ссылаться на
   * картинку, которой ещё нет на диске. Список файлов считается от текущего
   * документа, поэтому отменённая загрузка туда не попадёт, а картинка,
   * возвращённая отменой, не будет стёрта.
   */
  saveProject: async () => {
    const { project, adopted } = get();
    if (!project) return;
    set({ saving: true, error: null });
    try {
      const keep = new Set<string>([
        ...project.assets.map((a) => a.file),
        ...project.fonts.flatMap((f) => f.files ?? []),
      ]);
      const { write, remove } = saveList(keep);

      for (const item of write) {
        await api(`/projects/${project.slug}/assets`, {
          method: 'POST',
          body: JSON.stringify({ file: item.file, base64: item.base64, dir: item.dir }),
        });
        markSaved(item.file);
      }
      for (const item of remove) {
        const query = `file=${encodeURIComponent(item.file)}&dir=${encodeURIComponent(item.dir)}`;
        await api(`/projects/${project.slug}/assets?${query}`, { method: 'DELETE' });
      }
      clearDoomed();

      await api(`/projects/${project.slug}`, {
        method: 'PUT',
        body: JSON.stringify({ project, adopt: adopted }),
      });
      set({ saving: false, dirty: false });
    } catch (e) {
      set({ saving: false, error: (e as Error).message });
      throw e;
    }
  },

  /** Экспорт всегда идёт от того, что лежит на диске: сначала сохраняем. */
  exportProject: async (confirmHandmade = false) => {
    const { project, dirty } = get();
    if (!project) throw new Error('Проект не открыт');
    if (dirty || hasPending()) await get().saveProject();

    /* Правку текста готовит браузер, а не сервер: разметку надо разобрать
       ровно тем же движком, которым считались адреса слоёв, а точечная замена
       по исходному тексту оставляет остальной файл нетронутым. */
    let html: string | undefined;
    if (project.mode === 'patch') {
      const { texts } = generatePatch(project);
      if (texts.length) {
        const source = await fetch(`/invite/${project.slug}/index.html`, {
          cache: 'no-store',
        }).then((r) => r.text());
        const doc = new DOMParser().parseFromString(source, 'text/html');
        const result = applyTextEdits(source, texts, doc);
        if (result.applied) html = result.html;
        for (const miss of result.skipped) {
          toast(`Текст не вписан (${miss.why}): ${miss.selector}`, { duration: 7000 });
        }
      }
    }

    const query = confirmHandmade ? '?confirm=1' : '';
    const body = await api(`/projects/${project.slug}/export${query}`, {
      method: 'POST',
      body: JSON.stringify({ html }),
    });
    return { url: body.url as string, shipped: body.shipped } as ExportResult;
  },

  closeProject: () => {
    // Файлы, ждавшие сохранения, уходят вместе с проектом: на диске их нет.
    dropPending();
    set({
      project: null,
      past: [],
      future: [],
      dirty: false,
      adopted: false,
      error: null,
      activeSectionId: null,
      selection: [],
      view: { zoom: 1, x: 0, y: 0 },
    });
  },

  /* ─── секции ───────────────────────────────────────────────────────────── */

  addSection: () => {
    const section = emptySection(`Секция ${(get().project?.sections.length ?? 0) + 1}`);
    get().commit('Добавить секцию', (d) => {
      d.sections.push(section);
    });
    set({ activeSectionId: section.id });
  },

  renameSection: (id, name) =>
    get().commit('Переименовать секцию', (d) => {
      const s = d.sections.find((x) => x.id === id);
      if (s) s.name = name;
    }),

  setSectionHeight: (id, height) =>
    get().commit('Высота секции', (d) => {
      const s = d.sections.find((x) => x.id === id);
      if (s) s.height = height;
    }),

  setSectionBackground: (id, color) =>
    get().commit('Фон секции', (d) => {
      const s = d.sections.find((x) => x.id === id);
      if (s) s.background = { ...s.background, color };
    }),

  setSectionClip: (id, clip) =>
    get().commit('Края секции', (d) => {
      const s = d.sections.find((x) => x.id === id);
      if (s) s.clip = clip;
    }),

  removeSection: (id) => {
    const { project } = get();
    if (!project || project.sections.length <= 1) return;
    get().commit('Удалить секцию', (d) => {
      d.sections = d.sections.filter((s) => s.id !== id);
    });
    if (get().activeSectionId === id) {
      set({ activeSectionId: get().project?.sections[0]?.id ?? null });
    }
  },

  moveSection: (id, delta) =>
    get().commit('Порядок секций', (d) => {
      const from = d.sections.findIndex((s) => s.id === id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= d.sections.length) return;
      const [moved] = d.sections.splice(from, 1);
      d.sections.splice(to, 0, moved);
    }),

  setActiveSection: (id) => set({ activeSectionId: id }),

  /* ─── проект ───────────────────────────────────────────────────────────── */

  setCanvasWidth: (width) =>
    get().commit('Ширина холста', (d) => {
      d.canvas.width = width;
    }),

  patchCatalog: (patch) =>
    get().commit('Карточка шаблона', (d) => {
      d.catalog = { ...d.catalog, ...patch };
    }),

  /* ─── вид ──────────────────────────────────────────────────────────────── */

  setView: (view) => set((s) => ({ view: { ...s.view, ...view } })),

  zoomAt: (factor, screenX, screenY) =>
    set((s) => {
      const zoom = clampZoom(s.view.zoom * factor);
      // точка под курсором остаётся на месте
      const worldX = (screenX - s.view.x) / s.view.zoom;
      const worldY = (screenY - s.view.y) / s.view.zoom;
      return {
        view: { zoom, x: screenX - worldX * zoom, y: screenY - worldY * zoom },
      };
    }),

  zoomTo: (zoom) => set((s) => ({ view: { ...s.view, zoom: clampZoom(zoom) } })),

  fitToViewport: (viewportW, viewportH) => {
    const { project } = get();
    if (!project) return;
    const docW = project.canvas.width;
    const docH = documentHeight(project);
    const pad = 48;
    const zoom = clampZoom(
      Math.min((viewportW - pad * 2) / docW, (viewportH - pad * 2) / docH),
    );
    set({
      view: {
        zoom,
        x: (viewportW - docW * zoom) / 2,
        y: Math.max(pad, (viewportH - docH * zoom) / 2),
      },
    });
  },
}));

/** Список проектов студии — для стартового экрана. */
export async function listProjects(): Promise<ProjectSummary[]> {
  const { projects } = await api('/projects');
  return projects as ProjectSummary[];
}

/* Студия работает только в разработке, поэтому стор виден из консоли:
   без этого отлаживать историю и жесты приходится вслепую. */
if (typeof window !== 'undefined') {
  (window as unknown as { __studio?: typeof useStudio }).__studio = useStudio;
}
