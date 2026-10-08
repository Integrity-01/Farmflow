import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { HealthResponse } from '@/types';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<HealthResponse>('/health'),
    refetchInterval: 30_000,
    retry: 2,
    staleTime: 15_000,
  });
}