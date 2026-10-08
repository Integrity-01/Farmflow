import { pool, uid } from '../database/pool.js';
import type { AuthUser, UserRole } from '../types/auth.js';
import { roleAtLeast } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export interface FarmListItem {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  latitude: string | null;
  longitude: string | null;
  size: string | null;
  sizeUnit: string;
  managerId: string | null;
  managerName: string | null;
  status: string;
  fieldCount: number;
  workerCount: number;
  taskCount: number;
  pendingTasks: number;
  createdAt: string;
  updatedAt: string;
}

export interface FarmField {
  id: string;
  farmId: string;
  name: string;
  size: string | null;
  sizeUnit: string;
  crop: string | null;
  cropVariety: string | null;
  plantingDate: string | null;
  expectedHarvestDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FarmRow {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  latitude: string | null;
  longitude: string | null;
  size: string | null;
  size_unit: string;
  manager_id: string | null;
  manager_name: string | null;
  status: string;
  field_count: string;
  worker_count: string;
  task_count: string;
  pending_tasks: string;
  created_at: string;
  updated_at: string;
}

interface FieldRow {
  id: string;
  farm_id: string;
  name: string;
  size: string | null;
  size_unit: string;
  crop: string | null;
  crop_variety: string | null;
  planting_date: string | null;
  expected_harvest_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toFarmList(row: FarmRow): FarmListItem {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    description: row.description,
    latitude: row.latitude,
    longitude: row.longitude,
    size: row.size,
    sizeUnit: row.size_unit,
    managerId: row.manager_id,
    managerName: row.manager_name,
    status: row.status,
    fieldCount: Number(row.field_count),
    workerCount: Number(row.worker_count),
    taskCount: Number(row.task_count),
    pendingTasks: Number(row.pending_tasks),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toField(row: FieldRow): FarmField {
  return {
    id: row.id,
    farmId: row.farm_id,
    name: row.name,
    size: row.size,
    sizeUnit: row.size_unit,
    crop: row.crop,
    cropVariety: row.crop_variety,
    plantingDate: row.planting_date,
    expectedHarvestDate: row.expected_harvest_date,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const FARM_SELECT = `
  SELECT f.id, f.name, f.location, f.description, f.latitude, f.longitude, f.size, f.size_unit,
         f.manager_id, u.name AS manager_name, f.status,
         f.created_at, f.updated_at,
         (SELECT COUNT(*) FROM fields fl WHERE fl.farm_id = f.id)   AS field_count,
         (SELECT COUNT(*) FROM workers w WHERE w.farm_id = f.id)    AS worker_count,
         (SELECT COUNT(*) FROM tasks t WHERE t.farm_id = f.id)      AS task_count,
         (SELECT COUNT(*) FROM tasks t WHERE t.farm_id = f.id AND t.status <> 'finished') AS pending_tasks
  FROM farms f
  LEFT JOIN users u ON u.id = f.manager_id
`;

function roleCondition(role: UserRole, userId: string): string {
  if (roleAtLeast(role, 'farm_manager')) {
    return '';
  }
  if (role === 'supervisor') {
    return `AND (f.manager_id = '${userId}' OR f.id IN (SELECT farm_id FROM workers WHERE user_id = '${userId}'))`;
  }
  return `AND f.id IN (SELECT farm_id FROM workers WHERE user_id = '${userId}')`;
}

async function userLinkedToFarm(userId: string, farmId: string): Promise<boolean> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM workers WHERE user_id = $1 AND farm_id = $2`,
    [userId, farmId],
  );
  return Number(result.rows[0].count) > 0;
}

async function canViewFarm(
  actor: AuthUser,
  farm: { id: string; manager_id: string | null },
): Promise<boolean> {
  if (roleAtLeast(actor.role, 'farm_manager')) return true;
  if (actor.role === 'supervisor' && farm.manager_id === actor.id) return true;
  return userLinkedToFarm(actor.id, farm.id);
}

async function canManageFarm(
  actor: AuthUser,
  farm: { id: string; manager_id: string | null },
): Promise<boolean> {
  if (actor.role === 'administrator') return true;
  if (roleAtLeast(actor.role, 'farm_manager') && farm.manager_id === actor.id) return true;
  return false;
}

async function resolveFarm(id: string): Promise<{ id: string; manager_id: string | null } | null> {
  if (!isUuid.test(id)) return null;
  const result = await pool.query<{ id: string; manager_id: string | null }>(
    `SELECT id, manager_id FROM farms WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

async function assertManagerIsValid(managerId: string | null) {
  if (!managerId) return;
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE id = $1 AND is_active = TRUE AND role IN ('farm_manager', 'administrator')`,
    [managerId],
  );
  if (result.rows.length === 0) {
    throw new AppError(400, 'Please choose a valid farm manager.', 'INVALID_REFERENCE');
  }
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === 'ER_DUP_ENTRY' || code === '23505';
}

function isFkViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === 'ER_NO_REFERENCED_ROW_2' || code === '23503';
}

export interface ListQuery {
  search?: string;
  status?: string;
  page: number;
  pageSize: number;
}

export const farmService = {
  async list(actor: AuthUser, query: ListQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    const roleFilter = roleCondition(actor.role, actor.id);
    if (roleFilter) conditions.push(roleFilter.replace(/^AND\s/, ''));

    if (query.search) {
      params.push(`%${query.search}%`);
      conditions.push(`(f.name ILIKE $${params.length} OR f.location ILIKE $${params.length})`);
    }
    if (query.status) {
      params.push(query.status);
      conditions.push(`f.status = $${params.length}`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (query.page - 1) * query.pageSize;

    params.push(query.pageSize);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM farms f ${whereSql}`,
      params.slice(0, -2),
    );

    const result = await pool.query<FarmRow>(
      `${FARM_SELECT}
       ${whereSql}
       ORDER BY f.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );

    return {
      items: result.rows.map(toFarmList),
      total: Number(countResult.rows[0].count),
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  async listManagers() {
    const result = await pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM users
       WHERE is_active = TRUE AND role IN ('farm_manager', 'administrator')
       ORDER BY name`,
    );
    return result.rows;
  },

  async getById(actor: AuthUser, id: string): Promise<FarmListItem & { fields: FarmField[] }> {
    const farm = await resolveFarm(id);
    if (!farm) {
      throw new AppError(404, 'This farm could not be found.', 'NOT_FOUND');
    }
    if (!(await canViewFarm(actor, farm))) {
      throw new AppError(403, "You don't have access to this farm.", 'FORBIDDEN');
    }

    const farmResult = await pool.query<FarmRow>(
      `${FARM_SELECT} WHERE f.id = $1`,
      [id],
    );
    const fieldsResult = await pool.query<FieldRow>(
      `SELECT id, farm_id, name, size, size_unit, crop, crop_variety,
              planting_date, expected_harvest_date, status, notes, created_at, updated_at
       FROM fields WHERE farm_id = $1 ORDER BY name`,
      [id],
    );

    return { ...toFarmList(farmResult.rows[0]), fields: fieldsResult.rows.map(toField) };
  },

  async listFields(actor: AuthUser, id: string): Promise<FarmField[]> {
    const farm = await resolveFarm(id);
    if (!farm) {
      throw new AppError(404, 'This farm could not be found.', 'NOT_FOUND');
    }
    if (!(await canViewFarm(actor, farm))) {
      throw new AppError(403, "You don't have access to this farm.", 'FORBIDDEN');
    }
    const result = await pool.query<FieldRow>(
      `SELECT id, farm_id, name, size, size_unit, crop, crop_variety,
              planting_date, expected_harvest_date, status, notes, created_at, updated_at
       FROM fields WHERE farm_id = $1 ORDER BY name`,
      [id],
    );
    return result.rows.map(toField);
  },

  async create(
    actor: AuthUser,
    input: {
      name: string;
      location?: string | null;
      description?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      size?: number | null;
      sizeUnit?: string;
      managerId?: string | null;
      status?: string;
    },
  ): Promise<FarmListItem> {
    await assertManagerIsValid(input.managerId ?? null);

    const id = uid();
    await pool.query(
      `INSERT INTO farms (id, name, location, description, latitude, longitude, size, size_unit, manager_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        input.name,
        input.location ?? null,
        input.description ?? null,
        input.latitude ?? null,
        input.longitude ?? null,
        input.size ?? null,
        input.sizeUnit ?? 'hectares',
        input.managerId ?? null,
        input.status ?? 'active',
      ],
    ).catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new AppError(409, 'This farm name is already in use.', 'NAME_TAKEN');
      }
      throw error;
    });

    const result = await pool.query<FarmRow>(`${FARM_SELECT} WHERE f.id = $1`, [id]);
    logger.info(`Farm created by ${actor.role}`, { farmId: id });
    return toFarmList(result.rows[0]);
  },

  async update(
    actor: AuthUser,
    id: string,
    input: {
      name?: string;
      location?: string | null;
      description?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      size?: number | null;
      sizeUnit?: string;
      managerId?: string | null;
      status?: string;
    },
  ): Promise<FarmListItem> {
    const farm = await resolveFarm(id);
    if (!farm) {
      throw new AppError(404, 'This farm could not be found.', 'NOT_FOUND');
    }
    if (!(await canManageFarm(actor, farm))) {
      throw new AppError(403, "You can only update farms you manage.", 'FORBIDDEN');
    }
    if (input.managerId !== undefined && input.managerId !== null) {
      await assertManagerIsValid(input.managerId);
    }

    const sets: string[] = [];
    const params: unknown[] = [];

    const fields: [keyof typeof input, string][] = [
      ['name', 'name'],
      ['location', 'location'],
      ['description', 'description'],
      ['latitude', 'latitude'],
      ['longitude', 'longitude'],
      ['size', 'size'],
      ['sizeUnit', 'size_unit'],
      ['managerId', 'manager_id'],
      ['status', 'status'],
    ];

    for (const [key, column] of fields) {
      if (input[key] !== undefined) {
        params.push(input[key] ?? null);
        sets.push(`${column} = $${params.length}`);
      }
    }

    if (sets.length === 0) {
      throw new AppError(400, 'Nothing to update.', 'VALIDATION_ERROR');
    }

    params.push(id);
    await pool.query(`UPDATE farms SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);

    const refreshed = await pool.query<FarmRow>(`${FARM_SELECT} WHERE f.id = $1`, [id]);
    return toFarmList(refreshed.rows[0]);
  },

  async remove(actor: AuthUser, id: string): Promise<void> {
    const farm = await resolveFarm(id);
    if (!farm) {
      throw new AppError(404, 'This farm could not be found.', 'NOT_FOUND');
    }
    if (!(await canManageFarm(actor, farm))) {
      throw new AppError(403, "You can only delete farms you manage.", 'FORBIDDEN');
    }

    const tasks = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE farm_id = $1 AND status <> 'finished'`,
      [id],
    );
    if (Number(tasks.rows[0].count) > 0) {
      throw new AppError(
        409,
        "This farm still has pending tasks. Reassign or finish them before deleting it.",
        'FARM_HAS_TASKS',
      );
    }

    await pool.query('DELETE FROM farms WHERE id = $1', [id]);
    logger.info(`Farm deleted`, { farmId: id });
  },

  async addField(
    actor: AuthUser,
    farmId: string,
    input: {
      name: string;
      size?: number | null;
      sizeUnit?: string;
      crop?: string | null;
      cropVariety?: string | null;
      plantingDate?: string | null;
      expectedHarvestDate?: string | null;
      status?: string;
      notes?: string | null;
    },
  ): Promise<FarmField> {
    const farm = await resolveFarm(farmId);
    if (!farm) {
      throw new AppError(404, 'This farm could not be found.', 'NOT_FOUND');
    }
    if (!(await canManageFarm(actor, farm))) {
      throw new AppError(403, "You can only manage fields on farms you manage.", 'FORBIDDEN');
    }

    const id = uid();
    await pool.query(
      `INSERT INTO fields (id, farm_id, name, size, size_unit, crop, crop_variety, planting_date, expected_harvest_date, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        farmId,
        input.name,
        input.size ?? null,
        input.sizeUnit ?? 'hectares',
        input.crop ?? null,
        input.cropVariety ?? null,
        input.plantingDate ?? null,
        input.expectedHarvestDate ?? null,
        input.status ?? 'active',
        input.notes ?? null,
      ],
    ).catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new AppError(409, 'A field with this name already exists on this farm.', 'NAME_TAKEN');
      }
      if (isFkViolation(error)) {
        throw new AppError(400, 'Please choose a valid farm.', 'INVALID_REFERENCE');
      }
      throw error;
    });

