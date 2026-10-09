import { api } from '@/services/api';
import type { WhatsAppInvite, WhatsAppStatus } from '@/types';

export const whatsappApi = {
  async status(): Promise<WhatsAppStatus> {
    const result = await api.get<{ data: WhatsAppStatus }>('/whatsapp/status');
    return result.data;
  },

  async generateInvite(): Promise<WhatsAppInvite> {
    const result = await api.post<{ data: WhatsAppInvite }>('/whatsapp/invite');
    return result.data;
  },

  async revoke(): Promise<void> {
    await api.post<{ data: { revoked: boolean } }>('/whatsapp/revoke');
  },
};