import { pool } from '../database/pool.js';
import type { AuthUser } from '../types/auth.js';
import { roleAtLeast } from '../types/auth.js';

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

function rangeFilter(days: number): string {
  if (!days || days <= 0) return '';
  return ` AND t.created_at >= now() - INTERVAL ${days} DAY`;
}

interface Row {
  [key: string]: unknown;
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

export interface AnalyticsInput {
  rangeDays: number;
}

export const analyticsService = {
  async summary(actor: AuthUser, input: AnalyticsInput) {
    const scope = scopeCondition(actor);
    const scopeOn = scope ? ` AND ${scope}` : '';
    const whereScope = scope ? `WHERE ${scope}` : '';

    const taskWhere = `${whereScope}${rangeFilter(input.rangeDays)}`;

    const [kpis, byStatus, byPriority, byFarm, byCategory, byWorker, upcoming, recent] = await Promise.all([
      pool.query<Row>(`SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN t.status IN ('todo','in_progress') THEN 1 END) AS open,
        COUNT(CASE WHEN t.status = 'finished' THEN 1 END) AS finished,
        COUNT(CASE WHEN t.status <> 'finished' AND t.deadline_at IS NOT NULL AND t.deadline_at < now() THEN 1 END) AS overdue
        FROM tasks t
        ${taskWhere}`),
      pool.query<Row>(`SELECT t.status AS status, COUNT(*) AS count FROM tasks t ${taskWhere} GROUP BY t.status ORDER BY t.status`),
      pool.query<Row>(`SELECT t.priority AS priority, COUNT(*) AS count
        FROM tasks t ${taskWhere}
        GROUP BY t.priority
        ORDER BY CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`),
      pool.query<Row>(`SELECT f.id::text AS id, f.name AS name,
        COUNT(t.id) AS total,
        COUNT(CASE WHEN t.status IN ('todo','in_progress') THEN 1 END) AS open,
        COUNT(CASE WHEN t.status = 'finished' THEN 1 END) AS finished
        FROM farms f
        LEFT JOIN tasks t ON t.farm_id = f.id${scopeOn}
        GROUP BY f.id, f.name
        ORDER BY open DESC, f.name ASC`),
      pool.query<Row>(`SELECT c.id::text AS id, c.name AS name, COUNT(t.id) AS count
        FROM task_categories c
        LEFT JOIN tasks t ON t.category_id = c.id${scopeOn}
        GROUP BY c.id, c.name
        ORDER BY count DESC, c.name ASC`),
      pool.query<Row>(`SELECT w.id::text AS id, w.name AS name,
        COUNT(CASE WHEN t.status IN ('todo','in_progress') THEN 1 END) AS open,
        COUNT(CASE WHEN t.status = 'finished' THEN 1 END) AS finished,
        COUNT(t.id) AS total
        FROM workers w
        LEFT JOIN tasks t ON t.assigned_to = w.id${scopeOn}
        GROUP BY w.id, w.name
        HAVING COUNT(t.id) > 0
        ORDER BY open DESC
        LIMIT 6`),
      pool.query<Row>(`SELECT t.id::text AS id, t.title AS title, t.deadline_at AS deadline_at,
        f.name AS farm_name, w.name AS assignee_name
        FROM tasks t
        LEFT JOIN farms f ON f.id = t.farm_id
        LEFT JOIN workers w ON w.id = t.assigned_to
        ${whereScope ? `${whereScope} AND ` : 'WHERE '}t.status <> 'finished' AND t.deadline_at IS NOT NULL
        ORDER BY t.deadline_at ASC
        LIMIT 5`),
      pool.query<Row>(`SELECT t.id::text AS id, t.title AS title, t.status AS status, t.priority AS priority,
        f.name AS farm_name, w.name AS assignee_name, t.created_at AS created_at
        FROM tasks t
        LEFT JOIN farms f ON f.id = t.farm_id
        LEFT JOIN workers w ON w.id = t.assigned_to
        ${taskWhere}
        ORDER BY t.created_at DESC
        LIMIT 5`),
    ]);

    const kpi = kpis.rows[0] ?? {};
    const total = num(kpi.total);
    const finished = num(kpi.finished);

    return {
      kpis: {
        total,
        open: num(kpi.open),
        finished,
        overdue: num(kpi.overdue),
        completionRate: total > 0 ? Math.round((finished / total) * 100) : 0,
      },
      byStatus: byStatus.rows.map((row) => ({ status: row.status as string, count: num(row.count) })),
      byPriority: byPriority.rows.map((row) => ({ priority: row.priority as string, count: num(row.count) })),
      byFarm: byFarm.rows.map((row) => ({
        id: row.id as string,
        name: row.name as string,
        total: num(row.total),
        open: num(row.open),
        finished: num(row.finished),
      })),
      byCategory: byCategory.rows.map((row) => ({ id: row.id as string, name: row.name as string, count: num(row.count) })),
      topWorkers: byWorker.rows.map((row) => ({
        id: row.id as string,
        name: row.name as string,
        open: num(row.open),
        finished: num(row.finished),
        total: num(row.total),
      })),
      upcomingDeadlines: upcoming.rows.map((row) => ({
        id: row.id as string,
        title: row.title as string,
        deadlineAt: row.deadline_at as string,
        farmName: (row.farm_name as string) ?? null,
        assigneeName: (row.assignee_name as string) ?? null,
      })),
      recentTasks: recent.rows.map((row) => ({
        id: row.id as string,
        title: row.title as string,
        status: row.status as string,
        priority: row.priority as string,
        farmName: (row.farm_name as string) ?? null,
        assigneeName: (row.assignee_name as string) ?? null,
        createdAt: row.created_at as string,
      })),
    };
  },
};