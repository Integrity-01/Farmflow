import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { getHealth } from './health.service.js';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface CountRow {
  n: number | string;
}

function num(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function clampPage(page: number | undefined): number {
  return Number.isFinite(page) && (page as number) > 0 ? Math.floor(page as number) : 1;
}

function clampPageSize(size: number | undefined): number {
  const value = Number.isFinite(size) ? Math.floor(size as number) : 20;
  return Math.min(Math.max(value, 1), 100);
}

function paginate<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
  };
}

const ORG_SORT_COLUMNS: Record<string, string> = {
  created_at: 'o.created_at',
  name: 'o.name',
  status: 'o.status',
  member_count: 'member_count',
  farm_count: 'farm_count',
  task_count: 'task_count',
};

const USER_SORT_COLUMNS: Record<string, string> = {
  created_at: 'u.created_at',
  name: 'u.name',
  email: 'u.email',
  last_login_at: 'u.last_login_at',
};

export interface OverviewStats {
  organizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  pendingOrganizations: number;
  users: number;
  activeUsers: number;
  farms: number;
  fields: number;
  tasks: number;
  workers: number;
  organizationsThisMonth: number;
  usersThisMonth: number;
}

export interface TaskStatusBreakdown {
  todo: number;
  inProgress: number;
  finished: number;
  completionRate: number;
}

export interface ActivityItem {
  id: string;
  action: string;
  actorType: string;
  actorName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface OrgSummaryItem {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  farmCount: number;
  taskCount: number;
  ownerName: string | null;
  createdAt: string;
}

export interface OrgListItem extends OrgSummaryItem {
  verificationStatus: string;
  country: string | null;
}

export interface OrgMemberItem {
  userId: string;
  name: string;
  email: string;
  role: string;
  roleName: string;
  status: string;
  joinedAt: string | null;
}

export interface OrgDetail {
  id: string;
  name: string;
  status: string;
  verificationStatus: string;
  country: string | null;
  contactEmail: string | null;
  website: string | null;
  currency: string;
  timezone: string;
  logoUrl: string | null;
  createdAt: string;
  counts: {
    members: number;
    farms: number;
    fields: number;
    tasks: number;
    workers: number;
  };
  taskStatus: TaskStatusBreakdown;
  members: OrgMemberItem[];
  recentActivity: ActivityItem[];
}

export interface GlobalUserItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  membershipCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface GlobalUserDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    organizationStatus: string;
    role: string;
    roleName: string;
    status: string;
    joinedAt: string | null;
  }>;
}

export interface AnalyticsSeriesPoint {
  date: string;
  organizations: number;
  users: number;
  tasks: number;
}

export interface AnalyticsRange {
  from: string;
  to: string;
  days: number;
}

export interface AnalyticsResult {
  range: AnalyticsRange;
  series: AnalyticsSeriesPoint[];
  totals: {
    organizations: number;
    users: number;
    tasks: number;
    tasksFinished: number;
  };
  organizationStatus: { active: number; suspended: number; pending: number };
  taskStatus: TaskStatusBreakdown;
}

