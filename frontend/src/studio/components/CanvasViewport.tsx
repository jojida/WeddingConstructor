'use client';

/* Холст: панорама, зум, линейки, слои, выделение и жесты.

   Мир измеряется в пикселях холста (project.canvas.width). view.x/view.y —
   экранное положение начала мира внутри вьюпорта, view.zoom — масштаб.
   Координаты слоя хранятся относительно его секции, поэтому у каждой секции
   есть смещение top, и мировая позиция слоя = (layer.x, sectionTop + layer.y). */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStudio, SECTION_GAP } from '../store';
import { Layer, Section, sectionHeightPx } from '../types';
import { fillCss } from '../export/generate';
import { assetUrlFor } from '../assets/url';
import LayerNode from './LayerNode';
import Ruler from './Ruler';
import { FIT_EVENT } from './Topbar';
import css from '../studio.module.css';

const RULER = 22;
/** Порог привязки — в экранных пикселях, чтобы не зависеть от масштаба. */
const SNAP_SCREEN_PX = 6;

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Gesture =
  | { kind: 'move'; startX: number; startY: number; origin: Map<string, Box> }
  | {
      kind: 'resize';
      handle: Handle;
      startX: number;
      startY: number;
      box: Box;
      origin: Map<string, Box>;
    }
  | { kind: 'rotate'; id: string; cx: number; cy: number; startAngle: number; origin: number }
  | { kind: 'section'; id: string; startY: number; height: number }
  | null;

interface Placed {
  section: Section;
  top: number;
  height: number;
}

const CURSORS: Record<Handle, string> = {
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize',
};

