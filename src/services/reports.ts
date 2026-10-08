import { api } from '@/services/api';
import type { PagedReports, ReportFiltersInput, ReportItem, ReportType } from '@/types';

export interface ReportCreateInput {
  reportType: ReportType;
  format?: 'csv';
  filters?: ReportFiltersInput;
}

export const reportsApi = {
  async list(page: number, pageSize = 10): Promise<PagedReports> {
    const result = await api.get<{ data: PagedReports }>(
      `/reports?page=${page}&pageSize=${pageSize}`,
    );
    return result.data;
  },

  async create(input: ReportCreateInput): Promise<ReportItem> {
    const result = await api.post<{ data: ReportItem }>('/reports', input);
    return result.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/reports/${id}`);
  },
};