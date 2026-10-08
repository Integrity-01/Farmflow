import { ApiError } from '@/services/api';
import { useSyncStore } from '@/store/sync.store';
import { idbCount, idbDelete, idbGetAll, idbStore } from './db';

export type QueuedKind = 'task.start' | 'task.complete' | 'task.update' | 'task.comment';

export interface QueuedMutation {
  uid: string;
  kind: QueuedKind;
  taskId: string;
  body: unknown;
  createdAt: string;
}

let uidCounter = 0;

function nextUid(): string {
  uidCounter += 1;
  return `q-${Date.now().toString(36)}-${uidCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export class OfflineQueuedError extends ApiError {
  constructor(
    public readonly kind: QueuedKind,
    public readonly taskId: string,
  ) {
    super(
      "You're offline. This change is saved on this device and will upload automatically when you're back online.",
      0,
      'QUEUED',
    );
    this.name = 'OfflineQueuedError';
  }
}

export function isQueuedError(error: unknown): error is OfflineQueuedError {
  return error instanceof OfflineQueuedError;
}

function isNetworkFailure(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'NETWORK_ERROR';
}

export async function enqueueMutation(
  kind: QueuedKind,
  taskId: string,
  body: unknown,
): Promise<void> {
  const record: QueuedMutation = {
    uid: nextUid(),
    kind,
    taskId,
    body,
    createdAt: new Date().toISOString(),
  };
  await idbStore(record);
  await refreshPendingCount();
}

export async function refreshPendingCount(): Promise<void> {
  try {
    const count = await countQueue();
    useSyncStore.getState().setPending(count);
  } catch {
    useSyncStore.getState().setPending(0);
  }
}

export async function readQueue(): Promise<QueuedMutation[]> {
  const items = await idbGetAll<QueuedMutation>();
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeQueuedItem(uid: string): Promise<void> {
  await idbDelete(uid);
}

export async function countQueue(): Promise<number> {
  return idbCount();
}

/**
 * Conflict policy: the server is authoritative for status/progress/deadline
 * (last-write-wins by updated_at). Comments are append-only, so replaying a
 * queued comment can only add it once — duplicates are impossible because a
 * queue item is removed as soon as the server acknowledges it.
 */
export async function offlineGuard<T>(
  kind: QueuedKind,
  taskId: string,
  body: unknown,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isNetworkFailure(error)) {
      await enqueueMutation(kind, taskId, body);
      throw new OfflineQueuedError(kind, taskId);
    }
    throw error;
  }
}

export function isRejectedByServer(error: unknown): boolean {
  return error instanceof ApiError && error.code !== 'NETWORK_ERROR' && error.status < 500;
}