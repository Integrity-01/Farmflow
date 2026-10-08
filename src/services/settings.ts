import { api } from '@/services/api';
import type {
  AuthUser,
  ChangePasswordInput,
  NotificationPrefs,
  ProfileUpdateInput,
} from '@/types';

export const settingsApi = {
  async updateProfile(input: ProfileUpdateInput): Promise<AuthUser> {
    const result = await api.patch<{ data: AuthUser }>('/settings/profile', input);
    return result.data;
  },

  async getNotificationPrefs(): Promise<NotificationPrefs> {
    const result = await api.get<{ data: NotificationPrefs }>('/settings/notifications');
    return result.data;
  },

  async updateNotificationPrefs(input: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
    const result = await api.patch<{ data: NotificationPrefs }>('/settings/notifications', input);
    return result.data;
  },

  async changePassword(input: ChangePasswordInput): Promise<void> {
    await api.post<{ data: null }>('/settings/change-password', input);
  },
};