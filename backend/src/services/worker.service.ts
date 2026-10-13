import { pool, uid } from '../database/pool.js';
import type { AuthUser, UserRole } from '../types/auth.js';
import { roleAtLeast } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { pushService } from './push.service.js';

export interface WorkerItem {
  id: string;
  userId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  farmId: string | null;
  farmName: string | null;
  fieldId: string | null;
  fieldName: string | null;
  status: string;
  skills: string[];
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  openTasks: number;
}

interface WorkerRow {
  id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
  farm_id: string | null;
  farm_name: string | null;
  field_id: string | null;
  field_name: string | null;
  status: string;
  skills: string[] | null;
  joined_at: string;
  created_at: string;
  updated_at: string;
  task_count: string;
  open_tasks: string;
}

const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const WORKER_SELECT = `
  SELECT w.id, w.user_id, w.name, w.phone, w.email, w.role,
         w.farm_id, f.name AS farm_name, w.field_id, fl.name AS field_name,
         w.status, w.skills, w.joined_at, w.created_at, w.updated_at,
         (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = w.id) AS task_count,
         (SELECT COUNT(*) FROM tasks t2 WHERE t2.assigned_to = w.id AND t2.status <> 'finished') AS open_tasks
  FROM workers w
  LEFT JOIN farms f ON f.id = w.farm_id
  LEFT JOIN fields fl ON fl.id = w.field_id
`;

function toWorker(row: WorkerRow): WorkerItem {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    position: row.role,
    farmId: row.farm_id,
    farmName: row.farm_name,
    fieldId: row.field_id,
    fieldName: row.field_name,
    status: row.status,
    skills: row.skills ?? [],
    joinedAt: row.joined_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    taskCount: Number(row.task_count),
    openTasks: Number(row.open_tasks),
  };
}

function roleScope(role: UserRole): string {
  if (roleAtLeast(role, 'farm_manager')) return '';
  if (role === 'supervisor') {
    return `w.farm_id IN (
      SELECT farm_id FROM farms WHERE manager_id = $scope
      UNION
      SELECT farm_id FROM workers WHERE user_id = $scope)`;
  }
  return `w.user_id = $scope`;
}

function insertScope(actor: AuthUser): string {
  return roleScope(actor.role).replace(/\$scope/g, `'${actor.id}'`);
}

async function farmName(farmId: string): Promise<string | null> {
  const res = await pool.query<{ name: string }>('SELECT name FROM farms WHERE id = $1', [farmId]);
  return res.rows[0]?.name ?? null;
}

async function assertValidUser(userId: string | null) {
  if (!userId) return;
  const res = await pool.query<{ id: string }>(
    'SELECT id FROM users WHERE id = $1 AND is_active = TRUE',
    [userId],
  );
  if (res.rows.length === 0) {
    throw new AppError(400, 'Please choose a valid team member account.', 'INVALID_REFERENCE');
  }
}

async function assertValidPlacement(farmId: string | null, fieldId: string | null) {  if (farmId) {
    const farm = await pool.query<{ id: string }>('SELECT id FROM farms WHERE id = $1', [farmId]);
    if (farm.rows.length === 0) {
      throw new AppError(400, 'Please choose a valid farm.', 'INVALID_REFERENCE');
    }
  }

  if (fieldId) {
    const field = await pool.query<{ id: string; farm_id: string }>(
      'SELECT id, farm_id FROM fields WHERE id = $1',
      [fieldId],
    );
    if (field.rows.length === 0) {
      throw new AppError(400, 'Please choose a valid field.', 'INVALID_REFERENCE');
    }
    if (farmId && field.rows[0].farm_id !== farmId) {
      throw new AppError(400, 'That field does not belong to the chosen farm.', 'INVALID_REFERENCE');
    }
  }
}

async function canManagePlacement(
  actor: AuthUser,
  farmId: string | null,
): Promise<boolean> {
  if (actor.role === 'organization_administrator') return true;
  if (!roleAtLeast(actor.role, 'farm_manager')) return false;
  if (!farmId) return false;
  const result = await pool.query<{ id: string }>(
    'SELECT id FROM farms WHERE id = $1 AND manager_id = $2',
    [farmId, actor.id],
  );
  return result.rows.length > 0;
}