    const result = await pool.query<FieldRow>(
      `SELECT id, farm_id, name, size, size_unit, crop, crop_variety,
              planting_date, expected_harvest_date, status, notes, created_at, updated_at
       FROM fields WHERE id = $1`,
      [id],
    );
    return toField(result.rows[0]);
  },

  async updateField(
    actor: AuthUser,
    fieldId: string,
    input: {
      name?: string;
      size?: number | null;
      sizeUnit?: string;
      crop?: string | null;
      cropVariety?: string | null;
      plantingDate?: string | null;
      expectedHarvestDate?: string | null;
      status?: string;
      notes?: string | null;
    },
  ): Promise<FarmField> {
    if (!isUuid.test(fieldId)) {
      throw new AppError(404, 'This field could not be found.', 'NOT_FOUND');
    }
    const field = await pool.query<{ id: string; farm_id: string }>(
      `SELECT id, farm_id FROM fields WHERE id = $1`,
      [fieldId],
    );
    if (field.rows.length === 0) {
      throw new AppError(404, 'This field could not be found.', 'NOT_FOUND');
    }
    const farm = await resolveFarm(field.rows[0].farm_id);
    if (!farm || !(await canManageFarm(actor, farm))) {
      throw new AppError(403, "You can only manage fields on farms you manage.", 'FORBIDDEN');
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    const entries: [keyof typeof input, string][] = [
      ['name', 'name'],
      ['size', 'size'],
      ['sizeUnit', 'size_unit'],
      ['crop', 'crop'],
      ['cropVariety', 'crop_variety'],
      ['plantingDate', 'planting_date'],
      ['expectedHarvestDate', 'expected_harvest_date'],
      ['status', 'status'],
      ['notes', 'notes'],
    ];

    for (const [key, column] of entries) {
      if (input[key] !== undefined) {
        params.push(input[key] ?? null);
        sets.push(`${column} = $${params.length}`);
      }
    }
    if (sets.length === 0) {
      throw new AppError(400, 'Nothing to update.', 'VALIDATION_ERROR');
    }

    params.push(fieldId);
    await pool.query(`UPDATE fields SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);

    const result = await pool.query<FieldRow>(
      `SELECT id, farm_id, name, size, size_unit, crop, crop_variety,
              planting_date, expected_harvest_date, status, notes, created_at, updated_at
       FROM fields WHERE id = $1`,
      [fieldId],
    );
    return toField(result.rows[0]);
  },

  async removeField(actor: AuthUser, fieldId: string): Promise<void> {
    if (!isUuid.test(fieldId)) {
      throw new AppError(404, 'This field could not be found.', 'NOT_FOUND');
    }
    const field = await pool.query<{ id: string; farm_id: string }>(
      `SELECT id, farm_id FROM fields WHERE id = $1`,
      [fieldId],
    );
    if (field.rows.length === 0) {
      throw new AppError(404, 'This field could not be found.', 'NOT_FOUND');
    }
    const farm = await resolveFarm(field.rows[0].farm_id);
    if (!farm || !(await canManageFarm(actor, farm))) {
      throw new AppError(403, "You can only manage fields on farms you manage.", 'FORBIDDEN');
    }
    await pool.query('DELETE FROM fields WHERE id = $1', [fieldId]);
  },
};

export type FarmInput = Parameters<typeof farmService.create>[1];
export type FieldInput = Parameters<typeof farmService.addField>[2];