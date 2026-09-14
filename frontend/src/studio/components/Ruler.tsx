'use client';

import { useEffect, useRef } from 'react';

/* Линейка холста. Рисуется на <canvas>, чтобы штрихи оставались чёткими
   на любом зуме и на экранах с дробным DPR. */

const NICE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
const THICKNESS = 22;

interface Props {
  orientation: 'x' | 'y';
  /** длина линейки в экранных пикселях */
  length: number;
  /** сдвиг начала координат холста, в экранных пикселях */
  offset: number;
  zoom: number;
}

export default function Ruler({ orientation, length, offset, zoom }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || length <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const w = orientation === 'x' ? length : THICKNESS;
    const h = orientation === 'x' ? THICKNESS : length;

    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // шаг подписей: не чаще, чем раз в ~64 экранных пикселя
    const step = NICE_STEPS.find((s) => s * zoom >= 64) ?? NICE_STEPS[NICE_STEPS.length - 1];
    const minor = step / (step % 5 === 0 ? 5 : 4);

    const from = Math.floor(-offset / zoom / minor) * minor;
    const to = from + length / zoom + minor;

    ctx.font = '10px ui-monospace, "Cascadia Mono", monospace';
    ctx.fillStyle = '#6f6c7b';
    ctx.strokeStyle = '#3d3d47';
    ctx.lineWidth = 1;
    ctx.textBaseline = 'top';

    ctx.beginPath();
    for (let world = from; world <= to; world += minor) {
      const pos = Math.round(offset + world * zoom) + 0.5;
      if (pos < 0 || pos > (orientation === 'x' ? w : h)) continue;

      const isMajor = Math.abs(world % step) < minor / 2;
      const len = isMajor ? THICKNESS : 5;

      if (orientation === 'x') {
        ctx.moveTo(pos, THICKNESS - len);
        ctx.lineTo(pos, THICKNESS);
      } else {
        ctx.moveTo(THICKNESS - len, pos);
        ctx.lineTo(THICKNESS, pos);
      }

      if (isMajor) {
        const label = String(Math.round(world));
        if (orientation === 'x') {
          ctx.fillText(label, pos + 3, 3);
        } else {
          ctx.save();
          ctx.translate(3, pos - 3);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      }
    }
    ctx.stroke();
  }, [orientation, length, offset, zoom]);

  return <canvas ref={ref} aria-hidden="true" />;
}
