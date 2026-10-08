import { create } from 'zustand';

interface AppState {
  sidebarCollapsed: boolean;
  isOnline: boolean;
  toggleSidebar: () => void;
  setOnline: (isOnline: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setOnline: (isOnline) => set({ isOnline }),
}));