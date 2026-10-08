import { api } from '@/services/api';
import type { AnalyticsSummary } from '@/types';

export const analyticsApi = {
  async summary(rangeDays: number): Promise<AnalyticsSummary> {
    const result = await api.get<{ data: AnalyticsSummary }>(
      `/analytics?rangeDays=${rangeDays}`,
    );
    return result.data;
  },
};