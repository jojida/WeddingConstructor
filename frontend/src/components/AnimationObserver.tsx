'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/* Fade-up для [data-animate]. До гидратации блоки видны как есть: прятать их
   CSS начинает только когда здесь на <html> появится data-anim (см. globals.css).
   Иначе на медленной сети первый экран стоял пустым, пока грузится весь JS,
   а при ошибке скрипта контент не появлялся совсем. */
export default function AnimationObserver() {
  const pathname = usePathname();

  useEffect(() => {
    let observer: IntersectionObserver | null = null;

    // Small delay so the DOM settles after client-side navigation
    const timer = setTimeout(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>('[data-animate]:not(.is-visible)'));

      // То, что уже на экране или выше, показываем сразу — без мигания
      // «видно → спрятано → проявилось» в момент включения анимаций.
      const vh = window.innerHeight;
      const rest = els.filter(el => {
        if (el.getBoundingClientRect().top < vh) { el.classList.add('is-visible'); return false; }
        return true;
      });
      document.documentElement.dataset.anim = '';

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
      );
      rest.forEach(el => observer!.observe(el));
    }, 50);

    return () => { clearTimeout(timer); observer?.disconnect(); };
  }, [pathname]);

  return null;
}
