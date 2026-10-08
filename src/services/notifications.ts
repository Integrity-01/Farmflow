import { api } from '@/services/api';
import type { NotificationItem, PagedNotifications } from '@/types';

export interface NotificationsQuery {
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export const notificationsApi = {
  async list(query: NotificationsQuery = {}): Promise<PagedNotifications> {
    const params = new URLSearchParams();
    if (query.unreadOnly) params.set('unreadOnly', 'true');
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    const qs = params.toString();
    const result = await api.get<{ data: PagedNotifications }>(qs ? `/notifications?${qs}` : `/notifications`);
    return result.data;
  },

  async unreadCount(): Promise<number> {
    const result = await api.get<{ data: { count: number } }>('/notifications/unread-count');
    return result.data.count;
  },

  async markRead(id: string): Promise<NotificationItem> {
    const result = await api.patch<{ data: NotificationItem }>(`/notifications/${id}/read`);
    return result.data;
  },

  async markAllRead(): Promise<number> {
    const result = await api.post<{ data: { count: number } }>('/notifications/read-all');
    return result.data.count;
  },
};