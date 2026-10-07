'use client';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { resetAuthTokenCache } from '@/lib/browser-storage';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const fetchMe = useAuthStore(s => s.fetchMe);

  useEffect(() => {
    fetchMe();
    const syncSession = (event: StorageEvent) => {
      if (event.key !== 'wc_token' && event.key !== null) return;
      resetAuthTokenCache();
      void fetchMe();
    };
    window.addEventListener('storage', syncSession);
    return () => window.removeEventListener('storage', syncSession);
  }, [fetchMe]);

  return <>{children}</>;
}
