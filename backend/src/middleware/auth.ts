import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { pool } from '../database/pool.js';
import type { AuthUser, UserRole } from '../types/auth.js';
import type { OrgSummary } from '../types/org.js';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/tokens.js';

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
}

interface MembershipRow {
  organization_id: string;
  org_name: string;
  role_id: string;
  role_code: string;
  status: string;
}

async function loadOrgs(userId: string): Promise<OrgSummary[]> {
  const result = await pool.query<MembershipRow>(
    `SELECT m.organization_id, o.name AS org_name, m.role_id, r.code AS role_code, m.status
     FROM organization_memberships m
     JOIN organizations o ON o.id = m.organization_id
     JOIN roles r ON r.id = m.role_id
     WHERE m.user_id = $1
     ORDER BY o.created_at`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.organization_id,
    name: row.org_name,
    role: row.role_code,
    roleId: row.role_id,
    status: row.status,
  }));
}

async function resolveUser(payload: { sub: string; role: UserRole; sid: string }) {
  const result = await pool.query<UserRow>(
    `SELECT id, name, email, phone, role, avatar_url, is_active
     FROM users
     WHERE id = $1`,
    [payload.sub],
  );

  const user = result.rows[0];
  if (!user || !user.is_active) {
    return null;
  }

  const orgs = await loadOrgs(user.id);

  const sessionRes = await pool.query<{ active_organization_id: string | null }>(
    `SELECT active_organization_id FROM sessions WHERE id = $1 AND revoked_at IS NULL`,
    [payload.sid],
  );
  const activeId = sessionRes.rows[0]?.active_organization_id ?? null;
  const currentOrg =
    orgs.find((org) => org.id === activeId && org.status === 'active') ??
    orgs.find((org) => org.status === 'active') ??
    null;

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatar_url,
    orgs,
    currentOrg,
  };

  return { user: authUser, sessionId: payload.sid };
}

export function requireAuth(): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        throw new AppError(401, 'Please sign in to continue.', 'UNAUTHORIZED');
      }

      let payload;
      try {
        payload = verifyAccessToken(header.slice(7));
      } catch {
        throw new AppError(
          401,
          'Your session has expired. Please sign in again.',
          'UNAUTHORIZED',
        );
      }

      const resolved = await resolveUser(payload);
      if (!resolved) {
        throw new AppError(401, 'Your account is no longer active.', 'UNAUTHORIZED');
      }

      req.auth = resolved;
      next();
    } catch (error) {
      next(error);
    }
  };
}