import { api } from '@/services/api';
import type { RecurringTask, RecurringTaskDraft } from '@/types';

export interface RecurringGenerateResult {
  rule: RecurringTask;
  task: { id: string; title: string } | null;
  skipped: boolean;
}

const unwrapList = (result: { data: RecurringTask[] }): RecurringTask[] => result.data;

export const recurringTasksApi = {
  async list(): Promise<RecurringTask[]> {
    const result = await api.get<{ data: RecurringTask[] }>('/recurring-tasks');
    return unwrapList(result);
  },

  async get(id: string): Promise<RecurringTask> {
    const result = await api.get<{ data: RecurringTask }>(`/recurring-tasks/${id}`);
    return result.data;
  },

  async create(input: RecurringTaskDraft): Promise<RecurringTask> {
    const result = await api.post<{ data: RecurringTask }>('/recurring-tasks', input);
    return result.data;
  },

  async update(id: string, input: Partial<RecurringTaskDraft>): Promise<RecurringTask> {
    const result = await api.patch<{ data: RecurringTask }>(`/recurring-tasks/${id}`, input);
    return result.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete<void>(`/recurring-tasks/${id}`);
  },

  async activate(id: string): Promise<RecurringTask> {
    const result = await api.post<{ data: RecurringTask }>(`/recurring-tasks/${id}/activate`);
    return result.data;
  },

  async pause(id: string): Promise<RecurringTask> {
    const result = await api.post<{ data: RecurringTask }>(`/recurring-tasks/${id}/pause`);
    return result.data;
  },

  async skipNext(id: string): Promise<RecurringTask> {
    const result = await api.post<{ data: RecurringTask }>(`/recurring-tasks/${id}/skip-next`);
    return result.data;
  },

  async generate(id: string): Promise<RecurringGenerateResult> {
    const result = await api.post<{ data: RecurringGenerateResult }>(`/recurring-tasks/${id}/generate`);
    return result.data;
  },
};