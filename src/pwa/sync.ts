import { ApiError, api } from '@/services/api';
import { useSyncStore } from '@/store/sync.store';
import {
  countQueue,
  readQueue,
  refreshPendingCount,
  removeQueuedItem,
  type QueuedMutation,
} from './syncQueue';

type FlushListener = (removedCount: number) => void;

const flushListeners = new Set<FlushListener>();
let flushing = false;

export function onQueueFlushed(listener: FlushListener): () => void {
  flushListeners.add(listener);
  return () => {
    flushListeners.delete(listener);
  };
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

const REPLAYERS: Record<QueuedMutation['kind'], (record: QueuedMutation) => Promise<void>> = {
  'task.start': async (record) => {
    await api.post(`/tasks/${encodeURIComponent(record.taskId)}/start`);
  },
  'task.complete': async (record) => {
    await api.post(`/tasks/${encodeURIComponent(record.taskId)}/complete`);
  },
  'task.update': async (record) => {
    const body = record.body as Record<string, unknown>;
    await api.patch(`/tasks/${encodeURIComponent(record.taskId)}`, body);
  },
  'task.comment': async (record) => {
    await api.post(`/tasks/${encodeURIComponent(record.taskId)}/comments`, record.body);
  },
};

export async function flushQueue(): Promise<number> {
  if (flushing || !isOnline()) return 0;

  let removed = 0;
  flushing = true;
  useSyncStore.getState().setSyncing(true);
  try {
    const items = await readQueue();
    if (items.length > 0) {
      for (const item of items) {
        if (!isOnline()) break;

        const replay = REPLAYERS[item.kind];
        if (!replay) {
          await removeQueuedItem(item.uid);
          removed += 1;
          continue;
        }

        try {
          await replay(item);
          await removeQueuedItem(item.uid);
          removed += 1;
        } catch (error) {
          if (error instanceof ApiError) {
            const isNetwork = error.code === 'NETWORK_ERROR';
            const isServerError = error.status >= 500;
            if (isNetwork || isServerError) break;
          }
          await removeQueuedItem(item.uid);
          removed += 1;
        }
      }
    }

    const remaining = await countQueue();
    useSyncStore.getState().setPending(remaining);
    if (remaining === 0) {
      useSyncStore.getState().setLastSyncedAt(new Date().toISOString());
    }
  } catch {
    // Queue is unreadable (e.g. IndexedDB unavailable) — leave the store state
    // as-is; the next poll will retry.
  } finally {
    flushing = false;
    useSyncStore.getState().setSyncing(false);
  }

  if (removed > 0) {
    for (const listener of flushListeners) {
      listener(removed);
    }
  }
  return removed;
}

let started = false;

export function startSyncLoop(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  const poll = () => {
    if (useSyncStore.getState().pending > 0) {
      void flushQueue();
    }
  };

  void refreshPendingCount();
  window.setTimeout(poll, 1_200);
  window.addEventListener('online', poll);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') poll();
  });
  window.setInterval(poll, 60_000);
}