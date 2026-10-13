import { pool, uid } from '../database/pool.js';
import type { AuthUser } from '../types/auth.js';
import { roleAtLeast } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export type InputType =
  | 'seed'
  | 'fertilizer'
  | 'pesticide'
  | 'herbicide'
  | 'fungicide'
  | 'feed'
  | 'fuel'
  | 'equipment'
  | 'tools'
  | 'other';

export type InputStock = 'in_stock' | 'low' | 'out';

export interface InventoryItem {
  id: string;
  farmId: string;
  farmName: string;
  name: string;
  type: InputType;
  unit: string;
  quantity: string;
  lowStockThreshold: string;
  lowStock: boolean;
  stock: InputStock;
  unitCost: string | null;
  supplier: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InputMovement {
  id: string;
  inputId: string;
  change: string;
  note: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

interface InputRow {
  id: string;
  farm_id: string;
  farm_name: string;
  name: string;
  type: InputType;
  unit: string;
  quantity: string;
  low_stock_threshold: string;
  unit_cost: string | null;
  supplier: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface MovementRow {
  id: string;
  input_id: string;
  qty_change: string;
  note: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

const INPUT_SELECT = `
  SELECT i.id, i.farm_id, f.name AS farm_name, i.name, i.type, i.unit,
         i.quantity, i.low_stock_threshold, i.unit_cost, i.supplier, i.notes,
         i.created_at, i.updated_at
  FROM inputs i
  JOIN farms f ON f.id = i.farm_id
`;

// Mirrors the farm.service.ts permission helpers so inventory stays scoped to
// the same farm rules without entangling the two services.
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (actor.role === 'organization_administrator') return true;
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

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === 'ER_DUP_ENTRY' || code === '23505';
}

function isFkViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === 'ER_NO_REFERENCED_ROW_2' || code === '23503';
}

function stockOf(quantity: string, threshold: string): InputStock {
  const qty = Number(quantity);
  const limit = Number(threshold);
  if (qty <= 0) return 'out';
  if (limit > 0 && qty <= limit) return 'low';
  return 'in_stock';
}

function toInput(row: InputRow): InventoryItem {
  const quantity = row.quantity;
  const lowStockThreshold = row.low_stock_threshold;
  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farm_name,
    name: row.name,
    type: row.type,
    unit: row.unit,
    quantity,
    lowStockThreshold,
    lowStock: stockOf(quantity, lowStockThreshold) === 'low',
    stock: stockOf(quantity, lowStockThreshold),
    unitCost: row.unit_cost,
    supplier: row.supplier,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMovement(row: MovementRow): InputMovement {
  return {
    id: row.id,
    inputId: row.input_id,
    change: row.qty_change,
    note: row.note,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  };
}

async function resolveInput(id: string): Promise<{ id: string; farm_id: string } | null> {
  if (!isUuid.test(id)) return null;
  const result = await pool.query<{ id: string; farm_id: string }>(
    `SELECT id, farm_id FROM inputs WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export interface ListQuery {
  search?: string;
  type?: string;
  stock?: 'all' | 'low' | 'out';
  farmId?: string;
  page: number;
  pageSize: number;
}

function roleCondition(role: AuthUser['role'], userId: string): string {
  if (roleAtLeast(role, 'farm_manager')) {
    return '';
  }
  if (role === 'supervisor') {
    return `AND (f.manager_id = '${userId}' OR f.id IN (SELECT farm_id FROM workers WHERE user_id = '${userId}'))`;
  }
  return `AND f.id IN (SELECT farm_id FROM workers WHERE user_id = '${userId}')`;
}

export const inventoryService = {
  async list(actor: AuthUser, query: ListQuery) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    const roleFilter = roleCondition(actor.role, actor.id);
    if (roleFilter) conditions.push(roleFilter.replace(/^AND\s/, ''));

    if (query.search) {
      params.push(`%${query.search}%`);
      conditions.push(
        `(i.name ILIKE $${params.length} OR i.supplier ILIKE $${params.length} OR COALESCE(i.notes, '') ILIKE $${params.length})`,
      );
    }
    if (query.type) {
      params.push(query.type);
      conditions.push(`i.type = $${params.length}`);
    }
    if (query.farmId) {
      params.push(query.farmId);
      conditions.push(`i.farm_id = $${params.length}`);
    }
    if (query.stock === 'low') {
      conditions.push(`i.quantity > 0 AND i.quantity <= i.low_stock_threshold`);
    }
    if (query.stock === 'out') {
      conditions.push(`i.quantity <= 0`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (query.page - 1) * query.pageSize;

    params.push(query.pageSize);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM inputs i JOIN farms f ON f.id = i.farm_id ${whereSql}`,
      params.slice(0, -2),
    );

    const result = await pool.query<InputRow>(
      `${INPUT_SELECT}
       ${whereSql}
       ORDER BY i.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );

    return {
      items: result.rows.map(toInput),
      total: Number(countResult.rows[0].count),
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  async getById(actor: AuthUser, id: string): Promise<InventoryItem> {
    if (!isUuid.test(id)) {
      throw new AppError(404, 'This input could not be found.', 'NOT_FOUND');
    }
    const result = await pool.query<InputRow>(`${INPUT_SELECT} WHERE i.id = $1`, [id]);
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, 'This input could not be found.', 'NOT_FOUND');
    }
    const farm = await resolveFarm(row.farm_id);
    if (!farm || !(await canViewFarm(actor, farm))) {
      throw new AppError(403, "You don't have access to this input.", 'FORBIDDEN');
    }
    return toInput(row);
  },

  async create(
    actor: AuthUser,
    input: {
      farmId: string;
      name: string;
      type?: string;
      unit?: string;
      quantity?: number;
      lowStockThreshold?: number;
      unitCost?: number | null;
      supplier?: string | null;
      notes?: string | null;
    },
  ): Promise<InventoryItem> {
    const farm = await resolveFarm(input.farmId);
    if (!farm) {
      throw new AppError(404, 'This farm could not be found.', 'NOT_FOUND');
    }
    if (!(await canManageFarm(actor, farm))) {
      throw new AppError(403, "You can only add inputs to farms you manage.", 'FORBIDDEN');
    }

    const id = uid();
    await pool.query(
      `INSERT INTO inputs (id, farm_id, name, type, unit, quantity, low_stock_threshold, unit_cost, supplier, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        input.farmId,
        input.name,
        input.type ?? 'other',
        input.unit ?? 'unit',
        input.quantity ?? 0,
        input.lowStockThreshold ?? 0,
        input.unitCost ?? null,
        input.supplier ?? null,
        input.notes ?? null,
      ],
    ).catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new AppError(409, 'An input with this name already exists on this farm.', 'NAME_TAKEN');
      }
      if (isFkViolation(error)) {
        throw new AppError(400, 'Please choose a valid farm.', 'INVALID_REFERENCE');
      }
      throw error;
    });

