'use client';
import { useEffect, useRef, useState } from 'react';
import TemplatePreview, { type InviteData } from './TemplatePreview';
import PreviewScale from './PreviewScale';
import LazyMount from './LazyMount';

/** Only the hovered card mounts a live invitation. Touch keeps the light cover. */
export default function GalleryPreview({ className, data, apiBase }: {
  className?: string;
  data: InviteData;
  apiBase: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = host.current;
    const card = element?.closest('a') || element?.parentElement?.parentElement;
    if (!card) return;
    const pointer = matchMedia('(hover: hover) and (pointer: fine)');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => { clearTimeout(timer); setActive(false); };
    const start = () => {
      clearTimeout(timer);
      if (pointer.matches && !motion.matches) timer = setTimeout(() => setActive(true), 250);
    };
    const visibility = () => { if (document.hidden) stop(); };
    card.addEventListener('mouseenter', start);
    card.addEventListener('mouseleave', stop);
    motion.addEventListener('change', stop);
    pointer.addEventListener('change', stop);
    document.addEventListener('visibilitychange', visibility);
    const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) stop(); });
    observer.observe(card);
    return () => {
      clearTimeout(timer);
      card.removeEventListener('mouseenter', start);
      card.removeEventListener('mouseleave', stop);
      motion.removeEventListener('change', stop);
      pointer.removeEventListener('change', stop);
      document.removeEventListener('visibilitychange', visibility);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let previous = 0;
    let position = 0;
    let readyAt = 0;
    const animate = (now: number) => {
      const layer = live.current;
      const iframe = layer?.querySelector('iframe');
      // Local invitation frames are same-origin. Never move the gallery page.
      let viewport: Element | null = null;
      try {
        viewport = iframe
          ? (iframe.contentDocument?.body?.children.length
            ? iframe.contentDocument.scrollingElement : null)
          : layer?.querySelector('[data-preview-viewport] > div') || null;
      } catch { /* An unavailable frame keeps its static cover. */ }
      if (viewport && viewport.scrollHeight > viewport.clientHeight) {
        if (!readyAt) readyAt = now + 800;
        if (layer) layer.style.opacity = '1';
        // 45 visible pixels/sec, regardless of card width or display refresh rate.
        const scale = (host.current?.clientWidth || 480) / 480;
        if (now > readyAt && previous) position += Math.min(now - previous, 50) * .045 / scale;
        viewport.scrollTo({ top: Math.min(position, viewport.scrollHeight - viewport.clientHeight), behavior: 'instant' });
      }
      previous = now;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return <div ref={host} data-gallery-preview style={{ position: 'relative', width: '100%', height: '100%', pointerEvents: 'none' }}>
    <PreviewScale className={className}><LazyMount><TemplatePreview data={data} apiBase={apiBase} /></LazyMount></PreviewScale>
    {active && <div ref={live} data-gallery-live aria-hidden="true" inert style={{ position: 'absolute', inset: 0, opacity: 0, transition: 'opacity .2s', pointerEvents: 'none' }}>
      <PreviewScale className={className}><div style={{ width: '100%', height: '100%' }}><TemplatePreview data={data} apiBase={apiBase} editing /></div></PreviewScale>
    </div>}
  </div>;
}
