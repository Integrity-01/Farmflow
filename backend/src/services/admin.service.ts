import { pool, uid } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { generateAdminId } from '../utils/admin-id.js';
import type { UserRole } from '../types/auth.js';

export interface AdminCredential {
  id: string;
  adminId: string;
  userId: string;
  organizationId: string;
  status: 'active' | 'disabled';
  createdAt: string;
}

interface CredentialRow {
  id: string;
  admin_id: string;
  user_id: string;
  organization_id: string;
  status: string;
  created_at: string;
}

function toCredential(row: CredentialRow): AdminCredential {
  return {
    id: row.id,
    adminId: row.admin_id,
    userId: row.user_id,
    organizationId: row.organization_id,
    status: row.status === 'disabled' ? 'disabled' : 'active',
    createdAt: row.created_at,
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

/**
 * Login lookup join. `id` here is the credential id, `user_id` the account.
 * Membership/role may be null when the user has no membership row.
 */
interface LoginRecordRow extends CredentialRow {
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  password_hash: string;
  is_active: boolean;
  organization_status: string;
  membership_status: string | null;
  membership_role: string | null;
}

export interface AdminLoginRecord {
  credentialId: string;
  credentialStatus: 'active' | 'disabled';
  organizationId: string;
  organizationStatus: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatarUrl: string | null;
  passwordHash: string;
  isActive: boolean;
  membershipStatus: string | null;
  membershipRole: string | null;
}

async function findByUserOrg(userId: string, orgId: string): Promise<AdminCredential | null> {
  const res = await pool.query<CredentialRow>(
    `SELECT id, admin_id, user_id, organization_id, status, created_at
     FROM administrator_login_credentials
     WHERE user_id = $1 AND organization_id = $2`,
    [userId, orgId],
  );
  return res.rows[0] ? toCredential(res.rows[0]) : null;
}

async function createCredential(userId: string, orgId: string): Promise<AdminCredential> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const adminId = generateAdminId();
    const id = uid();
    try {
      await pool.query(
        `INSERT INTO administrator_login_credentials
           (id, admin_id, user_id, organization_id)
         VALUES ($1, $2, $3, $4)`,
        [id, adminId, userId, orgId],
      );
      return {
        id,
        adminId,
        userId,
        organizationId: orgId,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        // Either the admin_id collided (retry with a new one) or another
        // request already created this user+org credential (return it).
        const existing = await findByUserOrg(userId, orgId);
        if (existing) return existing;
        continue;
      }
      throw error;
    }
  }
  throw new AppError(
    500,
    'Could not allocate an administrator ID. Please try again.',
    'ADMIN_ID_ALLOCATION_FAILED',
  );
}

export const adminService = {
  /** Return the existing credential for a user+org, or create one. */
  async ensureAdminCredential(userId: string, orgId: string): Promise<AdminCredential> {
    const existing = await findByUserOrg(userId, orgId);
    if (existing) {
      if (existing.status !== 'active') {
        await pool.query(
          `UPDATE administrator_login_credentials SET status = 'active', updated_at = now() WHERE id = $1`,
          [existing.id],
        );
        existing.status = 'active';
      }
      return existing;
    }
    return createCredential(userId, orgId);
  },

  async getCredential(userId: string, orgId: string): Promise<AdminCredential | null> {
    return findByUserOrg(userId, orgId);
  },

  /** Disable login via Admin ID (used when a member loses the admin role). */
  async disableAdminCredential(userId: string, orgId: string): Promise<void> {
    await pool.query(
      `UPDATE administrator_login_credentials
       SET status = 'disabled', updated_at = now()
       WHERE user_id = $1 AND organization_id = $2 AND status = 'active'`,
      [userId, orgId],
    );
  },

  /** Resolve an Admin ID to its administrator identity + membership context. */
  async findLoginRecord(adminId: string): Promise<AdminLoginRecord | null> {
    const res = await pool.query<LoginRecordRow>(
      `SELECT c.id, c.admin_id, c.user_id, c.organization_id, c.status, c.created_at,
              u.name, u.email, u.phone, u.role, u.avatar_url, u.password_hash, u.is_active,
              o.status AS organization_status,
              m.status AS membership_status, r.code AS membership_role
       FROM administrator_login_credentials c
       JOIN users u ON u.id = c.user_id
       JOIN organizations o ON o.id = c.organization_id
       LEFT JOIN organization_memberships m
         ON m.organization_id = c.organization_id AND m.user_id = c.user_id
       LEFT JOIN roles r ON r.id = m.role_id
       WHERE c.admin_id = $1`,
      [adminId],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      credentialId: row.id,
      credentialStatus: row.status === 'disabled' ? 'disabled' : 'active',
      organizationId: row.organization_id,
      organizationStatus: row.organization_status,
      userId: row.user_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      avatarUrl: row.avatar_url,
      passwordHash: row.password_hash,
      isActive: Boolean(row.is_active),
      membershipStatus: row.membership_status,
      membershipRole: row.membership_role,
    };
  },
};
