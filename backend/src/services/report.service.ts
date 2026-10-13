import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pool, uid } from '../database/pool.js';
import type { AuthUser } from '../types/auth.js';
import { roleAtLeast } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';

export const REPORTS_DIR = path.join(process.cwd(), 'reports');

export function ensureReportsDir(): void {
  fs.mkdir(REPORTS_DIR, { recursive: true });
}

function taskScope(actor: AuthUser): string {
  if (roleAtLeast(actor.role, 'farm_manager')) return '';
  if (actor.role === 'supervisor') {
    return `t.farm_id IN (
      SELECT farm_id FROM farms WHERE manager_id = '${actor.id}'
      UNION
      SELECT farm_id FROM workers WHERE user_id = '${actor.id}')`;
  }
  return `t.assigned_to = (SELECT id FROM workers WHERE user_id = '${actor.id}')`;
}

function workerOrFarmScope(actor: AuthUser, key: string): string {
  if (roleAtLeast(actor.role, 'farm_manager')) return '';
  if (actor.role === 'supervisor') {
    return `${key} IN (
      SELECT farm_id FROM farms WHERE manager_id = '${actor.id}'
      UNION
      SELECT farm_id FROM workers WHERE user_id = '${actor.id}')`;
  }
  return `${key} = (SELECT ${key} FROM workers WHERE user_id = '${actor.id}')`;
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  return lines.join('\r\n');
}