export interface WorkerListQuery {
  search?: string;
  status?: string;
  farmId?: string;
  page: number;
  pageSize: number;
}

export const workerService = {
  async list(actor: AuthUser, query: WorkerListQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    const scope = insertScope(actor);
    if (scope) conditions.push(`(${scope})`);

    if (query.search) {
      params.push(`%${query.search}%`);
      conditions.push(
        `(w.name ILIKE $${params.length} OR w.phone ILIKE $${params.length} OR w.email ILIKE $${params.length})`,
      );
    }
    if (query.status) {
      params.push(query.status);
      conditions.push(`w.status = $${params.length}`);
    }
    if (query.farmId) {
      params.push(query.farmId);
      conditions.push(`w.farm_id = $${params.length}`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (query.page - 1) * query.pageSize;

    params.push(query.pageSize);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM workers w ${whereSql}`,
      params.slice(0, -2),
    );

    const result = await pool.query<WorkerRow>(
      `${WORKER_SELECT}
       ${whereSql}
       ORDER BY w.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );

    return {
      items: result.rows.map(toWorker),
      total: Number(countResult.rows[0].count),
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  async get(actor: AuthUser, id: string): Promise<WorkerItem> {
    if (!isUuid.test(id)) {
      throw new AppError(404, 'This worker could not be found.', 'NOT_FOUND');
    }
    const result = await pool.query<WorkerRow>(`${WORKER_SELECT} WHERE w.id = $1`, [id]);
    if (result.rows.length === 0) {
      throw new AppError(404, 'This worker could not be found.', 'NOT_FOUND');
    }

    const worker = result.rows[0];
    if (!roleAtLeast(actor.role, 'farm_manager')) {
      const scoped = await pool.query<{ id: string }>(
        `SELECT id FROM workers w WHERE w.id = $1 AND ${insertScope(actor)}`,
        [id],
      );
      if (scoped.rows.length === 0) {
        throw new AppError(403, "You don't have access to this worker.", 'FORBIDDEN');
      }
    }

    return toWorker(worker);
  },

  async create(
    actor: AuthUser,
    input: {
      name: string;
      phone?: string | null;
      email?: string | null;
      userId?: string | null;
      position?: string | null;
      farmId?: string | null;
      fieldId?: string | null;
      skills?: string[];
      status?: string;
      joinedAt?: string | null;
    },
  ): Promise<WorkerItem> {
    const farmId = input.farmId ?? null;
    const fieldId = input.fieldId ?? null;

    await assertValidPlacement(farmId, fieldId);
    await assertValidUser(input.userId ?? null);
    if (!(await canManagePlacement(actor, farmId))) {
      throw new AppError(
        403,
        "You can only add workers to farms you manage.",
        'FORBIDDEN',
      );
    }

    const id = uid();
    const skills = JSON.stringify((input.skills ?? []).filter(Boolean));
    const joinedAt = input.joinedAt ?? new Date().toISOString().slice(0, 10);

    await pool.query(
      `INSERT INTO workers (id, user_id, name, phone, email, role, farm_id, field_id, skills, status, joined_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        input.userId ?? null,
        input.name,
        input.phone ?? null,
        input.email ?? null,
        input.position ?? null,
        farmId,
        fieldId,
        skills,
        input.status ?? 'active',
        joinedAt,
      ],
    );

    const result = await pool.query<WorkerRow>(`${WORKER_SELECT} WHERE w.id = $1`, [id]);
    logger.info(`Worker created`, { workerId: result.rows[0].id, farmId });
    return toWorker(result.rows[0]);
  },

  async update(
    actor: AuthUser,
    id: string,
    input: {
      name?: string;
      phone?: string | null;
      email?: string | null;
      userId?: string | null;
      position?: string | null;
      farmId?: string | null;
      fieldId?: string | null;
      skills?: string[];
      status?: string;
      joinedAt?: string | null;
    },
  ): Promise<WorkerItem> {
    if (!isUuid.test(id)) {
      throw new AppError(404, 'This worker could not be found.', 'NOT_FOUND');
    }
    const current = await pool.query<{ id: string; farm_id: string | null; user_id: string | null }>(
      'SELECT id, farm_id, user_id FROM workers WHERE id = $1',
      [id],
    );
    if (current.rows.length === 0) {
      throw new AppError(404, 'This worker could not be found.', 'NOT_FOUND');
    }

    const nextFarmId = input.farmId !== undefined ? (input.farmId ?? null) : current.rows[0].farm_id;
    const nextFieldId =
      input.fieldId !== undefined
        ? (input.fieldId ?? null)
        : input.farmId !== undefined
          ? null
          : undefined;

    await assertValidPlacement(nextFarmId, nextFieldId ?? null);
    if (input.userId !== undefined) {
      await assertValidUser(input.userId ?? null);
    }
    if (!(await canManagePlacement(actor, nextFarmId))) {
      throw new AppError(
        403,
        "You can only update workers on farms you manage.",
        'FORBIDDEN',
      );
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    const entries: [keyof typeof input, string][] = [
      ['name', 'name'],
      ['phone', 'phone'],
      ['email', 'email'],
      ['userId', 'user_id'],
      ['position', 'role'],
      ['farmId', 'farm_id'],
      ['fieldId', 'field_id'],
      ['skills', 'skills'],
      ['status', 'status'],
      ['joinedAt', 'joined_at'],
    ];

    for (const [key, column] of entries) {
      if (input[key] !== undefined) {
        const value = input[key];
        params.push(
          key === 'skills'
            ? JSON.stringify((value as string[]).filter(Boolean))
            : (value as string | null),
        );
        sets.push(`${column} = $${params.length}`);
      }
    }
    if (sets.length === 0) {
      throw new AppError(400, 'Nothing to update.', 'VALIDATION_ERROR');
    }

    params.push(id);
    await pool.query(`UPDATE workers SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);

    const previousFarmId = current.rows[0].farm_id;
    const linkedUserId = current.rows[0].user_id;
    if (nextFarmId !== previousFarmId && linkedUserId) {
      const newFarmName = nextFarmId ? await farmName(nextFarmId) : null;
      const title = newFarmName ? 'New farm assignment' : 'Farm assignment removed';
      const message = newFarmName
        ? `You have been assigned to ${newFarmName}.`
        : 'You are no longer assigned to a farm.';
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, organization_id)
           VALUES ($1, 'system', $2, $3, $4)`,
          [linkedUserId, title, message, actor.currentOrg?.id ?? null],
        );
        void pushService.sendToUser(linkedUserId, { title, message, type: 'system', taskId: null });
      } catch (error) {
        logger.warn('[worker] Farm-assignment notification failed', {
          workerId: id,
          message: (error as Error).message,
        });
      }
    }

    const result = await pool.query<WorkerRow>(`${WORKER_SELECT} WHERE w.id = $1`, [id]);
    return toWorker(result.rows[0]);
  },

  async remove(actor: AuthUser, id: string): Promise<void> {
    if (!isUuid.test(id)) {
      throw new AppError(404, 'This worker could not be found.', 'NOT_FOUND');
    }
    const worker = await pool.query<{ id: string; farm_id: string | null }>(
      'SELECT id, farm_id FROM workers WHERE id = $1',
      [id],
    );
    if (worker.rows.length === 0) {
      throw new AppError(404, 'This worker could not be found.', 'NOT_FOUND');
    }
    if (!(await canManagePlacement(actor, worker.rows[0].farm_id))) {
      throw new AppError(403, "You can only delete workers on farms you manage.", 'FORBIDDEN');
    }

    const openTasks = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE assigned_to = $1 AND status <> 'finished'`,
      [id],
    );
    if (Number(openTasks.rows[0].count) > 0) {
      throw new AppError(
        409,
        "This worker still has tasks. Reassign them first, or set the worker to inactive instead.",
        'WORKER_HAS_TASKS',
      );
    }

    await pool.query('DELETE FROM workers WHERE id = $1', [id]);
    logger.info(`Worker deleted`, { workerId: id });
  },
};