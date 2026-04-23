import { create } from 'zustand';
import api from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,

  setAuth: (user, token) => {
    localStorage.setItem('wc_token', token);
    set({ user, token, loading: false });
  },

  logout: () => {
    localStorage.removeItem('wc_token');
    set({ user: null, token: null, loading: false });
  },

  fetchMe: async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('wc_token') : null;
    if (!token) {
      set({ loading: false });
      return;
    }
    try {
      const res = await api.get('/api/auth/me');
      set({ user: res.data, token, loading: false });
    } catch {
      localStorage.removeItem('wc_token');
      set({ user: null, token: null, loading: false });
    }
  },
}));
