import { pool, uid } from '../database/pool.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { createOpaqueToken, hashToken } from '../utils/tokens.js';
import { getRolePermissions } from './permission.service.js';
import { sendEmail } from './email.service.js';
import { emailTemplates } from './email/templates.js';
import type { AuthUser } from '../types/auth.js';
import type { OrgSummary } from '../types/org.js';

interface MembershipRow {
  organization_id: string;
  org_name: string;
  role_code: string;
  membership_status: string;
}

interface SwitchRow {
  id: string;
  name: string;
  role_id: string;
  role_code: string;
  membership_status: string;
}

interface MemberRow {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role_id: string;
  role_code: string;
  role_name: string;
  status: string;
  joined_at: string | null;
  created_at: string;
}

export interface MemberItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  roleId: string;
  role: string;
  roleName: string;
  status: string;
  joinedAt: string | null;
  requestedAt: string;
}

interface InvitationRow {
  id: string;
  email: string;
  role_id: string;
  role_code: string;
  role_name: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface InvitationItem {
  id: string;
  email: string;
  roleId: string;
  role: string;
  roleName: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: number | boolean;
}

export interface RoleItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  system: boolean;
}

const MEMBER_SELECT = `
  SELECT m.id, m.user_id, u.name, u.email, u.phone, u.avatar_url,
         m.role_id, r.code AS role_code, r.name AS role_name,
         m.status, m.joined_at, m.created_at
  FROM organization_memberships m
  JOIN users u ON u.id = m.user_id
  JOIN roles r ON r.id = m.role_id
`;

function toMember(row: MemberRow): MemberItem {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    roleId: row.role_id,
    role: row.role_code,
    roleName: row.role_name,
    status: row.status,
    joinedAt: row.joined_at,
    requestedAt: row.created_at,
  };
}

