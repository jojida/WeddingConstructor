'use client';
import { useEffect, useRef, useState } from 'react';

/* Монтирует детей, только когда контейнер приблизился к вьюпорту.
   Нужен для тяжёлых превью шаблонов (iframe + анимации): без него лендинг
   монтирует все приглашения разом и заметно тормозит на мобильных. */
export default function LazyMount({ children, rootMargin = '600px', placeholder }: {
  children: React.ReactNode;
  rootMargin?: string;
  placeholder?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || show) return;
    if (typeof IntersectionObserver === 'undefined') { setShow(true); return; }
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShow(true); obs.disconnect(); }
    }, { rootMargin });
    obs.observe(el);
    return () => obs.disconnect();
  }, [show, rootMargin]);

  return <div ref={ref} style={{ width: '100%', height: '100%' }}>{show ? children : (placeholder ?? null)}</div>;
}
