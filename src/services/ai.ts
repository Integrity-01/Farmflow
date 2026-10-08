import { api } from '@/services/api';
import type { AiChatMessage, AiSuggestionsResponse, AiStatusResponse } from '@/types';

export const aiApi = {
  async status(): Promise<AiStatusResponse> {
    return api.get<AiStatusResponse>('/ai/status');
  },

  async chat(message: string, history: AiChatMessage[] = []): Promise<{ reply: string }> {
    return api.post<{ reply: string }>('/ai/chat', { message, history });
  },

  async suggest(farmId?: string): Promise<AiSuggestionsResponse> {
    return api.post<AiSuggestionsResponse>('/ai/suggest', farmId ? { farmId } : {});
  },
};