function toInvitation(row: InvitationRow): InvitationItem {
  return {
    id: row.id,
    email: row.email,
    roleId: row.role_id,
    role: row.role_code,
    roleName: row.role_name,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function requireActiveOrg(actor: AuthUser): OrgSummary {
  const org = actor.currentOrg;
  if (!org) {
    throw new AppError(400, 'You are not part of any organization yet.', 'NO_ORGANIZATION');
  }
  return org;
}

async function requireOrgPermission(actor: AuthUser, permission: string): Promise<OrgSummary> {
  const org = requireActiveOrg(actor);
  if (!org.roleId) {
    throw new AppError(403, "You don't have access to this organization.", 'FORBIDDEN');
  }
  const permissions = await getRolePermissions(org.roleId);
  if (!permissions.includes(permission)) {
    throw new AppError(403, "You don't have permission to do this.", 'FORBIDDEN');
  }
  return org;
}

async function findRole(roleId: string, orgId: string): Promise<RoleRow | null> {
  const res = await pool.query<RoleRow>(
    `SELECT id, code, name, description, is_system
     FROM roles
     WHERE id = $1 AND (organization_id IS NULL OR organization_id = $2)`,
    [roleId, orgId],
  );
  return res.rows[0] ?? null;
}

async function countActiveAdmins(orgId: string): Promise<number> {
  const res = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM organization_memberships m
     JOIN roles r ON r.id = m.role_id
     WHERE m.organization_id = $1 AND m.status = 'active' AND r.code = 'organization_administrator'`,
    [orgId],
  );
  return Number(res.rows[0].count);
}

export const organizationService = {
  async listMyOrgs(userId: string): Promise<OrgSummary[]> {
    const res = await pool.query<MembershipRow>(
      `SELECT m.organization_id, o.name AS org_name, r.code AS role_code, m.status AS membership_status
       FROM organization_memberships m
       JOIN organizations o ON o.id = m.organization_id
       JOIN roles r ON r.id = m.role_id
       WHERE m.user_id = $1
       ORDER BY o.created_at`,
      [userId],
    );
    return res.rows.map((r) => ({
      id: r.organization_id,
      name: r.org_name,
      role: r.role_code,
      status: r.membership_status,
    }));
  },

  async switchOrg(actor: AuthUser, orgId: string, sessionId?: string): Promise<OrgSummary> {
    const res = await pool.query<SwitchRow>(
      `SELECT o.id, o.name, m.role_id, r.code AS role_code, m.status AS membership_status
       FROM organization_memberships m
       JOIN organizations o ON o.id = m.organization_id
       JOIN roles r ON r.id = m.role_id
       WHERE m.user_id = $1 AND o.id = $2`,
      [actor.id, orgId],
    );
    const m = res.rows[0];
    if (!m) {
      throw new AppError(
        403,
        "You don't have an active membership in that organization.",
        'FORBIDDEN',
      );
    }
    if (m.membership_status !== 'active') {
      throw new AppError(403, 'Your membership is not active.', 'MEMBERSHIP_NOT_ACTIVE');
    }
    const permissions = await getRolePermissions(m.role_id);
    if (sessionId) {
      await pool.query(
        `UPDATE sessions SET active_organization_id = $1 WHERE id = $2`,
        [orgId, sessionId],
      );
    }
    return {
      id: m.id,
      name: m.name,
      role: m.role_code,
      roleId: m.role_id,
      status: m.membership_status,
      permissions,
    };
  },

  async generateAccessKey(actor: AuthUser): Promise<{ accessKey: string }> {
    if (actor.role !== 'organization_administrator') {
      throw new AppError(403, "You don't have permission to do this.", 'FORBIDDEN');
    }
    const orgId = actor.currentOrg?.id;
    if (!orgId) {
      throw new AppError(400, 'No active organization.', 'NO_ORGANIZATION');
    }
    const key = createOpaqueToken();
    await pool.query(
      `INSERT INTO access_keys (id, organization_id, code_hash, label, created_by)
       VALUES ($1, $2, $3, 'Admin key', $4)`,
      [uid(), orgId, hashToken(key), actor.id],
    );
    return { accessKey: key };
  },

  async listRoles(actor: AuthUser): Promise<RoleItem[]> {
    const org = await requireOrgPermission(actor, 'org:view');
    const res = await pool.query<RoleRow>(
      `SELECT id, code, name, description, is_system
       FROM roles
       WHERE organization_id IS NULL OR organization_id = $1
       ORDER BY is_system DESC, code`,
      [org.id],
    );
    return res.rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      system: Boolean(row.is_system),
    }));
  },

  async listMembers(actor: AuthUser): Promise<MemberItem[]> {
    const org = await requireOrgPermission(actor, 'org:view');
    const res = await pool.query<MemberRow>(
      `${MEMBER_SELECT}
       WHERE m.organization_id = $1
       ORDER BY (m.status = 'pending') DESC, m.created_at`,
      [org.id],
    );
    return res.rows.map(toMember);
  },

  async listMemberRequests(actor: AuthUser): Promise<MemberItem[]> {
    const org = await requireOrgPermission(actor, 'member:approve');
    const res = await pool.query<MemberRow>(
      `${MEMBER_SELECT}
       WHERE m.organization_id = $1 AND m.status = 'pending'
       ORDER BY m.created_at`,
      [org.id],
    );
    return res.rows.map(toMember);
  },

  async approveMember(actor: AuthUser, membershipId: string): Promise<MemberItem> {
    const org = await requireOrgPermission(actor, 'member:approve');
    const result = await pool.query(
      `UPDATE organization_memberships
       SET status = 'active',
           joined_at = COALESCE(joined_at, now()),
           decided_by = $1,
           decided_at = now(),
           declined_reason = NULL,
           updated_at = now()
       WHERE id = $2 AND organization_id = $3 AND status = 'pending'`,
      [actor.id, membershipId, org.id],
    );
    if (result.rowCount === 0) {
      throw new AppError(404, 'This membership request could not be found.', 'NOT_FOUND');
    }
    const res = await pool.query<MemberRow>(`${MEMBER_SELECT} WHERE m.id = $1`, [membershipId]);
    return toMember(res.rows[0]);
  },

  async rejectMember(actor: AuthUser, membershipId: string, reason?: string): Promise<void> {
    const org = await requireOrgPermission(actor, 'member:approve');
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM organization_memberships
       WHERE id = $1 AND organization_id = $2 AND status = 'pending'`,
      [membershipId, org.id],
    );
    if (existing.rows.length === 0) {
      throw new AppError(404, 'This membership request could not be found.', 'NOT_FOUND');
    }
    await pool.query(
      `UPDATE organization_memberships
       SET status = 'suspended',
           decided_by = $1,
           decided_at = now(),
           declined_reason = $2,
           updated_at = now()
       WHERE id = $3`,
      [actor.id, reason ?? null, membershipId],
    );
  },

  async updateMember(
    actor: AuthUser,
    membershipId: string,
    input: { roleId?: string; status?: 'active' | 'suspended' },
  ): Promise<MemberItem> {
    const org = await requireOrgPermission(actor, 'member:manage');
    const current = await pool.query<{ user_id: string; role_id: string; status: string; role_code: string }>(
      `SELECT m.user_id, m.role_id, m.status, r.code AS role_code
       FROM organization_memberships m
       JOIN roles r ON r.id = m.role_id
       WHERE m.id = $1 AND m.organization_id = $2`,
      [membershipId, org.id],
    );
    if (current.rows.length === 0) {
      throw new AppError(404, 'This member could not be found.', 'NOT_FOUND');
    }
    const member = current.rows[0];

    let nextRoleId = member.role_id;
    let nextRoleCode = member.role_code;
    if (input.roleId !== undefined) {
      const role = await findRole(input.roleId, org.id);
      if (!role) {
        throw new AppError(400, 'Please choose a valid role.', 'INVALID_REFERENCE');
      }
      nextRoleId = role.id;
      nextRoleCode = role.code;
    }
    const nextStatus = input.status ?? member.status;

    const losingAdmin =
      member.role_code === 'organization_administrator' &&
      member.status === 'active' &&
      (nextRoleCode !== 'organization_administrator' || nextStatus !== 'active');
    if (losingAdmin && (await countActiveAdmins(org.id)) <= 1) {
      throw new AppError(
        409,
        'An organization must keep at least one active administrator.',
        'LAST_ADMIN',
      );
    }

    await pool.query(
      `UPDATE organization_memberships
       SET role_id = $1, status = $2, updated_at = now()
       WHERE id = $3`,
      [nextRoleId, nextStatus, membershipId],
    );
    const res = await pool.query<MemberRow>(`${MEMBER_SELECT} WHERE m.id = $1`, [membershipId]);
    return toMember(res.rows[0]);
  },

  async removeMember(actor: AuthUser, membershipId: string): Promise<void> {
    const org = await requireOrgPermission(actor, 'member:manage');
    const current = await pool.query<{ user_id: string; status: string; role_code: string }>(
      `SELECT m.user_id, m.status, r.code AS role_code
       FROM organization_memberships m
       JOIN roles r ON r.id = m.role_id
       WHERE m.id = $1 AND m.organization_id = $2`,
      [membershipId, org.id],
    );
    if (current.rows.length === 0) {
      throw new AppError(404, 'This member could not be found.', 'NOT_FOUND');
    }
    const member = current.rows[0];
    if (member.user_id === actor.id) {
      throw new AppError(400, 'You cannot remove yourself from the organization.', 'SELF_REMOVE');
    }
    if (
      member.role_code === 'organization_administrator' &&
      member.status === 'active' &&
      (await countActiveAdmins(org.id)) <= 1
    ) {
      throw new AppError(
        409,
        'An organization must keep at least one active administrator.',
        'LAST_ADMIN',
      );
    }
    await pool.query('DELETE FROM organization_memberships WHERE id = $1', [membershipId]);
  },

  async listInvitations(actor: AuthUser): Promise<InvitationItem[]> {
    const org = await requireOrgPermission(actor, 'member:invite');
    const res = await pool.query<InvitationRow>(
      `SELECT i.id, i.email, i.role_id, r.code AS role_code, r.name AS role_name,
              i.status, i.expires_at, i.created_at
       FROM organization_invitations i
       JOIN roles r ON r.id = i.role_id
       WHERE i.organization_id = $1 AND i.status = 'pending' AND i.expires_at > now()
       ORDER BY i.created_at DESC`,
      [org.id],
    );
    return res.rows.map(toInvitation);
  },

  async createInvitation(
    actor: AuthUser,
    input: { email: string; roleId: string },
  ): Promise<{ invitation: InvitationItem; inviteUrl: string }> {
    const org = await requireOrgPermission(actor, 'member:invite');
    const email = input.email.trim().toLowerCase();
    const role = await findRole(input.roleId, org.id);
    if (!role) {
      throw new AppError(400, 'Please choose a valid role.', 'INVALID_REFERENCE');
    }

    const token = createOpaqueToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO organization_invitations
         (id, organization_id, email, role_id, token_hash, status, invited_by, expires_at, accepted_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, NULL)
       ON DUPLICATE KEY UPDATE
         role_id = VALUES(role_id),
         token_hash = VALUES(token_hash),
         status = 'pending',
         invited_by = VALUES(invited_by),
         expires_at = VALUES(expires_at),
         accepted_at = NULL`,
      [uid(), org.id, email, role.id, tokenHash, actor.id, expiresAt],
    );

    const inviteUrl = `${env.APP_URL.replace(/\/$/, '')}/accept-invitation?token=${token}`;
    const tpl = emailTemplates.organizationInvitation(email, {
      organizationName: org.name,
      roleName: role.name,
      inviterName: actor.name,
      link: inviteUrl,
    });
    void sendEmail({ to: email, subject: tpl.subject, html: tpl.html }).catch(() => {});

    const res = await pool.query<InvitationRow>(
      `SELECT i.id, i.email, i.role_id, r.code AS role_code, r.name AS role_name,
              i.status, i.expires_at, i.created_at
       FROM organization_invitations i
       JOIN roles r ON r.id = i.role_id
       WHERE i.organization_id = $1 AND i.email = $2`,
      [org.id, email],
    );
    return { invitation: toInvitation(res.rows[0]), inviteUrl };
  },

  async revokeInvitation(actor: AuthUser, invitationId: string): Promise<void> {
    const org = await requireOrgPermission(actor, 'member:invite');
    const result = await pool.query(
      `UPDATE organization_invitations
       SET status = 'revoked'
       WHERE id = $1 AND organization_id = $2 AND status = 'pending'`,
      [invitationId, org.id],
    );
    if (result.rowCount === 0) {
      throw new AppError(404, 'This invitation could not be found.', 'NOT_FOUND');
    }
  },

  async acceptInvitation(actor: AuthUser, token: string): Promise<OrgSummary[]> {
    const res = await pool.query<{ id: string; organization_id: string; email: string; role_id: string }>(
      `SELECT id, organization_id, email, role_id
       FROM organization_invitations
       WHERE token_hash = $1 AND status = 'pending' AND expires_at > now()`,
      [hashToken(token)],
    );
    const invitation = res.rows[0];
    if (!invitation) {
      throw new AppError(400, 'This invitation is invalid or has expired.', 'INVALID_INVITATION');
    }
    if (invitation.email.toLowerCase() !== actor.email.toLowerCase()) {
      throw new AppError(403, 'This invitation was sent to a different email address.', 'INVITATION_EMAIL_MISMATCH');
    }

    await pool.query(
      `INSERT INTO organization_memberships
         (id, organization_id, user_id, role_id, status, joined_at, decided_at)
       VALUES ($1, $2, $3, $4, 'active', now(), now())
       ON DUPLICATE KEY UPDATE
         role_id = VALUES(role_id),
         status = 'active',
         joined_at = COALESCE(joined_at, now()),
         updated_at = now()`,
      [uid(), invitation.organization_id, actor.id, invitation.role_id],
    );
    await pool.query(
      `UPDATE organization_invitations SET status = 'accepted', accepted_at = now() WHERE id = $1`,
      [invitation.id],
    );

    return organizationService.listMyOrgs(actor.id);
  },

  async joinWithAccessKey(actor: AuthUser, accessKey: string): Promise<OrgSummary[]> {
    const res = await pool.query<{ id: string; organization_id: string }>(
      `SELECT id, organization_id
       FROM access_keys
       WHERE code_hash = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`,
      [hashToken(accessKey.trim())],
    );
    const key = res.rows[0];
    if (!key) {
      throw new AppError(400, 'This access key is invalid or has expired.', 'INVALID_ACCESS_KEY');
    }

    const roleRes = await pool.query<{ id: string }>(
      `SELECT id FROM roles WHERE code = 'field_officer' AND organization_id IS NULL`,
    );
    const roleId = roleRes.rows[0]?.id;
    if (!roleId) {
      throw new AppError(500, 'The field officer role is not configured.', 'ROLE_MISSING');
    }

    await pool.query(
      `INSERT INTO organization_memberships
         (id, organization_id, user_id, role_id, status)
       VALUES ($1, $2, $3, $4, 'pending')
       ON DUPLICATE KEY UPDATE updated_at = now()`,
      [uid(), key.organization_id, actor.id, roleId],
    );
    await pool.query('UPDATE access_keys SET last_used_at = now() WHERE id = $1', [key.id]);

    return organizationService.listMyOrgs(actor.id);
  },
};