    const result = await pool.query<InputRow>(`${INPUT_SELECT} WHERE i.id = $1`, [id]);
    logger.info(`Input added by ${actor.role}`, { inputId: id });
    return toInput(result.rows[0]);
  },

  async update(
    actor: AuthUser,
    id: string,
    input: {
      name?: string;
      type?: string;
      unit?: string;
      quantity?: number;
      lowStockThreshold?: number;
      unitCost?: number | null;
      supplier?: string | null;
      notes?: string | null;
    },
  ): Promise<InventoryItem> {
    const entry = await resolveInput(id);
    if (!entry) {
      throw new AppError(404, 'This input could not be found.', 'NOT_FOUND');
    }
    const farm = await resolveFarm(entry.farm_id);
    if (!farm || !(await canManageFarm(actor, farm))) {
      throw new AppError(403, "You can only update inputs on farms you manage.", 'FORBIDDEN');
    }

    const sets: string[] = [];
    const params: unknown[] = [];

    const fields: [keyof typeof input, string][] = [
      ['name', 'name'],
      ['type', 'type'],
      ['unit', 'unit'],
      ['quantity', 'quantity'],
      ['lowStockThreshold', 'low_stock_threshold'],
      ['unitCost', 'unit_cost'],
      ['supplier', 'supplier'],
      ['notes', 'notes'],
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
    await pool.query(`UPDATE inputs SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);

    const result = await pool.query<InputRow>(`${INPUT_SELECT} WHERE i.id = $1`, [id]);
    return toInput(result.rows[0]);
  },

  async remove(actor: AuthUser, id: string): Promise<void> {
    const entry = await resolveInput(id);
    if (!entry) {
      throw new AppError(404, 'This input could not be found.', 'NOT_FOUND');
    }
    const farm = await resolveFarm(entry.farm_id);
    if (!farm || !(await canManageFarm(actor, farm))) {
      throw new AppError(403, "You can only delete inputs on farms you manage.", 'FORBIDDEN');
    }
    await pool.query('DELETE FROM inputs WHERE id = $1', [id]);
    logger.info(`Input deleted`, { inputId: id });
  },

  async adjust(
    actor: AuthUser,
    id: string,
    input: { change: number; note?: string },
  ): Promise<InventoryItem> {
    const entry = await resolveInput(id);
    if (!entry) {
      throw new AppError(404, 'This input could not be found.', 'NOT_FOUND');
    }
    const farm = await resolveFarm(entry.farm_id);
    if (!farm || !(await canManageFarm(actor, farm))) {
      throw new AppError(403, "You can only adjust stock on farms you manage.", 'FORBIDDEN');
    }

    const current = await pool.query<{ quantity: string }>(
      `SELECT quantity FROM inputs WHERE id = $1`,
      [id],
    );
    const newQuantity = Number(current.rows[0].quantity) + input.change;
    if (newQuantity < 0) {
      throw new AppError(
        400,
        'Not enough stock on hand for this adjustment.',
        'INSUFFICIENT_STOCK',
      );
    }

    const movementId = uid();
    await pool.withTransaction(async (db) => {
      await db.query(
        `UPDATE inputs SET quantity = $1, updated_at = now() WHERE id = $2`,
        [newQuantity, id],
      );
      await db.query(
        `INSERT INTO input_movements (id, input_id, qty_change, note, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [movementId, id, input.change, input.note ?? null, actor.id],
      );
    });

    logger.info(`Stock adjusted by ${actor.role}`, { inputId: id, change: input.change });
    const result = await pool.query<InputRow>(`${INPUT_SELECT} WHERE i.id = $1`, [id]);
    return toInput(result.rows[0]);
  },

  async listMovements(
    actor: AuthUser,
    id: string,
    query: { page: number; pageSize: number },
  ) {
    const entry = await resolveInput(id);
    if (!entry) {
      throw new AppError(404, 'This input could not be found.', 'NOT_FOUND');
    }
    const farm = await resolveFarm(entry.farm_id);
    if (!farm || !(await canViewFarm(actor, farm))) {
      throw new AppError(403, "You don't have access to this input.", 'FORBIDDEN');
    }

    const offset = (query.page - 1) * query.pageSize;
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM input_movements WHERE input_id = $1`,
      [id],
    );
    const result = await pool.query<MovementRow>(
      `SELECT m.id, m.input_id, m.qty_change, m.note, m.created_by,
              u.name AS created_by_name, m.created_at
       FROM input_movements m
       LEFT JOIN users u ON u.id = m.created_by
       WHERE m.input_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, query.pageSize, offset],
    );

    return {
      items: result.rows.map(toMovement),
      total: Number(countResult.rows[0].count),
      page: query.page,
      pageSize: query.pageSize,
    };
  },
};

export type InputDraft = Parameters<typeof inventoryService.create>[1];