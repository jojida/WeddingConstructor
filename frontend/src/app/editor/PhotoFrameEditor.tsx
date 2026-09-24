'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/* Кадрирование фото в рамке шаблона.
   Окно повторяет пропорции рамки (их сообщает шаблон, см. public/invite/assets/
   photo-frame.js) и рисует фото той же математикой, что и шаблон: масштаб от
   «заполнить рамку» (cover), положение в процентах, как object-position, и
   поворот, при котором фото всё равно заполняет рамку без пустых углов.
   Двигать — перетаскиванием (мышь/палец), масштаб — ползунком, щипком или
   Ctrl + колесо, поворот — ползунком и кнопками на 90°. С клавиатуры: стрелки,
   +/−, [ и ]. */

export interface PhotoFrame { x: number; y: number; z: number; r?: number }
/** Рамка в шаблоне: размер (важны пропорции), исходное положение фото, текущее фото */
export interface PhotoSlot { w: number; h: number; x: number; y: number; src?: string }

const MIN_Z = 1;
const MAX_Z = 4;
const MAX_BOX_H = 260;   // высокие рамки (обложка на весь экран) не растягивают панель

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number) => Math.round(v * 100) / 100;
// Угол в −180…180: 190° — это −170°
const wrapAngle = (a: number) => {
  const w = (((a % 360) + 540) % 360) - 180;
  return w === -180 ? 180 : w;
};
// Ползунок липнет к прямым углам — ровно выставить 0° или 90° пальцем трудно
const snapAngle = (a: number) => {
  for (const t of [-180, -90, 0, 90, 180]) if (Math.abs(a - t) <= 2) return t;
  return a;
};

/* Та же геометрия, что в photo-frame.js: фото (iw×ih) повёрнуто на r и
   заполняет рамку W×H; x/y двигают его вдоль его сторон по оставшемуся запасу */
function geometry(W: number, H: number, iw: number, ih: number, f: PhotoFrame) {
  const th = ((f.r || 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th));
  const bw = W * c + H * s, bh = W * s + H * c;
  const k = Math.max(bw / iw, bh / ih) * f.z;
  const w = iw * k, h = ih * k;
  return {
    th, w, h, spareX: w - bw, spareY: h - bh,
    left: -bw / 2 - ((w - bw) * f.x) / 100,
    top: -bh / 2 - ((h - bh) * f.y) / 100,
  };
}

const ALIGN = [0, 50, 100];

const btn: React.CSSProperties = {
  border: '1px solid rgba(206,197,186,0.6)', borderRadius: 8, background: '#fff',
  color: '#4b463d', cursor: 'pointer', fontFamily: 'var(--font-inter)',
};
const label: React.CSSProperties = { fontSize: 11, color: '#7d766c', fontFamily: 'var(--font-inter)' };

