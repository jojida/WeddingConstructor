import { create } from 'zustand';
import api from '@/lib/api';
import { reachGoal, GOAL, muteGoals } from '@/lib/metrika';
import { readAuthToken, writeAuthToken, writeStorage } from '@/lib/browser-storage';

interface User {
  id: string;
  email: string;
  name: string;
  /** тестовый аккаунт владельца: публикация без оплаты, цели не считаются */
  free?: boolean;
  /** раздел «Меню и рассадка» открыт этому аккаунту (сервер проверяет сам) */
  planner?: boolean;
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
    writeAuthToken(token);
    muteGoals(!!user.free);
    reachGoal(GOAL.signup);
    set({ user, token, loading: false });
  },

  logout: () => {
    writeAuthToken(null);
    writeStorage('sessionStorage', 'wc_draft_id', null);
    muteGoals(false);
    set({ user: null, token: null, loading: false });
  },

  fetchMe: async () => {
    const token = typeof window !== 'undefined' ? readAuthToken() : null;
    if (!token) {
      muteGoals(false);
      set({ user: null, token: null, loading: false });
      return;
    }
    try {
      const res = await api.get('/api/auth/me');
      if (readAuthToken() !== token) return;
      muteGoals(!!res.data?.free);
      set({ user: res.data, token, loading: false });
    } catch (error) {
      if (readAuthToken() !== token) return;
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 401 || status === 403) {
        writeAuthToken(null);
        set({ user: null, token: null, loading: false });
      } else {
        set({ token, loading: false });
      }
    }
  },
}));
