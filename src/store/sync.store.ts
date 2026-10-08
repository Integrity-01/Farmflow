import { create } from 'zustand';

interface SyncState {
  pending: number;
  syncing: boolean;
  lastSyncedAt: string | null;
  setPending: (pending: number) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncedAt: (at: string) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  pending: 0,
  syncing: false,
  lastSyncedAt: null,
  setPending: (pending) => set({ pending }),
  setSyncing: (syncing) => set({ syncing }),
  setLastSyncedAt: (at) => set({ lastSyncedAt: at }),
}));