import type { QueryClient } from '@tanstack/react-query';
import type { PagedTasks, Task, TaskComment, TaskDetail } from '@/types';

/**
 * Applies an optimistic change to every cached view of a task so the UI
 * reflects a mutation that was queued offline. The server is authoritative;
 * the next successful sync refetches and replaces these values.
 */
export function patchTaskInCache(
  queryClient: QueryClient,
  taskId: string,
  patch: (task: Task) => Partial<Task>,
): void {
  queryClient.setQueriesData<TaskDetail>({ queryKey: ['task', taskId] }, (old) =>
    old ? { ...old, ...patch(old) } : old,
  );
  queryClient.setQueriesData<PagedTasks>({ queryKey: ['tasks'] }, (old) =>
    old
      ? {
          ...old,
          items: old.items.map((item) =>
            item.id === taskId ? { ...item, ...patch(item) } : item,
          ),
        }
      : old,
  );
}

export interface OfflineCommentInput {
  body: string;
  userId: string | null;
  userName: string | null;
}

export function appendOfflineComment(
  queryClient: QueryClient,
  taskId: string,
  input: OfflineCommentInput,
): void {
  const comment: TaskComment = {
    id: `pending-${Date.now().toString(36)}`,
    taskId,
    userId: input.userId,
    userName: input.userName,
    body: input.body,
    createdAt: new Date().toISOString(),
  };
  queryClient.setQueriesData<TaskDetail>({ queryKey: ['task', taskId] }, (old) =>
    old ? { ...old, comments: [...old.comments, comment] } : old,
  );
}