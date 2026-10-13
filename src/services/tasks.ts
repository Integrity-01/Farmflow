import { api } from '@/services/api';
import { offlineGuard } from '@/pwa/syncQueue';
import type {
  PagedTasks,
  Task,
  TaskAttachment,
  TaskCategory,
  TaskComment,
  TaskDetail,
  TaskDraft,
  TaskPriority,
  TaskStatus,
  UserRole,
} from '@/types';

export interface TasksQuery {
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  farmId?: string;
  fieldId?: string;
  categoryId?: string;
  assignedTo?: string;
  mine?: boolean;
  overdue?: boolean;
  page?: number;
  pageSize?: number;
}

export const tasksApi = {
  async list(query: TasksQuery = {}): Promise<PagedTasks> {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.status) params.set('status', query.status);
    if (query.priority) params.set('priority', query.priority);
    if (query.farmId) params.set('farmId', query.farmId);
    if (query.fieldId) params.set('fieldId', query.fieldId);
    if (query.categoryId) params.set('categoryId', query.categoryId);
    if (query.assignedTo) params.set('assignedTo', query.assignedTo);
    if (query.mine) params.set('mine', 'true');
    if (query.overdue) params.set('overdue', 'true');
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    const qs = params.toString();
    const result = await api.get<{ data: PagedTasks }>(qs ? `/tasks?${qs}` : `/tasks`);
    return result.data;
  },

  async get(id: string): Promise<TaskDetail> {
    const result = await api.get<{ data: TaskDetail }>(`/tasks/${id}`);
    return result.data;
  },

  async categories(): Promise<TaskCategory[]> {
    const result = await api.get<{ data: TaskCategory[] }>('/categories');
    return result.data;
  },

  async create(input: TaskDraft): Promise<Task> {
    const result = await api.post<{ data: Task }>('/tasks', input);
    return result.data;
  },

  async update(id: string, input: Partial<TaskDraft>): Promise<Task> {
    return offlineGuard('task.update', id, input, () =>
      api.patch<{ data: Task }>(`/tasks/${id}`, input).then((result) => result.data),
    );
  },

  async remove(id: string): Promise<void> {
    await api.delete<void>(`/tasks/${id}`);
  },

  async start(id: string): Promise<Task> {
    return offlineGuard('task.start', id, null, () =>
      api.post<{ data: Task }>(`/tasks/${id}/start`).then((result) => result.data),
    );
  },

  async complete(id: string): Promise<Task> {
    return offlineGuard('task.complete', id, null, () =>
      api.post<{ data: Task }>(`/tasks/${id}/complete`).then((result) => result.data),
    );
  },

  async addComment(id: string, body: string): Promise<TaskComment> {
    return offlineGuard('task.comment', id, { body }, () =>
      api
        .post<{ data: TaskComment }>(`/tasks/${id}/comments`, { body })
        .then((result) => result.data),
    );
  },

  async addAttachment(id: string, file: File): Promise<TaskAttachment> {
    const form = new FormData();
    form.append('file', file);
    const result = await api.form<{ data: TaskAttachment }>(`/tasks/${id}/attachments`, form);
    return result.data;
  },

  async removeAttachment(attachmentId: string): Promise<void> {
    await api.delete<void>(`/tasks/attachments/${attachmentId}`);
  },
};

export function canCreateTasks(role: UserRole | null): boolean {
  return (
    role === 'organization_administrator' || role === 'farm_manager' || role === 'supervisor'
  );
}

export function canMutateTask(role: UserRole | null): boolean {
  return (
    role === 'organization_administrator' || role === 'farm_manager' || role === 'supervisor'
  );
}