export default function CanvasViewport() {
  const project = useStudio((s) => s.project);
  const view = useStudio((s) => s.view);
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const selection = useStudio((s) => s.selection);
  const editingLayerId = useStudio((s) => s.editingLayerId);
  const activeSectionId = useStudio((s) => s.activeSectionId);
  const setView = useStudio((s) => s.setView);
  const zoomAt = useStudio((s) => s.zoomAt);
  const fitToViewport = useStudio((s) => s.fitToViewport);

  const areaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [dropHint, setDropHint] = useState(false);
  /** точка последнего двойного щелчка — по ней ставится каретка */
  const [caretPoint, setCaretPoint] = useState<{ x: number; y: number } | null>(null);

  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const gestureRef = useRef<Gesture>(null);
  const fitted = useRef(false);

  /* ─── размер вьюпорта ──────────────────────────────────────────────────── */

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;

    /* Меряем сразу и синхронно: ResizeObserver вызывается только когда браузер
       рисует кадр, а в фоновых и скрытых вкладках кадров может не быть вовсе —
       тогда холст остался бы с нулевым размером. Наблюдатель ниже лишь
       догоняет последующие изменения. */
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((prev) => {
        const w = Math.max(0, Math.round(r.width - RULER));
        const h = Math.max(0, Math.round(r.height - RULER));
        return prev.w === w && prev.h === h ? prev : { w, h };
      });
    };

    measure();
    window.addEventListener('resize', measure);

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(measure);
      observer.observe(el);
    }

    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!project || fitted.current || size.w < 40 || size.h < 40) return;
    fitted.current = true;
    fitToViewport(size.w, size.h);
  }, [project, size.w, size.h, fitToViewport]);

  useEffect(() => {
    fitted.current = false;
  }, [project?.id]);

  useEffect(() => {
    const fit = () => fitToViewport(size.w, size.h);
    window.addEventListener(FIT_EVENT, fit);
    return () => window.removeEventListener(FIT_EVENT, fit);
  }, [fitToViewport, size.w, size.h]);

  /* ─── пробел удерживает режим панорамы ─────────────────────────────────── */

  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      const tag = el?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable === true;
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !typing(e.target)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  /* ─── колесо ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - RULER;
      const y = e.clientY - rect.top - RULER;

      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.0022), x, y);
        return;
      }
      const { view: v } = useStudio.getState();
      if (e.shiftKey) setView({ x: v.x - e.deltaY - e.deltaX });
      else setView({ x: v.x - e.deltaX, y: v.y - e.deltaY });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, setView]);

  /* ─── раскладка секций ─────────────────────────────────────────────────── */

  const placed: Placed[] = useMemo(() => {
    if (!project) return [];
    let top = 0;
    return project.sections.map((section) => {
      const height = sectionHeightPx(section, project.canvas.width);
      const box = { section, top, height };
      top += height + SECTION_GAP;
      return box;
    });
  }, [project]);

  const docHeight = placed.length
    ? placed[placed.length - 1].top + placed[placed.length - 1].height
    : 0;

  /** Экранная точка → координаты мира. */
  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = areaRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const { view: v } = useStudio.getState();
      return {
        x: (clientX - rect.left - RULER - v.x) / v.zoom,
        y: (clientY - rect.top - RULER - v.y) / v.zoom,
      };
    },
    [],
  );

  /** Рамка выделения в координатах мира. */
  const selectionBox = useMemo((): Box | null => {
    if (!project || !selection.length) return null;
    const boxes: Box[] = [];
    for (const { section, top } of placed) {
      for (const layer of section.layers) {
        if (!selection.includes(layer.id)) continue;
        boxes.push({ x: layer.x, y: top + layer.y, w: layer.w, h: layer.h });
      }
    }
    if (!boxes.length) return null;
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return {
      x,
      y,
      w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
      h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
    };
  }, [project, placed, selection]);

  /* ─── привязка ─────────────────────────────────────────────────────────── */

  const snapTargets = useCallback(
    (ignore: string[]) => {
      const v: number[] = [];
      const h: number[] = [];
      if (!project) return { v, h };
      v.push(0, project.canvas.width / 2, project.canvas.width);
      for (const { section, top, height } of placed) {
        h.push(top, top + height / 2, top + height);
        for (const layer of section.layers) {
          if (layer.hidden || ignore.includes(layer.id)) continue;
          v.push(layer.x, layer.x + layer.w / 2, layer.x + layer.w);
          h.push(top + layer.y, top + layer.y + layer.h / 2, top + layer.y + layer.h);
        }
      }
      return { v, h };
    },
    [project, placed],
  );

  /** Ближайшая привязка для трёх краёв рамки сразу. */
  const snapAxis = (edges: number[], targets: number[], threshold: number) => {
    let best: { delta: number; line: number } | null = null;
    for (const edge of edges) {
      for (const target of targets) {
        const delta = target - edge;
        if (Math.abs(delta) > threshold) continue;
        if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, line: target };
      }
    }
    return best;
  };

  /* ─── жесты ────────────────────────────────────────────────────────────── */

  const startMove = useCallback(
    (e: React.PointerEvent, layer: Layer) => {
      if (layer.locked || spaceHeld) return;
      e.stopPropagation();
      e.preventDefault();

      const store = useStudio.getState();
      const ids = e.shiftKey
        ? store.selection.includes(layer.id)
          ? store.selection
          : [...store.selection, layer.id]
        : store.selection.includes(layer.id)
          ? store.selection
          : [layer.id];

      store.select(ids);
      // select() подтягивает всю связку — оригиналы берём уже расширенными,
      // иначе связанные слои остались бы на месте.
      const moving = useStudio.getState().selection;
      store.setActiveSection(
        project?.sections.find((s) => s.layers.some((l) => l.id === layer.id))?.id ?? null,
      );

      const origin = new Map<string, Box>();
      for (const { section, top } of placed) {
        for (const l of section.layers) {
          if (moving.includes(l.id)) origin.set(l.id, { x: l.x, y: top + l.y, w: l.w, h: l.h });
        }
      }

      const world = toWorld(e.clientX, e.clientY);
      gestureRef.current = { kind: 'move', startX: world.x, startY: world.y, origin };
      store.beginGesture();
      // Захват указателя не критичен: если браузер его не даёт (указатель уже
      // отпущен, синтетическое событие), жест всё равно должен начаться.
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* обойдёмся без захвата */
      }
    },
    [placed, project, spaceHeld, toWorld],
  );

  const startResize = useCallback(
    (e: React.PointerEvent, handle: Handle) => {
      if (!selectionBox) return;
      e.stopPropagation();
      e.preventDefault();
      const origin = new Map<string, Box>();
      for (const { section, top } of placed) {
        for (const l of section.layers) {
          if (selection.includes(l.id)) origin.set(l.id, { x: l.x, y: top + l.y, w: l.w, h: l.h });
        }
      }
      const world = toWorld(e.clientX, e.clientY);
      gestureRef.current = {
        kind: 'resize',
        handle,
        startX: world.x,
        startY: world.y,
        box: { ...selectionBox },
        origin,
      };
      useStudio.getState().beginGesture();
    },
    [placed, selection, selectionBox, toWorld],
  );

  const startRotate = useCallback(
    (e: React.PointerEvent) => {
      if (!selectionBox || selection.length !== 1 || !project) return;
      e.stopPropagation();
      e.preventDefault();
      const layer = project.sections.flatMap((s) => s.layers).find((l) => l.id === selection[0]);
      if (!layer) return;
      const cx = selectionBox.x + selectionBox.w / 2;
      const cy = selectionBox.y + selectionBox.h / 2;
      const world = toWorld(e.clientX, e.clientY);
      gestureRef.current = {
        kind: 'rotate',
        id: layer.id,
        cx,
        cy,
        startAngle: Math.atan2(world.y - cy, world.x - cx),
        origin: layer.rotation,
      };
      useStudio.getState().beginGesture();
    },
    [project, selection, selectionBox, toWorld],
  );

  /** Нижний край секции тянется мышкой — высота задаётся пропорцией к ширине. */
  const startSectionResize = useCallback(
    (e: React.PointerEvent, sectionId: string, height: number) => {
      e.stopPropagation();
      e.preventDefault();
      const world = toWorld(e.clientX, e.clientY);
      gestureRef.current = { kind: 'section', id: sectionId, startY: world.y, height };
      useStudio.getState().beginGesture();
    },
    [toWorld],
  );

  /* ─── указатель на холсте ──────────────────────────────────────────────── */

  const onAreaPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const middle = e.button === 1;
      if (middle || (spaceHeld && e.button === 0)) {
        e.preventDefault();
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* обойдёмся без захвата */
        }
        panRef.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
        setPanning(true);
        return;
      }
      if (e.button !== 0) return;

      // Инструмент создаёт слой там, где щёлкнули.
      const world = toWorld(e.clientX, e.clientY);
      const hit = placed.find((p) => world.y >= p.top && world.y <= p.top + p.height);
      const store = useStudio.getState();

      if (tool !== 'select' && hit) {
        const localY = world.y - hit.top;
        if (tool === 'text') store.addText(hit.section.id, world.x, localY);
        else if (tool === 'block') store.addBlock(hit.section.id, world.x, localY);
        else store.addShape(hit.section.id, tool === 'rect' ? 'rect' : 'ellipse', world.x, localY);
        setTool('select');
        return;
      }

      store.clearSelection();
      if (hit) store.setActiveSection(hit.section.id);
    },
    [placed, spaceHeld, tool, setTool, toWorld, view.x, view.y],
  );

  const onAreaPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const world = toWorld(e.clientX, e.clientY);
      setCursor({ x: Math.round(world.x), y: Math.round(world.y) });

      const pan = panRef.current;
      if (pan) {
        setView({ x: pan.vx + (e.clientX - pan.sx), y: pan.vy + (e.clientY - pan.sy) });
        return;
      }

      const gesture = gestureRef.current;
      if (!gesture) return;
      const store = useStudio.getState();
      const threshold = SNAP_SCREEN_PX / store.view.zoom;

      if (gesture.kind === 'move') {
        let dx = world.x - gesture.startX;
        let dy = world.y - gesture.startY;

        const ids = [...gesture.origin.keys()];
        const bounds = [...gesture.origin.values()];
        const bx = Math.min(...bounds.map((b) => b.x));
        const by = Math.min(...bounds.map((b) => b.y));
        const bw = Math.max(...bounds.map((b) => b.x + b.w)) - bx;
        const bh = Math.max(...bounds.map((b) => b.y + b.h)) - by;

        const targets = snapTargets(ids);
        const shown: { v: number[]; h: number[] } = { v: [], h: [] };

        if (!e.altKey) {
          const sx = snapAxis([bx + dx, bx + bw / 2 + dx, bx + bw + dx], targets.v, threshold);
          if (sx) {
            dx += sx.delta;
            shown.v.push(sx.line);
          }
          const sy = snapAxis([by + dy, by + bh / 2 + dy, by + bh + dy], targets.h, threshold);
          if (sy) {
            dy += sy.delta;
            shown.h.push(sy.line);
          }
        }
        setGuides(shown);

        store.mutate((draft) => {
          let top = 0;
          for (const section of draft.sections) {
            const height = sectionHeightPx(section, draft.canvas.width);
            for (const layer of section.layers) {
              const origin = gesture.origin.get(layer.id);
              if (!origin || layer.locked) continue;
              layer.x = Math.round(origin.x + dx);
              layer.y = Math.round(origin.y + dy - top);
            }
            top += height + SECTION_GAP;
          }
        });
        return;
      }

      if (gesture.kind === 'resize') {
        const dx = world.x - gesture.startX;
        const dy = world.y - gesture.startY;
        const b = gesture.box;
        const h = gesture.handle;

        let nx = b.x;
        let ny = b.y;
        let nw = b.w;
        let nh = b.h;

        if (h.includes('w')) {
          nx = b.x + dx;
          nw = b.w - dx;
        }
        if (h.includes('e')) nw = b.w + dx;
        if (h.includes('n')) {
          ny = b.y + dy;
          nh = b.h - dy;
        }
        if (h.includes('s')) nh = b.h + dy;

        if (e.shiftKey && b.w > 0 && b.h > 0) {
          const ratio = b.w / b.h;
          if (Math.abs(nw / ratio - nh) > 0.5) {
            if (h === 'n' || h === 's') nw = nh * ratio;
            else nh = nw / ratio;
            if (h.includes('n')) ny = b.y + b.h - nh;
            if (h.includes('w')) nx = b.x + b.w - nw;
          }
        }

        nw = Math.max(4, nw);
        nh = Math.max(4, nh);
        const scaleX = b.w ? nw / b.w : 1;
        const scaleY = b.h ? nh / b.h : 1;

        setGuides({ v: [], h: [] });
        store.mutate((draft) => {
          let top = 0;
          for (const section of draft.sections) {
            const height = sectionHeightPx(section, draft.canvas.width);
            for (const layer of section.layers) {
              const origin = gesture.origin.get(layer.id);
              if (!origin || layer.locked) continue;
              layer.x = Math.round(nx + (origin.x - b.x) * scaleX);
              layer.y = Math.round(ny + (origin.y - b.y) * scaleY - top);
              layer.w = Math.max(4, Math.round(origin.w * scaleX));
              layer.h = Math.max(4, Math.round(origin.h * scaleY));
            }
            top += height + SECTION_GAP;
          }
        });
        return;
      }

      if (gesture.kind === 'section') {
        const next = Math.max(60, gesture.height + (world.y - gesture.startY));
        store.mutate((draft) => {
          const section = draft.sections.find((s) => s.id === gesture.id);
          if (section) section.height = { mode: 'ratio', value: next / draft.canvas.width };
        });
        return;
      }

      if (gesture.kind === 'rotate') {
        const angle = Math.atan2(world.y - gesture.cy, world.x - gesture.cx);
        let degrees = gesture.origin + ((angle - gesture.startAngle) * 180) / Math.PI;
        if (e.shiftKey) degrees = Math.round(degrees / 15) * 15;
        store.mutate((draft) => {
          for (const section of draft.sections) {
            const layer = section.layers.find((l) => l.id === gesture.id);
            if (layer) layer.rotation = Math.round(degrees * 10) / 10;
          }
        });
      }
    },
    [setView, snapTargets, toWorld],
  );

  const endPointer = useCallback(() => {
    panRef.current = null;
    setPanning(false);
    const gesture = gestureRef.current;
    if (gesture) {
      const label =
        gesture.kind === 'move'
          ? 'Перемещение'
          : gesture.kind === 'resize'
            ? 'Размер'
            : gesture.kind === 'section'
              ? 'Высота секции'
              : 'Поворот';
      useStudio.getState().endGesture(label);
      gestureRef.current = null;
      setGuides({ v: [], h: [] });
    }
  }, []);

  /* ─── файлы, брошенные в окно ──────────────────────────────────────────── */

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDropHint(false);
      const files = [...e.dataTransfer.files].filter(
        (f) => f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.svg'),
      );
      if (!files.length) return;

      const store = useStudio.getState();

      // Файл поверх существующей картинки — это замена источника, а не новый
      // слой: рамка, кроп и позиция должны остаться на месте.
      const overLayer = (e.target as HTMLElement).closest?.('[data-layer]');
      const overId = overLayer?.getAttribute('data-layer');
      if (overId) {
        const target = store.project?.sections
          .flatMap((s) => s.layers)
          .find((l) => l.id === overId);
        if (target?.kind === 'image') {
          await store.replaceLayerAsset(overId, files[0]);
          return;
        }
      }

      const world = toWorld(e.clientX, e.clientY);
      const hit =
        placed.find((p) => world.y >= p.top && world.y <= p.top + p.height) ??
        placed.find((p) => p.section.id === store.activeSectionId) ??
        placed[0];
      if (!hit) return;

      await store.dropOnCanvas(files, hit.section.id, world.x, world.y - hit.top);
    },
    [placed, toWorld],
  );

  /* Esc во время жеста откатывает его целиком. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !gestureRef.current) return;
      useStudio.getState().cancelGesture();
      gestureRef.current = null;
      setGuides({ v: [], h: [] });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!project) return <div className={css.canvasArea} />;

  const width = project.canvas.width;
  const inv = 1 / view.zoom;
  const assetUrl = assetUrlFor(project);

  return (
    <div
      ref={areaRef}
      className={css.canvasArea}
      data-panning={panning}
      data-panready={spaceHeld && !panning}
      style={tool !== 'select' && !spaceHeld ? { cursor: 'crosshair' } : undefined}
      onPointerDown={onAreaPointerDown}
      onPointerMove={onAreaPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={() => setCursor(null)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (!dropHint) setDropHint(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDropHint(false);
      }}
      onDrop={onDrop}
    >
      <div className={css.rulerCorner} />
      <div className={css.rulerX}>
        <Ruler orientation="x" length={size.w} offset={view.x} zoom={view.zoom} />
      </div>
      <div className={css.rulerY}>
        <Ruler orientation="y" length={size.h} offset={view.y} zoom={view.zoom} />
      </div>

      <div className={css.viewport}>
        <div
          className={css.world}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        >
          {/* Тень принадлежит странице целиком: у каждой секции своя рисовала
              на стыках тёмные полосы, которых на сайте нет. */}
          <div className={css.pageShade} style={{ width, height: docHeight }} />

          {placed.map(({ section, top, height }, i) => {
            const active = section.id === activeSectionId;
            return (
              <div key={section.id}>
                <div
                  className={`${css.sectionTag} ${active ? css.sectionTagActive : ''}`}
                  style={{ top, fontSize: 11 * inv, left: -10 * inv }}
                >
                  {i + 1}. {section.name}
                </div>
                <div
                  className={`${css.sectionBox} ${active ? css.sectionBoxActive : ''}`}
                  style={{
                    top,
                    width,
                    height,
                    background: fillCss(section.background, assetUrl) || '#ffffff',
                    /* Секция, где декор нарочно выходит за края, не режет
                       его сверху и снизу — но по бокам его подрезает ширина
                       страницы, ровно как body { overflow-x: hidden } в
                       готовом шаблоне. Без этого рамка, задуманная под обрез,
                       вылезала на тёмное поле рядом с холстом. */
                    overflow: section.clip === false ? 'visible' : 'hidden',
                    clipPath: section.clip === false ? 'inset(-100000px 0px)' : undefined,
                    outlineWidth: active ? Math.max(1, inv) : undefined,
                  }}
                >
                  {section.layers.map((layer) =>
                    layer.hidden ? null : (
                      <LayerNode
                        key={layer.id}
                        layer={layer}
                        project={project}
                        editing={editingLayerId === layer.id}
                        caretPoint={editingLayerId === layer.id ? caretPoint : null}
                        onPointerDown={(e) => startMove(e, layer)}
                        onDoubleClick={(e) => {
                          if (layer.kind !== 'text' || layer.locked) return;
                          e.stopPropagation();
                          setCaretPoint({ x: e.clientX, y: e.clientY });
                          useStudio.getState().setEditingLayer(layer.id);
                        }}
                        onTextDone={(value, height) => {
                          const store = useStudio.getState();
                          store.setEditingLayer(null);
                          // null — отказались по Escape, документ не трогаем.
                          if (value === null || layer.kind !== 'text') return;
                          const patch: Record<string, unknown> = {};
                          if (value !== layer.content) patch.content = value;
                          // Рамка подгоняется под набранное: иначе выделение и
                          // высота секции «по содержимому» считались бы по старому.
                          const measured = Math.round(height ?? 0);
                          if (measured > 0 && Math.abs(measured - layer.h) > 1) patch.h = measured;
                          if (Object.keys(patch).length) store.patchLayer(layer.id, patch);
                        }}
                      />
                    ),
                  )}
                  {!section.layers.length && (
                    <div className={css.sectionPlaceholder} style={{ fontSize: 12 * inv }}>
                      пусто
                    </div>
                  )}
                </div>

                {/* тянется вниз — меняет высоту секции */}
                <div
                  className={css.sectionGrip}
                  style={{
                    top: top + height - 3 * inv,
                    width,
                    height: 6 * inv,
                  }}
                  title="Потяните, чтобы изменить высоту секции"
                  onPointerDown={(e) => startSectionResize(e, section.id, height)}
                />
              </div>
            );
          })}

          {/* направляющие */}
          {guides.v.map((x) => (
            <div
              key={`v${x}`}
              className={css.guideV}
              style={{ left: x, top: -40, height: docHeight + 80, width: inv }}
            />
          ))}
          {guides.h.map((y) => (
            <div
              key={`h${y}`}
              className={css.guideH}
              style={{ top: y, left: -40, width: width + 80, height: inv }}
            />
          ))}

          {/* рамка выделения */}
          {selectionBox && !editingLayerId && (
            <div
              className={css.selBox}
              style={{
                left: selectionBox.x,
                top: selectionBox.y,
                width: selectionBox.w,
                height: selectionBox.h,
                outlineWidth: Math.max(1, inv),
              }}
            >
              {selection.length === 1 && (
                <span
                  className={css.rotateHandle}
                  style={{
                    width: 9 * inv,
                    height: 9 * inv,
                    top: -22 * inv,
                    borderWidth: inv,
                  }}
                  onPointerDown={startRotate}
                />
              )}
              {HANDLES.map((handle) => {
                const pos: Record<string, number | string> = {};
                pos.left = handle.includes('w') ? 0 : handle.includes('e') ? '100%' : '50%';
                pos.top = handle.includes('n') ? 0 : handle.includes('s') ? '100%' : '50%';
                return (
                  <span
                    key={handle}
                    className={css.handle}
                    style={{
                      ...pos,
                      width: 8 * inv,
                      height: 8 * inv,
                      marginLeft: -4 * inv,
                      marginTop: -4 * inv,
                      borderWidth: inv,
                      cursor: CURSORS[handle],
                    }}
                    onPointerDown={(e) => startResize(e, handle)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {dropHint && (
        <div className={css.dropHint}>
          <span>Отпустите — фото ляжет сюда</span>
        </div>
      )}

      <div className={css.statusBar}>
        <span>
          холст {width} × {Math.round(docHeight)}
        </span>
        <span>{cursor ? `x ${cursor.x}  y ${cursor.y}` : 'x —  y —'}</span>
        <span>{Math.round(view.zoom * 100)}%</span>
        {!!selection.length && <span>выделено: {selection.length}</span>}
      </div>
    </div>
  );
}