export default function PhotoFrameEditor({ src, frame, slot, onChange }: {
  src: string;
  frame: PhotoFrame | null;
  slot?: PhotoSlot;
  onChange: (f: PhotoFrame | null) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // Фото загружено (для этого src) — можно рисовать и двигать
  const [loaded, setLoaded] = useState<string | null>(null);
  const ready = loaded === src;
  // Окно поменяло размер — перерисовать (сам размер меряем при отрисовке)
  const [resized, setResized] = useState(0);
  // Пока тянем — показываем локально, в данные уходит не чаще кадра анимации.
  // `base` — кадр из данных, от которого сделан шаг: как только данные
  // обновятся (новый объект), показываем уже их.
  const [live, setLive] = useState<{ f: PhotoFrame; base: PhotoFrame | null } | null>(null);
  const pending = useRef<PhotoFrame | null>(null);
  const raf = useRef(0);
  const timer = useRef(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    sx: number; sy: number; f: PhotoFrame; spareX: number; spareY: number; th: number;
    dist?: number;
  } | null>(null);

  const ratio = slot && slot.w > 0 && slot.h > 0 ? slot.w / slot.h : 3 / 4;
  const base: PhotoFrame = frame ?? { x: slot?.x ?? 50, y: slot?.y ?? 50, z: 1, r: 0 };
  const cur = live && live.base === frame ? live.f : base;
  const angle = cur.r || 0;

  useEffect(() => {
    if (!src) return;
    const im = new Image();
    im.onload = () => { imgRef.current = im; setLoaded(src); };
    im.src = src;
    return () => { im.onload = null; };
  }, [src]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setResized(n => n + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Рисуем кадр
  useEffect(() => {
    const box = boxRef.current, cv = canvasRef.current, im = imgRef.current;
    if (!box || !cv) return;
    const W = box.clientWidth, H = box.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#e9e4dc';
    ctx.fillRect(0, 0, W, H);
    if (!ready || !im) return;
    const g = geometry(W, H, im.naturalWidth || 1, im.naturalHeight || 1, { x: cur.x, y: cur.y, z: cur.z, r: angle });
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(W / 2, H / 2);
    ctx.rotate(g.th);
    ctx.drawImage(im, g.left, g.top, g.w, g.h);
  }, [resized, ready, cur.x, cur.y, cur.z, angle]);

  const commit = (f: PhotoFrame) => {
    const next: PhotoFrame = {
      x: round(clamp(f.x, 0, 100)),
      y: round(clamp(f.y, 0, 100)),
      z: round(clamp(f.z, MIN_Z, MAX_Z)),
      r: Math.round(wrapAngle(f.r || 0) * 10) / 10,
    };
    setLive({ f: next, base: frame });
    pending.current = next;
    if (!raf.current) {
      // Кадр анимации, а если вкладка в фоне и он не приходит — таймер
      const flush = () => {
        cancelAnimationFrame(raf.current);
        clearTimeout(timer.current);
        raf.current = 0;
        const p = pending.current;
        pending.current = null;
        if (p) onChangeRef.current(p);
      };
      raf.current = requestAnimationFrame(flush);
      timer.current = window.setTimeout(flush, 60);
    }
  };
  // Свежие commit/onChange/положение — для нативного колеса, жестов и закрытия окна
  const commitRef = useRef(commit);
  const onChangeRef = useRef(onChange);
  const curRef = useRef(cur);
  useLayoutEffect(() => {
    commitRef.current = commit;
    onChangeRef.current = onChange;
    curRef.current = cur;
  });

  // Окно закрыли посреди движения — последнее положение не теряем
  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    clearTimeout(timer.current);
    if (pending.current) onChangeRef.current(pending.current);
  }, []);

  /* ── перетаскивание и щипок ── */
  const startGesture = () => {
    const pts = [...pointers.current.values()];
    const f = curRef.current;
    const r = boxRef.current?.getBoundingClientRect();
    const im = imgRef.current;
    // Запас фото за рамкой вдоль его сторон — на столько его можно сдвинуть
    const g = r && im
      ? geometry(r.width, r.height, im.naturalWidth || 1, im.naturalHeight || 1, f)
      : { spareX: 0, spareY: 0, th: 0 };
    const c = pts.length === 2
      ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      : pts[0];
    gesture.current = {
      sx: c.x, sy: c.y, f, spareX: g.spareX, spareY: g.spareY, th: g.th,
      dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!ready) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* указатель уже отпущен */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (pts.length >= 2 && g.dist) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      commit({ ...g.f, z: g.f.z * (d / g.dist) });
      return;
    }
    // Сдвиг пальца на экране → вдоль сторон повёрнутого фото
    const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
    const cos = Math.cos(g.th), sin = Math.sin(g.th);
    const ix = dx * cos + dy * sin, iy = -dx * sin + dy * cos;
    commit({
      ...g.f,
      x: g.spareX > 0.5 ? g.f.x - (ix * 100) / g.spareX : g.f.x,
      y: g.spareY > 0.5 ? g.f.y - (iy * 100) / g.spareY : g.f.y,
    });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) startGesture();   // остался один палец — продолжаем двигать
    else gesture.current = null;
  };

  // Ctrl + колесо (и щипок на тачпаде) — масштаб. Обычное колесо листает панель.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const f = curRef.current;
      commitRef.current({ ...f, z: f.z * Math.exp(-e.deltaY * 0.01) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Стрелка двигает фото в свою сторону: влево — открывается правая часть кадра
    const step = e.shiftKey ? 10 : 2;
    const turn = e.shiftKey ? 15 : 1;
    const moves: Record<string, Partial<PhotoFrame>> = {
      ArrowLeft: { x: cur.x + step }, ArrowRight: { x: cur.x - step },
      ArrowUp: { y: cur.y + step }, ArrowDown: { y: cur.y - step },
      '+': { z: cur.z + 0.1 }, '=': { z: cur.z + 0.1 }, '-': { z: cur.z - 0.1 },
      '[': { r: angle - turn }, ']': { r: angle + turn },
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    commit({ ...cur, ...m });
  };

  const pct = `${round(cur.z * 100)}%`;
  const deg = `${Math.round(angle)}°`;

  return (
    <div style={{ marginTop: 8, padding: 10, border: '1px solid rgba(206,197,186,0.5)', borderRadius: 10, background: '#fafaf7' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div
          ref={boxRef}
          role="img"
          aria-label="Кадр фото: перетащите, чтобы выбрать, какая часть видна в рамке"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          style={{
            position: 'relative',
            width: `min(100%, ${Math.round(MAX_BOX_H * ratio)}px)`,
            aspectRatio: String(ratio),
            borderRadius: 6,
            overflow: 'hidden',
            outline: '1px solid rgba(104,93,74,0.35)',
            background: '#e9e4dc',
            cursor: ready ? 'grab' : 'default',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <button type="button" aria-label="Уменьшить" onClick={() => commit({ ...cur, z: cur.z - 0.1 })}
          disabled={cur.z <= MIN_Z} style={{ ...btn, width: 28, height: 28, padding: 0, fontSize: 16, opacity: cur.z <= MIN_Z ? 0.4 : 1 }}>−</button>
        <input type="range" min={MIN_Z} max={MAX_Z} step={0.01} value={cur.z} aria-label="Масштаб фото"
          onChange={e => commit({ ...cur, z: +e.target.value })}
          style={{ flex: 1, minWidth: 0, accentColor: '#685d4a' }} />
        <button type="button" aria-label="Увеличить" onClick={() => commit({ ...cur, z: cur.z + 0.1 })}
          disabled={cur.z >= MAX_Z} style={{ ...btn, width: 28, height: 28, padding: 0, fontSize: 16, opacity: cur.z >= MAX_Z ? 0.4 : 1 }}>+</button>
        <span style={{ ...label, width: 42, textAlign: 'right' }}>{pct}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <button type="button" aria-label="Повернуть на 90° против часовой" title="Повернуть на 90° против часовой"
          onClick={() => commit({ ...cur, r: angle - 90 })}
          style={{ ...btn, width: 28, height: 28, padding: 0, fontSize: 15 }}>↺</button>
        <input type="range" min={-180} max={180} step={1} value={Math.round(angle)} aria-label="Поворот фото"
          onChange={e => commit({ ...cur, r: snapAngle(+e.target.value) })}
          style={{ flex: 1, minWidth: 0, accentColor: '#685d4a' }} />
        <button type="button" aria-label="Повернуть на 90° по часовой" title="Повернуть на 90° по часовой"
          onClick={() => commit({ ...cur, r: angle + 90 })}
          style={{ ...btn, width: 28, height: 28, padding: 0, fontSize: 15 }}>↻</button>
        <span style={{ ...label, width: 42, textAlign: 'right' }}>{deg}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <div role="group" aria-label="Выравнивание фото в рамке"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 16px)', gap: 3, padding: 4, border: '1px solid rgba(206,197,186,0.6)', borderRadius: 8, background: '#fff' }}>
          {ALIGN.map(y => ALIGN.map(x => {
            const on = Math.abs(cur.x - x) < 0.5 && Math.abs(cur.y - y) < 0.5;
            return (
              <button key={`${x}-${y}`} type="button" onClick={() => commit({ ...cur, x, y })}
                aria-label={`Выровнять: ${y === 0 ? 'верх' : y === 50 ? 'середина' : 'низ'}, ${x === 0 ? 'слева' : x === 50 ? 'по центру' : 'справа'}`}
                aria-pressed={on}
                style={{ width: 16, height: 16, padding: 0, borderRadius: 4, cursor: 'pointer', border: on ? 'none' : '1px solid rgba(104,93,74,0.35)', background: on ? '#685d4a' : '#f3efe8' }} />
            );
          }))}
        </div>
        <div style={{ ...label, flex: 1, lineHeight: 1.4 }}>
          Перетащите фото в рамке. Масштаб и поворот — ползунками
        </div>
        <button type="button" onClick={() => { setLive(null); onChange(null); }} disabled={!frame}
          style={{ ...btn, padding: '6px 10px', fontSize: 12, opacity: frame ? 1 : 0.45, cursor: frame ? 'pointer' : 'default' }}>
          Сбросить
        </button>
      </div>
    </div>
  );
}
