import { api } from '@/services/api';
import type { PagedWorkers, UserRole, Worker, WorkerDraft, WorkerStatus } from '@/types';

export interface WorkersQuery {
  search?: string;
  status?: WorkerStatus;
  farmId?: string;
  page?: number;
  pageSize?: number;
}

export const workersApi = {
  async list(query: WorkersQuery = {}): Promise<PagedWorkers> {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.status) params.set('status', query.status);
    if (query.farmId) params.set('farmId', query.farmId);
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    const qs = params.toString();
    const result = await api.get<{ data: PagedWorkers }>(qs ? `/workers?${qs}` : `/workers`);
    return result.data;
  },

  async get(id: string): Promise<Worker> {
    const result = await api.get<{ data: Worker }>(`/workers/${id}`);
    return result.data;
  },

  async create(input: WorkerDraft): Promise<Worker> {
    const result = await api.post<{ data: Worker }>('/workers', input);
    return result.data;
  },

  async update(id: string, input: Partial<WorkerDraft>): Promise<Worker> {
    const result = await api.patch<{ data: Worker }>(`/workers/${id}`, input);
    return result.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete<void>(`/workers/${id}`);
  },
};

export function canManageWorkers(role: UserRole | null): boolean {
  return role === 'organization_administrator' || role === 'farm_manager';
}