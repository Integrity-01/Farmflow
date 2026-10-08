import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  setSession: (user: AuthUser, accessToken: string) => void;
  setUser: (user: AuthUser) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      status: 'loading',
      user: null,
      accessToken: null,
      setSession: (user, accessToken) =>
        set({ status: 'authenticated', user, accessToken }),
      setUser: (user) => set({ user }),
      clearSession: () => set({ status: 'anonymous', user: null, accessToken: null }),
    }),
    {
      name: 'farmflow-auth',
      partialize: (state) => ({
        status: state.status,
        user: state.user,
        accessToken: state.accessToken,
      }),
    },
  ),
);
