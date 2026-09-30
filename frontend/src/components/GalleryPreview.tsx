'use client';
import { useEffect, useRef, useState } from 'react';
import TemplatePreview, { type InviteData } from './TemplatePreview';
import PreviewScale from './PreviewScale';
import LazyMount from './LazyMount';

// Applied only inside the gallery frame, never to the guest invitation/editor.
const GALLERY_STILL_CSS = `
  *, *::before, *::after {
    animation-duration: .001ms !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
  .rv, .rv-soft, .rv-write, .rv-brush, .reveal, .anim, .fu,
  .fade-up, .fade-soft, .hero-in, .hero__photo {
    opacity: 1 !important; transform: none !important; filter: none !important;
    mask-image: none !important; -webkit-mask-image: none !important;
  }
  #envelope, #envelope-screen, .hero__live { display: none !important; }
`;

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
    const stop = () => setActive(false);
    const start = () => {
      if (pointer.matches && !motion.matches) setActive(true);
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
    let preparedDocument: Document | null = null;
    const animate = (now: number) => {
      const layer = live.current;
      const iframe = layer?.querySelector('iframe');
      // Local invitation frames are same-origin. Never move the gallery page.
      let viewport: Element | null = null;
      try {
        const doc = iframe?.contentDocument;
        if (doc?.head && doc.body?.children.length && doc !== preparedDocument) {
          const style = doc.createElement('style');
          style.dataset.galleryStill = 'true';
          style.textContent = GALLERY_STILL_CSS;
          doc.head.append(style);
          preparedDocument = doc;
        }
        viewport = iframe
          ? (iframe.contentDocument?.body?.children.length
            ? iframe.contentDocument.scrollingElement : null)
          : layer?.querySelector('[data-preview-viewport] > div') || null;
      } catch { /* An unavailable frame keeps its static cover. */ }
      if (viewport && viewport.scrollHeight > viewport.clientHeight) {
        if (layer) layer.style.opacity = '1';
        // 150 visible pixels/sec, with no intro pause, at any card width.
        const scale = (host.current?.clientWidth || 480) / 480;
        if (previous) position += Math.min(now - previous, 50) * .15 / scale;
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
    {active && <div ref={live} data-gallery-live aria-hidden="true" inert style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}>
      <PreviewScale className={className}><div style={{ width: '100%', height: '100%' }}><TemplatePreview data={data} apiBase={apiBase} editing /></div></PreviewScale>
    </div>}
  </div>;
}
