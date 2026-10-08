import { pool } from '../database/pool.js';
import type { AuthUser } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';

export interface NotificationItem {
  id: string;
  userId: string;
  taskId: string | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  sentAt: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  task_id: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  sent_at: string;
}

function toNotification(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    sentAt: row.sent_at,
  };
}

export const notificationService = {
  async list(actor: AuthUser, query: { unreadOnly: boolean; page: number; pageSize: number }) {
    const conditions = ['user_id = $1'];
    const params: unknown[] = [actor.id];
    if (query.unreadOnly) {
      params.push(false);
      conditions.push(`is_read = $${params.length}`);
    }

    const whereSql = `WHERE ${conditions.join(' AND ')}`;
    const offset = (query.page - 1) * query.pageSize;

    params.push(query.pageSize);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM notifications ${whereSql}`,
      params.slice(0, -2),
    );

    const result = await pool.query<NotificationRow>(
      `SELECT id, user_id, task_id, type, title, message, is_read, sent_at
       FROM notifications
       ${whereSql}
       ORDER BY sent_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );

    return {
      items: result.rows.map(toNotification),
      total: Number(countResult.rows[0].count),
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  async unreadCount(actor: AuthUser): Promise<number> {
    const result = await pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [actor.id],
    );
    return Number(result.rows[0].count);
  },

  async markRead(actor: AuthUser, id: string): Promise<NotificationItem> {
    const result = await pool.query<NotificationRow>(
      `UPDATE notifications
       SET is_read = TRUE, read_at = now()
       WHERE id = $1 AND user_id = $2`,
      [id, actor.id],
    );
    if (result.rowCount === 0) {
      throw new AppError(404, 'This notification could not be found.', 'NOT_FOUND');
    }
    const row = await pool.query<NotificationRow>(
      `SELECT id, user_id, task_id, type, title, message, is_read, sent_at
       FROM notifications WHERE id = $1`,
      [id],
    );
    return toNotification(row.rows[0]);
  },

  async markAllRead(actor: AuthUser): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `UPDATE notifications SET is_read = TRUE, read_at = now()
       WHERE user_id = $1 AND is_read = FALSE`,
      [actor.id],
    );
    return result.rowCount;
  },
};