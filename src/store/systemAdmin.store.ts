import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SystemAdminAuthUser } from '@/types/system';

export type SystemAuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface SystemAdminState {
  status: SystemAuthStatus;
  user: SystemAdminAuthUser | null;
  accessToken: string | null;
  setSession: (user: SystemAdminAuthUser, accessToken: string) => void;
  setUser: (user: SystemAdminAuthUser) => void;
  clearSession: () => void;
}

/**
 * A completely separate persisted store from the tenant `farmflow-auth`. This
 * keeps a platform administrator session entirely isolated so it can never be
 * confused with, or leak into, an organization user session.
 */
export const useSystemAdminStore = create<SystemAdminState>()(
  persist(
    (set) => ({
      status: 'loading',
      user: null,
      accessToken: null,
      setSession: (user, accessToken) => set({ status: 'authenticated', user, accessToken }),
      setUser: (user) => set({ user }),
      clearSession: () => set({ status: 'anonymous', user: null, accessToken: null }),
    }),
    {
      name: 'farmflow-system-auth',
      partialize: (state) => ({
        status: state.status,
        user: state.user,
        accessToken: state.accessToken,
      }),
    },
  ),
);
