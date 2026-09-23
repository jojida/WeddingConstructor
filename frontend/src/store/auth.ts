import { create } from 'zustand';
import api from '@/lib/api';
import { reachGoal, GOAL, muteGoals } from '@/lib/metrika';

interface User {
  id: string;
  email: string;
  name: string;
  /** тестовый аккаунт владельца: публикация без оплаты, цели не считаются */
  free?: boolean;
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
    muteGoals(!!user.free);
    reachGoal(GOAL.signup);
    set({ user, token, loading: false });
  },

  logout: () => {
    localStorage.removeItem('wc_token');
    muteGoals(false);
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
      muteGoals(!!res.data?.free);
      set({ user: res.data, token, loading: false });
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('wc_token');
        set({ user: null, token: null, loading: false });
      } else {
        set({ token, loading: false });
      }
    }
  },
}));
