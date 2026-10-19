import bcrypt from 'bcryptjs';
import { pool, uid } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { generateSystemAdminId, normalizeSystemAdminId } from '../utils/system-admin-id.js';
import { generateTemporaryPassword } from '../utils/password.js';
import { env } from '../config/env.js';
import type { SystemAdmin } from '../types/system.js';

export interface SystemAdminRow {
  id: string;
  admin_id: string;
  name: string;
  email: string | null;
  status: string;
  is_owner: number | boolean;
  mfa_enabled: number | boolean;
  must_change_password: number | boolean;
  mfa_secret: string | null;
  password_hash: string;
  failed_login_count: number;
  locked_until: Date | string | null;
  last_login_at: Date | string | null;
  created_at: Date | string;
}

export interface SystemAdminLoginRecord {
  id: string;
  adminId: string;
  name: string;
  email: string | null;
  status: 'active' | 'disabled';
  isOwner: boolean;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  mfaSecret: string | null;
  passwordHash: string;
  failedLoginCount: number;
  lockedUntil: Date | null;
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function isoOrNull(value: Date | string | null | undefined): string | null {
  const date = asDate(value);
  return date ? date.toISOString() : null;
}

export function mapSystemAdminRow(row: SystemAdminRow): SystemAdmin {
  return {
    id: row.id,
    adminId: row.admin_id,
    name: row.name,
    email: row.email,
    status: row.status === 'disabled' ? 'disabled' : 'active',
    isOwner: Boolean(row.is_owner),
    mfaEnabled: Boolean(row.mfa_enabled),
    mustChangePassword: Boolean(row.must_change_password),
    lastLoginAt: isoOrNull(row.last_login_at),
    createdAt: isoOrNull(row.created_at) ?? new Date().toISOString(),
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (('code' in error && (error as { code?: string }).code === 'ER_DUP_ENTRY') ||
      ('errno' in error && (error as { errno?: number }).errno === 1062))
  );
}

/** Re-exported so controllers can hand a generated password back exactly once. */
export { generateTemporaryPassword };

const SELECT_COLUMNS = `
  id, admin_id, name, email, status, is_owner, mfa_enabled, must_change_password,
  mfa_secret, password_hash, failed_login_count, locked_until, last_login_at, created_at
`;

export const systemAdminService = {
  async countOwners(): Promise<number> {
    const res = await pool.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM system_administrators WHERE is_owner = 1 AND status = 'active'`,
    );
    return Number(res.rows[0]?.n ?? 0);
  },

  async getById(id: string): Promise<SystemAdmin | null> {
    const res = await pool.query<SystemAdminRow>(
      `SELECT ${SELECT_COLUMNS} FROM system_administrators WHERE id = $1`,
      [id],
    );
    return res.rows[0] ? mapSystemAdminRow(res.rows[0]) : null;
  },

  async findByAdminId(adminIdInput: string): Promise<SystemAdminLoginRecord | null> {
    const adminId = normalizeSystemAdminId(adminIdInput);
    const res = await pool.query<SystemAdminRow>(
      `SELECT ${SELECT_COLUMNS} FROM system_administrators WHERE admin_id = $1`,
      [adminId],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      adminId: row.admin_id,
      name: row.name,
      email: row.email,
      status: row.status === 'disabled' ? 'disabled' : 'active',
      isOwner: Boolean(row.is_owner),
      mfaEnabled: Boolean(row.mfa_enabled),
      mustChangePassword: Boolean(row.must_change_password),
      mfaSecret: row.mfa_secret,
      passwordHash: row.password_hash,
      failedLoginCount: Number(row.failed_login_count ?? 0),
      lockedUntil: asDate(row.locked_until),
    };
  },

  async listAdmins(): Promise<SystemAdmin[]> {
    const res = await pool.query<SystemAdminRow>(
      `SELECT ${SELECT_COLUMNS} FROM system_administrators
       ORDER BY is_owner DESC, created_at ASC`,
    );
    return res.rows.map(mapSystemAdminRow);
  },

  /**
   * Create a system administrator. Passwords are hashed with bcrypt. The caller
   * may supply a password; otherwise a strong temporary one is generated and
   * returned once so it can be handed to the administrator out of band.
   */
  async create(input: {
    name: string;
    email?: string | null;
    password?: string;
    isOwner?: boolean;
    createdBy?: string | null;
  }): Promise<{ admin: SystemAdmin; temporaryPassword: string | null; generatedPassword: boolean }> {
    const name = input.name.trim();
    if (!name) {
      throw new AppError(400, 'A name is required.', 'VALIDATION_ERROR');
    }
    const email = input.email?.trim().toLowerCase() || null;
    const generatedPassword = !input.password;
    const password = input.password ?? generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(password, 10);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const adminId = generateSystemAdminId();
      const id = uid();
      try {
        await pool.query(
          `INSERT INTO system_administrators
             (id, admin_id, name, email, password_hash, is_owner, must_change_password, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            id,
            adminId,
            name,
            email,
            passwordHash,
            input.isOwner ? 1 : 0,
            generatedPassword ? 1 : 0,
            input.createdBy ?? null,
          ],
        );
        const admin = await this.getById(id);
        if (!admin) {
          throw new AppError(500, 'Could not create the system administrator.', 'CREATE_FAILED');
        }
        return {
          admin,
          temporaryPassword: generatedPassword ? password : null,
          generatedPassword,
        };
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          // A unique email is a real conflict; an Admin ID collision is retried.
          if (email) {
            const existing = await pool.query<{ id: string }>(
              `SELECT id FROM system_administrators WHERE email = $1`,
              [email],
            );
            if (existing.rows[0]) {
              throw new AppError(
                409,
                'A system administrator with that email already exists.',
                'EMAIL_TAKEN',
              );
            }
          }
          continue;
        }
        throw error;
      }
    }
    throw new AppError(
      500,
      'Could not allocate a System Administrator ID. Please try again.',
      'ADMIN_ID_ALLOCATION_FAILED',
    );
  },

  async setStatus(id: string, status: 'active' | 'disabled'): Promise<void> {
    await pool.query(
      `UPDATE system_administrators SET status = $2, updated_at = now() WHERE id = $1`,
      [id, status],
    );
    if (status === 'disabled') {
      await pool.query(
        `UPDATE system_admin_sessions SET revoked_at = now()
         WHERE system_admin_id = $1 AND revoked_at IS NULL`,
        [id],
      );
    }
  },

  async setPassword(id: string, password: string, options: { mustChange?: boolean } = {}): Promise<void> {
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      `UPDATE system_administrators
       SET password_hash = $2, must_change_password = $3, failed_login_count = 0,
           locked_until = NULL, updated_at = now()
       WHERE id = $1`,
      [id, passwordHash, options.mustChange ? 1 : 0],
    );
    // Changing a password invalidates every existing session.
    await pool.query(
      `UPDATE system_admin_sessions SET revoked_at = now()
       WHERE system_admin_id = $1 AND revoked_at IS NULL`,
      [id],
    );
  },

  async setMfa(id: string, enabled: boolean, secret: string | null): Promise<void> {
    await pool.query(
      `UPDATE system_administrators SET mfa_enabled = $2, mfa_secret = $3, updated_at = now() WHERE id = $1`,
      [id, enabled ? 1 : 0, secret],
    );
  },

  async updateProfile(id: string, input: { name: string; email?: string | null }): Promise<SystemAdmin> {
    const name = input.name.trim();
    if (!name) {
      throw new AppError(400, 'A name is required.', 'VALIDATION_ERROR');
    }
    const email = input.email?.trim().toLowerCase() || null;
    try {
      await pool.query(
        `UPDATE system_administrators SET name = $2, email = $3, updated_at = now() WHERE id = $1`,
        [id, name, email],
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AppError(409, 'That email is already in use.', 'EMAIL_TAKEN');
      }
      throw error;
    }
    const admin = await this.getById(id);
    if (!admin) throw new AppError(404, 'System administrator not found.', 'NOT_FOUND');
    return admin;
  },

  /** Record a failed login and lock the account after too many attempts. */
  async registerFailedLogin(id: string): Promise<void> {
    await pool.query(
      `UPDATE system_administrators
       SET failed_login_count = failed_login_count + 1,
           locked_until = CASE
             WHEN failed_login_count + 1 >= $2 THEN DATE_ADD(now(), INTERVAL $3 MINUTE)
             ELSE locked_until
           END,
           updated_at = now()
       WHERE id = $1`,
      [id, env.SYSTEM_ADMIN_MAX_FAILED_LOGINS, env.SYSTEM_ADMIN_LOCK_MINUTES],
    );
  },

  async registerSuccessfulLogin(id: string): Promise<void> {
    await pool.query(
      `UPDATE system_administrators
       SET failed_login_count = 0, locked_until = NULL, last_login_at = now(), updated_at = now()
       WHERE id = $1`,
      [id],
    );
  },
};