function dateSql(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function rangeFilterSql(days: number | undefined): string {
  if (!days || days <= 0) return '';
  return `t.created_at >= now() - INTERVAL ${days} DAY`;
}

export interface ReportFilters {
  farmId?: string;
  status?: string;
  rangeDays?: number;
}

export interface ReportItem {
  id: string;
  createdBy: string | null;
  reportType: string;
  format: string;
  status: string;
  fileUrl: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface ReportRow {
  id: string;
  created_by: string | null;
  report_type: string;
  format: string;
  status: string;
  file_url: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

function toReport(row: ReportRow): ReportItem {
  return {
    id: row.id,
    createdBy: row.created_by,
    reportType: row.report_type,
    format: row.format,
    status: row.status,
    fileUrl: row.file_url,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

async function buildCsv(actor: AuthUser, reportType: string, filters: ReportFilters): Promise<string> {
  const scope = taskScope(actor);

  if (reportType === 'tasks') {
    const whereClauses: string[] = [];
    if (scope) whereClauses.push(scope);
    if (filters.rangeDays && filters.rangeDays > 0) whereClauses.push(rangeFilterSql(filters.rangeDays));
    if (filters.farmId) whereClauses.push('t.farm_id = $1');
    if (filters.status) whereClauses.push('t.status = $2');
    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const params = filters.farmId
      ? [filters.farmId, ...(filters.status ? [filters.status] : [])]
      : filters.status
        ? [filters.status]
        : [];

    const result = await pool.query<{
      id: string; title: string; status: string; priority: string; progress: number;
      farm_name: string | null; field_name: string | null; assignee_name: string | null;
      category_name: string | null; start_at: string | null; deadline_at: string | null;
      completed_at: string | null; created_at: string;
    }>(
      `SELECT t.id::text AS id, t.title, t.status, t.priority, t.progress,
        f.name AS farm_name, fl.name AS field_name, w.name AS assignee_name,
        c.name AS category_name, t.start_at, t.deadline_at, t.completed_at, t.created_at
       FROM tasks t
       LEFT JOIN farms f ON f.id = t.farm_id
       LEFT JOIN fields fl ON fl.id = t.field_id
       LEFT JOIN workers w ON w.id = t.assigned_to
       LEFT JOIN task_categories c ON c.id = t.category_id
       ${whereSql}
       ORDER BY t.created_at DESC`,
      params,
    );
    return toCsv(
      ['ID', 'Title', 'Status', 'Priority', 'Progress (%)', 'Farm', 'Field', 'Assignee', 'Category', 'Started', 'Deadline', 'Completed', 'Created'],
      result.rows.map((row) => [
        row.id, row.title, row.status, row.priority, row.progress, row.farm_name, row.field_name,
        row.assignee_name, row.category_name, dateSql(row.start_at), dateSql(row.deadline_at),
        dateSql(row.completed_at), dateSql(row.created_at),
      ]),
    );
  }

  const wScope = workerOrFarmScope(actor, 'w.farm_id');
  const wScopeOn = wScope ? ` AND ${wScope}` : '';
  if (reportType === 'workers') {
    const result = await pool.query<{
      id: string; name: string; role: string | null; phone: string | null; email: string | null;
      farm_name: string | null; field_name: string | null; status: string; skills: string[] | null;
      joined_at: string; open_tasks: number; total_tasks: number; created_at: string;
    }>(
      `SELECT w.id::text AS id, w.name, w.role, w.phone, w.email,
        f.name AS farm_name, fl.name AS field_name, w.status, w.skills,
        w.joined_at,
        (SELECT COUNT(*) FROM tasks t2 WHERE t2.assigned_to = w.id AND t2.status <> 'finished') AS open_tasks,
        (SELECT COUNT(*) FROM tasks t2 WHERE t2.assigned_to = w.id) AS total_tasks,
        w.created_at
       FROM workers w
       LEFT JOIN farms f ON f.id = w.farm_id
       LEFT JOIN fields fl ON fl.id = w.field_id
       ${wScope ? `WHERE ${wScopeOn.substring(5)}` : ''}
       ORDER BY w.created_at DESC`,
    );
    return toCsv(
      ['ID', 'Name', 'Position', 'Phone', 'Email', 'Farm', 'Field', 'Status', 'Skills', 'Joined', 'Open tasks', 'Total tasks'],
      result.rows.map((row) => [
        row.id, row.name, row.role, row.phone, row.email, row.farm_name, row.field_name, row.status,
        (row.skills ?? []).join('; '), row.joined_at, row.open_tasks, row.total_tasks,
      ]),
    );
  }

  const fScope = workerOrFarmScope(actor, 'f.id');
  const fScopeOn = fScope ? ` AND ${fScope}` : '';
  const result = await pool.query<{
    id: string; name: string; location: string | null; size: string | null; size_unit: string;
    status: string; manager_name: string | null; fields: number; workers: number; tasks: number;
  }>(
    `SELECT f.id::text AS id, f.name, f.location, f.size, f.size_unit, f.status,
      u.name AS manager_name,
      (SELECT COUNT(*) FROM fields fi WHERE fi.farm_id = f.id) AS fields,
      (SELECT COUNT(*) FROM workers wi WHERE wi.farm_id = f.id) AS workers,
      (SELECT COUNT(*) FROM tasks ti WHERE ti.farm_id = f.id) AS tasks
     FROM farms f
     LEFT JOIN users u ON u.id = f.manager_id
     ${fScope ? `WHERE ${fScopeOn.substring(5)}` : ''}
     ORDER BY f.name ASC`,
  );
  return toCsv(
    ['ID', 'Name', 'Location', 'Size', 'Unit', 'Status', 'Manager', 'Fields', 'Workers', 'Tasks'],
    result.rows.map((row) => [
      row.id, row.name, row.location, row.size, row.size_unit, row.status, row.manager_name,
      row.fields, row.workers, row.tasks,
    ]),
  );
}

export const reportService = {
  async list(actor: AuthUser, query: { page: number; pageSize: number }) {
    const isAdmin = actor.role === 'organization_administrator';
    const conditions = isAdmin ? [] : ['created_by = $1'];
    const params: unknown[] = isAdmin ? [] : [actor.id];
    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (query.page - 1) * query.pageSize;
    params.push(query.pageSize);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM reports ${whereSql}`,
      params.slice(0, -2),
    );
    const result = await pool.query<ReportRow>(
      `SELECT id, created_by, report_type, format, status, file_url, error_message, started_at, completed_at
       FROM reports ${whereSql}
       ORDER BY started_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );
    return {
      items: result.rows.map(toReport),
      total: Number(countResult.rows[0].count),
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  async create(actor: AuthUser, input: { reportType: string; format: string; filters?: ReportFilters }): Promise<ReportItem> {
    const type = input.reportType;
    if (!['tasks', 'workers', 'farms'].includes(type)) {
      throw new AppError(400, 'Please choose a valid report type.', 'VALIDATION_ERROR');
    }
    if (input.format !== 'csv') {
      throw new AppError(400, 'Only CSV reports are currently supported.', 'VALIDATION_ERROR');
    }

    const startedAt = new Date().toISOString();
    const filters = JSON.stringify(input.filters ?? {});
    let csv: string;
    try {
      csv = await buildCsv(actor, type, input.filters ?? {});
    } catch (error) {
      const reportId = uid();
      await pool.query(
        `INSERT INTO reports (id, created_by, report_type, filters, format, status, error_message, started_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, 'failed', $6, $7, now())`,
        [reportId, actor.id, type, filters, 'csv', (error as Error).message, startedAt],
      );
      const inserted = await pool.query<ReportRow>(
        `SELECT id, created_by, report_type, format, status, file_url, error_message, started_at, completed_at
         FROM reports WHERE id = $1`,
        [reportId],
      );
      return toReport(inserted.rows[0]);
    }

    const fileName = `report-${crypto.randomUUID()}.csv`;
    const fileUrl = `/reports/${fileName}`;
    await fs.writeFile(path.join(REPORTS_DIR, fileName), csv, 'utf8');

    const reportId = uid();
    await pool.query(
      `INSERT INTO reports (id, created_by, report_type, filters, format, status, file_url, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, now())`,
      [reportId, actor.id, type, filters, 'csv', fileUrl, startedAt],
    );
    const result = await pool.query<ReportRow>(
      `SELECT id, created_by, report_type, format, status, file_url, error_message, started_at, completed_at
       FROM reports WHERE id = $1`,
      [reportId],
    );
    return toReport(result.rows[0]);
  },

  async remove(actor: AuthUser, id: string): Promise<void> {
    const result = await pool.query<{ id: string; file_url: string | null; created_by: string | null }>(
      'SELECT id, file_url, created_by FROM reports WHERE id = $1',
      [id],
    );
    if (result.rows.length === 0) {
      throw new AppError(404, 'This report could not be found.', 'NOT_FOUND');
    }
    const report = result.rows[0];
    if (actor.role !== 'organization_administrator' && report.created_by !== actor.id) {
      throw new AppError(403, "You can only delete your own reports.", 'FORBIDDEN');
    }
    await pool.query('DELETE FROM reports WHERE id = $1', [id]);
    if (report.file_url) {
      const fileName = report.file_url.replace(/^\/reports\//, '');
      await fs.unlink(path.join(REPORTS_DIR, fileName)).catch(() => undefined);
    }
  },
};