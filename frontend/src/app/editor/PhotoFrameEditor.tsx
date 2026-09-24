'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/* Кадрирование фото в рамке шаблона.
   Окно повторяет пропорции рамки (их сообщает шаблон, см. public/invite/assets/
   photo-frame.js) и рисует фото той же математикой, что и шаблон: масштаб от
   «заполнить рамку» (cover) и положение в процентах, как object-position.
   Двигать — перетаскиванием (мышь/палец), масштаб — ползунком, щипком или
   Ctrl + колесо, стрелки/+/− с клавиатуры. */

export interface PhotoFrame { x: number; y: number; z: number }
/** Рамка в шаблоне: размер (важны пропорции), исходное положение фото, текущее фото */
export interface PhotoSlot { w: number; h: number; x: number; y: number; src?: string }

const MIN_Z = 1;
const MAX_Z = 4;
const MAX_BOX_H = 260;   // высокие рамки (обложка на весь экран) не растягивают панель

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number) => Math.round(v * 100) / 100;

const ALIGN = [0, 50, 100];

const btn: React.CSSProperties = {
  border: '1px solid rgba(206,197,186,0.6)', borderRadius: 8, background: '#fff',
  color: '#4b463d', cursor: 'pointer', fontFamily: 'var(--font-inter)',
};

export default function PhotoFrameEditor({ src, frame, slot, onChange }: {
  src: string;
  frame: PhotoFrame | null;
  slot?: PhotoSlot;
  onChange: (f: PhotoFrame | null) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  // Натуральный размер фото — нужен, чтобы перевести сдвиг пальца в проценты
  const [loaded, setLoaded] = useState<{ src: string; w: number; h: number } | null>(null);
  const nat = loaded && loaded.src === src ? loaded : null;
  // Пока тянем — показываем локально, в данные уходит не чаще кадра анимации.
  // `base` — кадр из данных, от которого сделан шаг: как только данные
  // обновятся (новый объект), показываем уже их.
  const [live, setLive] = useState<{ f: PhotoFrame; base: PhotoFrame | null } | null>(null);
  const pending = useRef<PhotoFrame | null>(null);
  const raf = useRef(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    sx: number; sy: number; f: PhotoFrame; spanX: number; spanY: number;
    dist?: number;
  } | null>(null);

  const ratio = slot && slot.w > 0 && slot.h > 0 ? slot.w / slot.h : 3 / 4;
  const base: PhotoFrame = frame ?? { x: slot?.x ?? 50, y: slot?.y ?? 50, z: 1 };
  const cur = live && live.base === frame ? live.f : base;

  useEffect(() => {
    if (!src) return;
    const im = new Image();
    im.onload = () => setLoaded({ src, w: im.naturalWidth || 1, h: im.naturalHeight || 1 });
    im.src = src;
    return () => { im.onload = null; };
  }, [src]);

  const commit = (f: PhotoFrame) => {
    const next = { x: round(clamp(f.x, 0, 100)), y: round(clamp(f.y, 0, 100)), z: round(clamp(f.z, MIN_Z, MAX_Z)) };
    setLive({ f: next, base: frame });
    pending.current = next;
    if (!raf.current) {
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        const p = pending.current;
        pending.current = null;
        if (p) onChangeRef.current(p);
      });
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
    if (pending.current) onChangeRef.current(pending.current);
  }, []);

  /* ── перетаскивание и щипок ── */
  // Сколько фото выступает за рамку при масштабе z: на это расстояние и двигается
  const spans = (z: number) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r || !nat) return { spanX: 0, spanY: 0 };
    const k = Math.max(r.width / nat.w, r.height / nat.h) * z;
    return { spanX: r.width - nat.w * k, spanY: r.height - nat.h * k };
  };

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    const f = curRef.current;
    const { spanX, spanY } = spans(f.z);
    const c = pts.length === 2
      ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      : pts[0];
    gesture.current = {
      sx: c.x, sy: c.y, f, spanX, spanY,
      dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!nat) return;
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
    const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
    commit({
      ...g.f,
      x: g.spanX ? g.f.x + (dx * 100) / g.spanX : g.f.x,
      y: g.spanY ? g.f.y + (dy * 100) / g.spanY : g.f.y,
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
    const moves: Record<string, Partial<PhotoFrame>> = {
      ArrowLeft: { x: cur.x + step }, ArrowRight: { x: cur.x - step },
      ArrowUp: { y: cur.y + step }, ArrowDown: { y: cur.y - step },
      '+': { z: cur.z + 0.1 }, '=': { z: cur.z + 0.1 }, '-': { z: cur.z - 0.1 },
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    commit({ ...cur, ...m });
  };

  const wide = nat ? nat.w / nat.h > ratio : true;
  const pct = `${round(cur.z * 100)}%`;

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
            width: `min(100%, ${Math.round(MAX_BOX_H * ratio)}px)`,
            aspectRatio: String(ratio),
            borderRadius: 6,
            outline: '1px solid rgba(104,93,74,0.35)',
            background: '#e9e4dc',
            backgroundImage: src ? `url("${src.replace(/"/g, '%22')}")` : undefined,
            backgroundRepeat: 'no-repeat',
            backgroundSize: wide ? `auto ${pct}` : `${pct} auto`,
            backgroundPosition: `${cur.x}% ${cur.y}%`,
            cursor: nat ? 'grab' : 'default',
            touchAction: 'none',
            userSelect: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <button type="button" aria-label="Уменьшить" onClick={() => commit({ ...cur, z: cur.z - 0.1 })}
          disabled={cur.z <= MIN_Z} style={{ ...btn, width: 28, height: 28, padding: 0, fontSize: 16, opacity: cur.z <= MIN_Z ? 0.4 : 1 }}>−</button>
        <input type="range" min={MIN_Z} max={MAX_Z} step={0.01} value={cur.z} aria-label="Масштаб фото"
          onChange={e => commit({ ...cur, z: +e.target.value })}
          style={{ flex: 1, accentColor: '#685d4a' }} />
        <button type="button" aria-label="Увеличить" onClick={() => commit({ ...cur, z: cur.z + 0.1 })}
          disabled={cur.z >= MAX_Z} style={{ ...btn, width: 28, height: 28, padding: 0, fontSize: 16, opacity: cur.z >= MAX_Z ? 0.4 : 1 }}>+</button>
        <span style={{ width: 42, textAlign: 'right', fontSize: 11, color: '#7d766c', fontFamily: 'var(--font-inter)' }}>{pct}</span>
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
        <div style={{ flex: 1, fontSize: 11, lineHeight: 1.4, color: '#7d766c', fontFamily: 'var(--font-inter)' }}>
          Перетащите фото в рамке. Масштаб — ползунком или щипком
        </div>
        <button type="button" onClick={() => { setLive(null); onChange(null); }} disabled={!frame}
          style={{ ...btn, padding: '6px 10px', fontSize: 12, opacity: frame ? 1 : 0.45, cursor: frame ? 'pointer' : 'default' }}>
          Сбросить
        </button>
      </div>
    </div>
  );
}
