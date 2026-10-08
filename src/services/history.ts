import { api } from '@/services/api';
import type { HistoryFiltersInput, PagedHistory } from '@/types';

export const historyApi = {
  async list(filters: HistoryFiltersInput): Promise<PagedHistory> {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.action) params.set('action', filters.action);
    if (filters.farmId) params.set('farmId', filters.farmId);
    params.set('page', String(filters.page));
    params.set('pageSize', String(filters.pageSize));
    const qs = params.toString();
    const result = await api.get<{ data: PagedHistory }>(`/history${qs ? `?${qs}` : ''}`);
    return result.data;
  },
};