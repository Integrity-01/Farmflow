import { create } from 'zustand';

interface AppState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  isOnline: boolean;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
  toggleMobileNav: () => void;
  setOnline: (isOnline: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  mobileNavOpen: false,
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  toggleMobileNav: () => set((state) => ({ mobileNavOpen: !state.mobileNavOpen })),
  setOnline: (isOnline) => set({ isOnline }),
}));