interface AuditRow {
  id: string;
  action: string;
  actor_type: string;
  actor_user_id: string | null;
  actor_admin_id: string | null;
  organization_id: string | null;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  metadata: unknown;
  created_at: Date | string;
  actor_user_name: string | null;
  actor_admin_name: string | null;
  organization_name: string | null;
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapActivity(row: AuditRow): ActivityItem {
  return {
    id: row.id,
    action: row.action,
    actorType: row.actor_type,
    actorName: row.actor_admin_name ?? row.actor_user_name ?? null,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    targetType: row.target_type,
    targetId: row.target_id,
    ip: row.ip,
    metadata: row.metadata,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

const ACTIVITY_SELECT = `
  SELECT a.id, a.action, a.actor_type, a.actor_user_id, a.actor_admin_id, a.organization_id,
         a.target_type, a.target_id, a.ip, a.metadata, a.created_at,
         u.name AS actor_user_name, sa.name AS actor_admin_name, o.name AS organization_name
  FROM audit_logs a
  LEFT JOIN users u ON u.id = a.actor_user_id
  LEFT JOIN system_administrators sa ON sa.id = a.actor_admin_id
  LEFT JOIN organizations o ON o.id = a.organization_id
`;

async function taskStatusFor(orgId?: string): Promise<TaskStatusBreakdown> {
  const where = orgId ? 'WHERE organization_id = $1' : '';
  const params = orgId ? [orgId] : [];
  const res = await pool.query<{
    todo: number | string;
    in_progress: number | string;
    finished: number | string;
    total: number | string;
  }>(
    `SELECT
       SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) AS todo,
       SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
       SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) AS finished,
       COUNT(*) AS total
     FROM tasks ${where}`,
    params,
  );
  const row = res.rows[0];
  const todo = num(row?.todo);
  const inProgress = num(row?.in_progress);
  const finished = num(row?.finished);
  const total = num(row?.total);
  return {
    todo,
    inProgress,
    finished,
    completionRate: total > 0 ? Math.round((finished / total) * 1000) / 10 : 0,
  };
}

export const systemService = {
  async getOverview(): Promise<{
    stats: OverviewStats;
    taskStatus: TaskStatusBreakdown;
    recentOrganizations: OrgSummaryItem[];
    topOrganizations: Array<Pick<OrgSummaryItem, 'id' | 'name' | 'status' | 'memberCount'>>;
    recentActivity: ActivityItem[];
  }> {
    const statsRes = await pool.query<{
      organizations: number | string;
      active_organizations: number | string;
      suspended_organizations: number | string;
      pending_organizations: number | string;
      users: number | string;
      active_users: number | string;
      farms: number | string;
      fields: number | string;
      tasks: number | string;
      workers: number | string;
      organizations_this_month: number | string;
      users_this_month: number | string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM organizations) AS organizations,
         (SELECT COUNT(*) FROM organizations WHERE status = 'active') AS active_organizations,
         (SELECT COUNT(*) FROM organizations WHERE status = 'suspended') AS suspended_organizations,
         (SELECT COUNT(*) FROM organizations WHERE status = 'pending') AS pending_organizations,
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM users WHERE is_active = 1) AS active_users,
         (SELECT COUNT(*) FROM farms) AS farms,
         (SELECT COUNT(*) FROM fields) AS fields,
         (SELECT COUNT(*) FROM tasks) AS tasks,
         (SELECT COUNT(*) FROM workers) AS workers,
         (SELECT COUNT(*) FROM organizations WHERE created_at >= DATE_FORMAT(now(), '%Y-%m-01')) AS organizations_this_month,
         (SELECT COUNT(*) FROM users WHERE created_at >= DATE_FORMAT(now(), '%Y-%m-01')) AS users_this_month`,
    );
    const s = statsRes.rows[0];

    const recentOrgsRes = await pool.query<{
      id: string;
      name: string;
      status: string;
      created_at: Date | string;
      member_count: number | string;
    }>(
      `SELECT o.id, o.name, o.status, o.created_at,
              (SELECT COUNT(*) FROM organization_memberships m WHERE m.organization_id = o.id) AS member_count
       FROM organizations o
       ORDER BY o.created_at DESC
       LIMIT 5`,
    );

    const topOrgsRes = await pool.query<{
      id: string;
      name: string;
      status: string;
      member_count: number | string;
    }>(
      `SELECT o.id, o.name, o.status, COUNT(m.id) AS member_count
       FROM organizations o
       LEFT JOIN organization_memberships m
         ON m.organization_id = o.id AND m.status = 'active'
       GROUP BY o.id, o.name, o.status
       ORDER BY member_count DESC, o.created_at ASC
       LIMIT 5`,
    );

    const activityRes = await pool.query<AuditRow>(
      `${ACTIVITY_SELECT} ORDER BY a.created_at DESC LIMIT 8`,
    );

    return {
      stats: {
        organizations: num(s?.organizations),
        activeOrganizations: num(s?.active_organizations),
        suspendedOrganizations: num(s?.suspended_organizations),
        pendingOrganizations: num(s?.pending_organizations),
        users: num(s?.users),
        activeUsers: num(s?.active_users),
        farms: num(s?.farms),
        fields: num(s?.fields),
        tasks: num(s?.tasks),
        workers: num(s?.workers),
        organizationsThisMonth: num(s?.organizations_this_month),
        usersThisMonth: num(s?.users_this_month),
      },
      taskStatus: await taskStatusFor(),
      recentOrganizations: recentOrgsRes.rows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        memberCount: num(row.member_count),
        farmCount: 0,
        taskCount: 0,
        ownerName: null,
        createdAt: toIso(row.created_at) ?? new Date().toISOString(),
      })),
      topOrganizations: topOrgsRes.rows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        memberCount: num(row.member_count),
      })),
      recentActivity: activityRes.rows.map(mapActivity),
    };
  },

  async listOrganizations(params: {
    search?: string;
    status?: string;
    sort?: string;
    order?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Paginated<OrgListItem>> {
    const page = clampPage(params.page);
    const pageSize = clampPageSize(params.pageSize);
    const offset = (page - 1) * pageSize;
    const where: string[] = [];
    const values: unknown[] = [];

    if (params.search && params.search.trim()) {
      values.push(`%${params.search.trim()}%`);
      where.push(`o.name LIKE $${values.length}`);
    }
    if (params.status && ['active', 'suspended', 'pending'].includes(params.status)) {
      values.push(params.status);
      where.push(`o.status = $${values.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sortColumn = ORG_SORT_COLUMNS[params.sort ?? 'created_at'] ?? ORG_SORT_COLUMNS.created_at;
    const direction = params.order === 'asc' ? 'ASC' : 'DESC';

    const countRes = await pool.query<CountRow>(
      `SELECT COUNT(*) AS n FROM organizations o ${whereSql}`,
      values,
    );
    const total = num(countRes.rows[0]?.n);

    const listValues = [...values, pageSize, offset];
    const listRes = await pool.query<{
      id: string;
      name: string;
      status: string;
      verification_status: string;
      country: string | null;
      created_at: Date | string;
      member_count: number | string;
      farm_count: number | string;
      task_count: number | string;
      owner_name: string | null;
    }>(
      `SELECT o.id, o.name, o.status, o.verification_status, o.country, o.created_at,
              (SELECT COUNT(*) FROM organization_memberships m WHERE m.organization_id = o.id) AS member_count,
              (SELECT COUNT(*) FROM farms f WHERE f.organization_id = o.id) AS farm_count,
              (SELECT COUNT(*) FROM tasks t WHERE t.organization_id = o.id) AS task_count,
              (SELECT u.name FROM users u WHERE u.id = o.created_by) AS owner_name
       FROM organizations o
       ${whereSql}
       ORDER BY ${sortColumn} ${direction}
       LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      listValues,
    );

    const items = listRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      verificationStatus: row.verification_status,
      country: row.country,
      memberCount: num(row.member_count),
      farmCount: num(row.farm_count),
      taskCount: num(row.task_count),
      ownerName: row.owner_name,
      createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    }));

    return paginate(items, total, page, pageSize);
  },

  async getOrganization(id: string): Promise<OrgDetail> {
    const orgRes = await pool.query<{
      id: string;
      name: string;
      status: string;
      verification_status: string;
      country: string | null;
      contact_email: string | null;
      website: string | null;
      currency: string;
      timezone: string;
      logo_url: string | null;
      created_at: Date | string;
    }>(
      `SELECT id, name, status, verification_status, country, contact_email, website,
              currency, timezone, logo_url, created_at
       FROM organizations WHERE id = $1`,
      [id],
    );
    const org = orgRes.rows[0];
    if (!org) {
      throw new AppError(404, 'Organization not found.', 'NOT_FOUND');
    }

    const countsRes = await pool.query<{
      members: number | string;
      farms: number | string;
      fields: number | string;
      tasks: number | string;
      workers: number | string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM organization_memberships m WHERE m.organization_id = $1) AS members,
         (SELECT COUNT(*) FROM farms f WHERE f.organization_id = $1) AS farms,
         (SELECT COUNT(*) FROM fields fl JOIN farms f ON f.id = fl.farm_id WHERE f.organization_id = $1) AS fields,
         (SELECT COUNT(*) FROM tasks t WHERE t.organization_id = $1) AS tasks,
         (SELECT COUNT(*) FROM workers w WHERE w.organization_id = $1) AS workers`,
      [id],
    );
    const c = countsRes.rows[0];

    const membersRes = await pool.query<{
      user_id: string;
      name: string;
      email: string;
      role_code: string;
      role_name: string;
      status: string;
      joined_at: Date | string | null;
    }>(
      `SELECT m.user_id, u.name, u.email, r.code AS role_code, r.name AS role_name,
              m.status, m.joined_at
       FROM organization_memberships m
       JOIN users u ON u.id = m.user_id
       JOIN roles r ON r.id = m.role_id
       WHERE m.organization_id = $1
       ORDER BY FIELD(m.status, 'active', 'pending', 'suspended'), u.name ASC
       LIMIT 200`,
      [id],
    );

    const activityRes = await pool.query<AuditRow>(
      `${ACTIVITY_SELECT} WHERE a.organization_id = $1 ORDER BY a.created_at DESC LIMIT 10`,
      [id],
    );

    return {
      id: org.id,
      name: org.name,
      status: org.status,
      verificationStatus: org.verification_status,
      country: org.country,
      contactEmail: org.contact_email,
      website: org.website,
      currency: org.currency,
      timezone: org.timezone,
      logoUrl: org.logo_url,
      createdAt: toIso(org.created_at) ?? new Date().toISOString(),
      counts: {
        members: num(c?.members),
        farms: num(c?.farms),
        fields: num(c?.fields),
        tasks: num(c?.tasks),
        workers: num(c?.workers),
      },
      taskStatus: await taskStatusFor(id),
      members: membersRes.rows.map((row) => ({
        userId: row.user_id,
        name: row.name,
        email: row.email,
        role: row.role_code,
        roleName: row.role_name,
        status: row.status,
        joinedAt: toIso(row.joined_at),
      })),
      recentActivity: activityRes.rows.map(mapActivity),
    };
  },

  async setOrganizationStatus(
    id: string,
    status: 'active' | 'suspended',
  ): Promise<{ id: string; name: string; status: string }> {
    const existing = await pool.query<{ id: string; name: string; status: string }>(
      `SELECT id, name, status FROM organizations WHERE id = $1`,
      [id],
    );
    const org = existing.rows[0];
    if (!org) {
      throw new AppError(404, 'Organization not found.', 'NOT_FOUND');
    }
    await pool.query(
      `UPDATE organizations SET status = $2, updated_at = now() WHERE id = $1`,
      [id, status],
    );
    return { id, name: org.name, status };
  },

  async listUsers(params: {
    search?: string;
    status?: string;
    role?: string;
    page?: number;
    pageSize?: number;
    sort?: string;
    order?: string;
  }): Promise<Paginated<GlobalUserItem>> {
    const page = clampPage(params.page);
    const pageSize = clampPageSize(params.pageSize);
    const offset = (page - 1) * pageSize;
    const where: string[] = [];
    const values: unknown[] = [];

    if (params.search && params.search.trim()) {
      values.push(`%${params.search.trim()}%`);
      const idx = values.length;
      where.push(`(u.name LIKE $${idx} OR u.email LIKE $${idx})`);
    }
    if (params.status === 'active') where.push('u.is_active = 1');
    if (params.status === 'inactive') where.push('u.is_active = 0');
    if (params.role && ['organization_administrator', 'farm_manager', 'supervisor', 'field_officer'].includes(params.role)) {
      values.push(params.role);
      where.push(`u.role = $${values.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sortColumn = USER_SORT_COLUMNS[params.sort ?? 'created_at'] ?? USER_SORT_COLUMNS.created_at;
    const direction = params.order === 'asc' ? 'ASC' : 'DESC';

    const countRes = await pool.query<CountRow>(
      `SELECT COUNT(*) AS n FROM users u ${whereSql}`,
      values,
    );
    const total = num(countRes.rows[0]?.n);

    const listValues = [...values, pageSize, offset];
    const listRes = await pool.query<{
      id: string;
      name: string;
      email: string;
      phone: string | null;
      role: string;
      is_active: boolean;
      last_login_at: Date | string | null;
      created_at: Date | string;
      membership_count: number | string;
    }>(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.last_login_at, u.created_at,
              (SELECT COUNT(*) FROM organization_memberships m WHERE m.user_id = u.id) AS membership_count
       FROM users u
       ${whereSql}
       ORDER BY ${sortColumn} ${direction}
       LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      listValues,
    );

    const items = listRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      isActive: row.is_active,
      membershipCount: num(row.membership_count),
      lastLoginAt: toIso(row.last_login_at),
      createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    }));

    return paginate(items, total, page, pageSize);
  },

  async getUser(id: string): Promise<GlobalUserDetail> {
    const userRes = await pool.query<{
      id: string;
      name: string;
      email: string;
      phone: string | null;
      role: string;
      is_active: boolean;
      avatar_url: string | null;
      last_login_at: Date | string | null;
      created_at: Date | string;
    }>(
      `SELECT id, name, email, phone, role, is_active, avatar_url, last_login_at, created_at
       FROM users WHERE id = $1`,
      [id],
    );
    const user = userRes.rows[0];
    if (!user) {
      throw new AppError(404, 'User not found.', 'NOT_FOUND');
    }

    const membershipsRes = await pool.query<{
      organization_id: string;
      organization_name: string;
      organization_status: string;
      role_code: string;
      role_name: string;
      status: string;
      joined_at: Date | string | null;
    }>(
      `SELECT m.organization_id, o.name AS organization_name, o.status AS organization_status,
              r.code AS role_code, r.name AS role_name, m.status, m.joined_at
       FROM organization_memberships m
       JOIN organizations o ON o.id = m.organization_id
       JOIN roles r ON r.id = m.role_id
       WHERE m.user_id = $1
       ORDER BY o.name ASC`,
      [id],
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.is_active,
      avatarUrl: user.avatar_url,
      lastLoginAt: toIso(user.last_login_at),
      createdAt: toIso(user.created_at) ?? new Date().toISOString(),
      memberships: membershipsRes.rows.map((row) => ({
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        organizationStatus: row.organization_status,
        role: row.role_code,
        roleName: row.role_name,
        status: row.status,
        joinedAt: toIso(row.joined_at),
      })),
    };
  },

  async getAnalytics(params: { range?: string; from?: string; to?: string }): Promise<AnalyticsResult> {
    const today = new Date();
    let days = 30;
    const to: Date = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    let from: Date | null = null;

    if (params.range === '7d') days = 7;
    else if (params.range === '90d') days = 90;
    else if (params.range === '30d') days = 30;
    else if (params.range === 'custom' && params.from && params.to) {
      const f = new Date(params.from);
      const t = new Date(params.to);
      if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime()) || f > t) {
        throw new AppError(400, 'Invalid date range.', 'VALIDATION_ERROR');
      }
      from = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate()));
      to.setTime(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
      days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
      if (days > 366) {
        throw new AppError(400, 'The date range cannot exceed 366 days.', 'VALIDATION_ERROR');
      }
    }

    if (!from) {
      from = new Date(to.getTime() - (days - 1) * 86_400_000);
    }
    const fromIso = from.toISOString().slice(0, 10);
    const toIsoDate = to.toISOString().slice(0, 10);
    const fromDate = `${fromIso} 00:00:00`;

    const [orgsRes, usersRes, tasksRes, orgStatusRes, taskStatus] = await Promise.all([
      pool.query<{ d: string; c: number | string }>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS c
         FROM organizations WHERE created_at >= $1 GROUP BY d`,
        [fromDate],
      ),
      pool.query<{ d: string; c: number | string }>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS c
         FROM users WHERE created_at >= $1 GROUP BY d`,
        [fromDate],
      ),
      pool.query<{ d: string; c: number | string }>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS c
         FROM tasks WHERE created_at >= $1 GROUP BY d`,
        [fromDate],
      ),
      pool.query<{
        active: number | string;
        suspended: number | string;
        pending: number | string;
      }>(
        `SELECT
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
           SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
         FROM organizations`,
      ),
      taskStatusFor(),
    ]);

    const orgMap = new Map(orgsRes.rows.map((r) => [r.d, num(r.c)]));
    const userMap = new Map(usersRes.rows.map((r) => [r.d, num(r.c)]));
    const taskMap = new Map(tasksRes.rows.map((r) => [r.d, num(r.c)]));

    const series: AnalyticsSeriesPoint[] = [];
    for (let i = 0; i < days; i += 1) {
      const day = new Date(from.getTime() + i * 86_400_000);
      const key = day.toISOString().slice(0, 10);
      series.push({
        date: key,
        organizations: orgMap.get(key) ?? 0,
        users: userMap.get(key) ?? 0,
        tasks: taskMap.get(key) ?? 0,
      });
    }

    const st = orgStatusRes.rows[0];
    return {
      range: { from: fromIso, to: toIsoDate, days },
      series,
      totals: {
        organizations: series.reduce((sum, p) => sum + p.organizations, 0),
        users: series.reduce((sum, p) => sum + p.users, 0),
        tasks: series.reduce((sum, p) => sum + p.tasks, 0),
        tasksFinished: taskStatus.finished,
      },
      organizationStatus: {
        active: num(st?.active),
        suspended: num(st?.suspended),
        pending: num(st?.pending),
      },
      taskStatus,
    };
  },

  async listAuditLogs(params: {
    search?: string;
    action?: string;
    actorType?: string;
    organizationId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Paginated<ActivityItem>> {
    const page = clampPage(params.page);
    const pageSize = clampPageSize(params.pageSize);
    const offset = (page - 1) * pageSize;
    const where: string[] = [];
    const values: unknown[] = [];

    if (params.search && params.search.trim()) {
      values.push(`%${params.search.trim()}%`);
      const idx = values.length;
      where.push(`(a.action LIKE $${idx} OR u.name LIKE $${idx} OR sa.name LIKE $${idx} OR o.name LIKE $${idx})`);
    }
    if (params.action && params.action.trim()) {
      values.push(`%${params.action.trim()}%`);
      where.push(`a.action LIKE $${values.length}`);
    }
    if (params.actorType && ['user', 'system_admin', 'system'].includes(params.actorType)) {
      values.push(params.actorType);
      where.push(`a.actor_type = $${values.length}`);
    }
    if (params.organizationId) {
      values.push(params.organizationId);
      where.push(`a.organization_id = $${values.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await pool.query<CountRow>(
      `SELECT COUNT(*) AS n FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_user_id
       LEFT JOIN system_administrators sa ON sa.id = a.actor_admin_id
       LEFT JOIN organizations o ON o.id = a.organization_id
       ${whereSql}`,
      values,
    );
    const total = num(countRes.rows[0]?.n);

    const listValues = [...values, pageSize, offset];
    const listRes = await pool.query<AuditRow>(
      `${ACTIVITY_SELECT}
       ${whereSql}
       ORDER BY a.created_at DESC
       LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      listValues,
    );

    return paginate(listRes.rows.map(mapActivity), total, page, pageSize);
  },

  async getPlatformHealth(): Promise<{
    health: Awaited<ReturnType<typeof getHealth>>;
    systemAdministrators: number;
    activeSystemAdministrators: number;
    activeSystemSessions: number;
    activeUserSessions: number;
  }> {
    const [health, counts] = await Promise.all([
      getHealth(),
      pool.query<{
        system_administrators: number | string;
        active_system_administrators: number | string;
        active_system_sessions: number | string;
        active_user_sessions: number | string;
      }>(
        `SELECT
           (SELECT COUNT(*) FROM system_administrators) AS system_administrators,
           (SELECT COUNT(*) FROM system_administrators WHERE status = 'active') AS active_system_administrators,
           (SELECT COUNT(*) FROM system_admin_sessions WHERE revoked_at IS NULL AND expires_at > now()) AS active_system_sessions,
           (SELECT COUNT(*) FROM sessions WHERE revoked_at IS NULL AND expires_at > now()) AS active_user_sessions`,
      ),
    ]);
    const c = counts.rows[0];
    return {
      health,
      systemAdministrators: num(c?.system_administrators),
      activeSystemAdministrators: num(c?.active_system_administrators),
      activeSystemSessions: num(c?.active_system_sessions),
      activeUserSessions: num(c?.active_user_sessions),
    };
  },
};
