'use client';
import { useEffect, useRef, useState } from 'react';
import TemplatePreview, { type InviteData } from './TemplatePreview';
import PreviewScale from './PreviewScale';
import LazyMount from './LazyMount';

/* Hover scrolling slides a pre-rendered long screenshot of the invitation
   (scripts/generate-gallery-scrolls.cjs → public/gallery-scroll/<id>.webp).
   A live invitation would boot its intro, flash and load on every hover;
   the image is fetched and decoded ahead of time, so motion starts at once.
   Bump the version after regenerating the images. */
const SCROLL_VERSION = '1';
const BASE_WIDTH = 480;
/** Invitation pixels per second, as if a guest were scrolling. */
const SPEED = 150;

export default function GalleryPreview({ className, data, apiBase }: {
  className?: string;
  data: InviteData;
  apiBase: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLImageElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  // Preload only on devices with hover, once the card is close to the screen.
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const pointer = matchMedia('(hover: hover) and (pointer: fine)');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    if (!pointer.matches || motion.matches) return;
    let cancelled = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const url = `/gallery-scroll/${data.templateId}.webp?v=${SCROLL_VERSION}`;
      const image = new Image();
      image.src = url;
      image.decode().then(() => { if (!cancelled) setSrc(url); }, () => { /* no strip: static cover stays */ });
    }, { rootMargin: '400px' });
    observer.observe(element);
    return () => { cancelled = true; observer.disconnect(); };
  }, [data.templateId]);

  useEffect(() => {
    const element = host.current;
    const image = strip.current;
    const card = element?.closest('a') || element?.parentElement?.parentElement;
    if (!src || !element || !image || !card) return;
    const start = () => {
      const scale = element.clientWidth / BASE_WIDTH;
      const distance = image.offsetHeight - element.clientHeight;
      if (distance <= 0) return;
      image.style.opacity = '1';
      image.style.transition = `transform ${distance / scale / SPEED}s linear`;
      image.style.transform = `translate3d(0, ${-distance}px, 0)`;
    };
    const stop = () => {
      image.style.opacity = '0';
      image.style.transition = 'none';
      image.style.transform = 'translate3d(0, 0, 0)';
    };
    const visibility = () => { if (document.hidden) stop(); };
    card.addEventListener('mouseenter', start);
    card.addEventListener('mouseleave', stop);
    document.addEventListener('visibilitychange', visibility);
    if (card.matches(':hover')) start();
    return () => {
      card.removeEventListener('mouseenter', start);
      card.removeEventListener('mouseleave', stop);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [src]);

  return <div ref={host} data-gallery-preview style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }}>
    <PreviewScale className={className}><LazyMount><TemplatePreview data={data} apiBase={apiBase} /></LazyMount></PreviewScale>
    {src && <img ref={strip} src={src} alt="" aria-hidden="true" decoding="async" draggable={false}
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 'auto', maxWidth: 'none', opacity: 0, willChange: 'transform', pointerEvents: 'none' }} />}
  </div>;
}
