import { pool } from '../database/pool.js';
import type { AuthUser } from '../types/auth.js';
import { roleAtLeast } from '../types/auth.js';

export interface HistoryFilters {
  search?: string;
  action?: string;
  farmId?: string;
  page: number;
  pageSize: number;
}

const HISTORY_ACTIONS = new Set([
  'created', 'updated', 'status_changed', 'assigned', 'started',
  'completed', 'reopened', 'progress_changed', 'deadline_changed',
  'priority_changed', 'comment_added', 'attachment_added', 'attachment_removed',
]);

function scopeCondition(actor: AuthUser): string {
  if (roleAtLeast(actor.role, 'farm_manager')) return '';
  if (actor.role === 'supervisor') {
    return `t.farm_id IN (
      SELECT farm_id FROM farms WHERE manager_id = '${actor.id}'
      UNION
      SELECT farm_id FROM workers WHERE user_id = '${actor.id}')`;
  }
  return `t.assigned_to = (SELECT id FROM workers WHERE user_id = '${actor.id}')`;
}

interface HistoryRow {
  id: string;
  task_id: string;
  task_title: string;
  actor_name: string | null;
  action: string;
  old_value: unknown;
  new_value: unknown;
  metadata: unknown;
  created_at: string;
}

export const historyService = {
  async list(actor: AuthUser, filters: HistoryFilters) {
    const whereParts: string[] = [];
    const params: unknown[] = [];

    const scope = scopeCondition(actor);
    if (scope) whereParts.push(scope);

    if (filters.search) {
      whereParts.push(`t.title ILIKE $${params.length + 1}`);
      params.push(`%${filters.search}%`);
    }
    if (filters.farmId) {
      whereParts.push(`t.farm_id = $${params.length + 1}`);
      params.push(filters.farmId);
    }
    if (filters.action && HISTORY_ACTIONS.has(filters.action)) {
      whereParts.push(`h.action = $${params.length + 1}`);
      params.push(filters.action);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    params.push(filters.pageSize);
    const limitParam = params.length;
    params.push((filters.page - 1) * filters.pageSize);
    const offsetParam = params.length;

    const countParams = params.slice(0, -2);
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM task_history h
       JOIN tasks t ON t.id = h.task_id
       ${whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''}`,
      countParams,
    );

    const result = await pool.query<HistoryRow>(
      `SELECT h.id, h.task_id::text AS task_id, t.title AS task_title,
              u.name AS actor_name, h.action, h.old_value, h.new_value,
              h.metadata, h.created_at
       FROM task_history h
       JOIN tasks t ON t.id = h.task_id
       LEFT JOIN users u ON u.id = h.user_id
       ${whereSql}
       ORDER BY h.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        taskId: row.task_id,
        taskTitle: row.task_title,
        actorName: row.actor_name,
        action: row.action,
        oldValue: row.old_value,
        newValue: row.new_value,
        metadata: row.metadata,
        createdAt: row.created_at,
      })),
      total: Number(countResult.rows[0].count),
      page: filters.page,
      pageSize: filters.pageSize,
    };
  },
};