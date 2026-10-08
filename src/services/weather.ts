import { api } from '@/services/api';
import type { FarmWeatherResponse } from '@/types';

export const weatherApi = {
  async get(farmId: string): Promise<FarmWeatherResponse> {
    return api.get<FarmWeatherResponse>(`/weather/${farmId}`);
  },
};