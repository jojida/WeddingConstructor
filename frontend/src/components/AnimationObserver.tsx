'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function AnimationObserver() {
  const pathname = usePathname();

  useEffect(() => {
    // Small delay so the DOM settles after client-side navigation
    const timer = setTimeout(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
      );

      document.querySelectorAll('[data-animate]').forEach((el) => {
        el.classList.remove('is-visible');
        observer.observe(el);
      });

      return () => observer.disconnect();
    }, 50);

    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
