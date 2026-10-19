'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { rememberPromoFromUrl } from '@/lib/promo-link';

/** Запоминает код из партнёрской ссылки ?promo=КОД (lib/promo-link.ts). */
export default function PromoFromUrl() {
  const pathname = usePathname();
  useEffect(() => { rememberPromoFromUrl(window.location.search); }, [pathname]);
  return null;
}
