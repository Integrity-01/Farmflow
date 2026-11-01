import { pool } from '../database/pool.js';
import type { AuthUser, UserRole } from '../types/auth.js';
import { USER_ROLES, roleAtLeast } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';
import { getRolePermissions } from './permission.service.js';

export interface OrgContext {
  organizationId: string;
  roleId: string;
  role: UserRole;
}

function normalizeRole(value: string | undefined, fallback: UserRole): UserRole {
  return USER_ROLES.includes(value as UserRole) ? (value as UserRole) : fallback;
}

export function requireOrgContext(actor: AuthUser): OrgContext {
  const org = actor.currentOrg;
  if (!org?.id || !org.roleId) {
    throw new AppError(
      403,
      'Select an organization before using financial features.',
      'NO_ORGANIZATION',
    );
  }
  return {
    organizationId: org.id,
    roleId: org.roleId,
    role: normalizeRole(org.role, actor.role),
  };
}

export async function hasPermission(actor: AuthUser, code: string): Promise<boolean> {
  const { roleId } = requireOrgContext(actor);
  const permissions = await getRolePermissions(roleId);
  return permissions.includes(code);
}

export async function assertPermission(actor: AuthUser, code: string): Promise<void> {
  if (!(await hasPermission(actor, code))) {
    throw new AppError(403, "You don't have permission to do this.", 'FORBIDDEN');
  }
}

/**
 * SQL condition (on the `farms` alias) that limits rows to the active
 * organization and to the farms the member may see under their org role.
 */
export function farmScope(
  actor: AuthUser,
  alias = 'f',
): { clause: string; params: unknown[] } {
  const { organizationId, role } = requireOrgContext(actor);
  const params: unknown[] = [organizationId];
  let clause = `${alias}.organization_id = ?`;

  if (!roleAtLeast(role, 'farm_manager')) {
    if (role === 'supervisor') {
      clause += ` AND (${alias}.manager_id = ? OR ${alias}.id IN (SELECT farm_id FROM workers WHERE user_id = ?))`;
      params.push(actor.id, actor.id);
    } else {
      clause += ` AND ${alias}.id IN (SELECT farm_id FROM workers WHERE user_id = ?)`;
      params.push(actor.id);
    }
  }

  return { clause, params };
}

export async function accessibleFarmIds(actor: AuthUser): Promise<string[]> {
  const { clause, params } = farmScope(actor);
  const result = await pool.query<{ id: string }>(
    `SELECT f.id FROM farms f WHERE ${clause}`,
    params,
  );
  return result.rows.map((row) => row.id);
}

export interface AccessibleFarm {
  id: string;
  name: string;
  manager_id: string | null;
  size: string | number | null;
  size_unit: string | null;
}

export async function assertFarmAccess(
  actor: AuthUser,
  farmId: string,
): Promise<AccessibleFarm> {
  const { clause, params } = farmScope(actor);
  const result = await pool.query<AccessibleFarm>(
    `SELECT f.id, f.name, f.manager_id, f.size, f.size_unit
     FROM farms f
     WHERE f.id = ? AND ${clause}`,
    [farmId, ...params],
  );
  const farm = result.rows[0];
  if (!farm) {
    throw new AppError(404, 'Farm not found.', 'NOT_FOUND');
  }
  return farm;
}

export async function assertFieldAccess(
  actor: AuthUser,
  farmId: string,
  fieldId: string,
): Promise<void> {
  const { organizationId } = requireOrgContext(actor);
  const result = await pool.query<{ id: string }>(
    `SELECT fl.id
     FROM fields fl
     JOIN farms f ON f.id = fl.farm_id
     WHERE fl.id = ? AND fl.farm_id = ? AND f.organization_id = ?`,
    [fieldId, farmId, organizationId],
  );
  if (result.rows.length === 0) {
    throw new AppError(400, 'The selected field does not belong to this farm.', 'INVALID_REFERENCE');
  }
}

export async function assertTaskAccess(
  actor: AuthUser,
  taskId: string,
  farmId: string,
): Promise<void> {
  const { organizationId } = requireOrgContext(actor);
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM tasks WHERE id = ? AND farm_id = ? AND organization_id = ?`,
    [taskId, farmId, organizationId],
  );
  if (result.rows.length === 0) {
    throw new AppError(400, 'The selected task does not belong to this farm.', 'INVALID_REFERENCE');
  }
}
