import bcrypt from 'bcryptjs';
import { pool, uid } from '../database/pool.js';
import { env } from '../config/env.js';
import { refreshCookieSameSite, refreshCookieSecure } from '../config/cookies.js';
import { AppError } from '../utils/AppError.js';
import { createOpaqueToken, hashToken } from '../utils/tokens.js';
import {
  createSystemRefreshToken,
  signSystemAccessToken,
  signSystemMfaToken,
  systemSessionTtlMs,
  verifySystemMfaToken,
} from '../utils/system-tokens.js';
import { buildOtpauthUri, generateTotpSecret, verifyTotp } from '../utils/totp.js';
import { mapSystemAdminRow, systemAdminService } from './system-admin.service.js';
import { recordAudit } from './audit.service.js';
import { sendEmail } from './email.service.js';
import { emailTemplates } from './email/templates.js';
import type { SystemAdminRow } from './system-admin.service.js';
import type { SystemAdmin, SystemAdminAuthUser } from '../types/system.js';

export const SYSTEM_REFRESH_COOKIE_NAME = 'ff_sys_refresh';

export const SYSTEM_REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: refreshCookieSameSite(),
  secure: refreshCookieSecure(),
  path: '/',
  maxAge: env.SYSTEM_ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000,
};

interface SessionAdminRow extends SystemAdminRow {
  session_id: string;
  revoked_at: Date | null;
  expires_at: Date;
  mfa_verified: number | boolean;
}

function toAuthUser(admin: SystemAdmin, mfaVerified: boolean): SystemAdminAuthUser {
  return { ...admin, mfaVerified };
}

export const systemSession = {
  /** Create a fresh session, returning the raw refresh token exactly once. */
  async create(
    systemAdminId: string,
    req: { ip?: string; userAgent?: string; mfaVerified?: boolean },
  ): Promise<{ refreshToken: string; sessionId: string; expiresAt: Date }> {
    const refreshToken = createSystemRefreshToken();
    const sessionId = uid();
    const expiresAt = new Date(Date.now() + systemSessionTtlMs());
    await pool.query(
      `INSERT INTO system_admin_sessions
         (id, system_admin_id, token_hash, mfa_verified, user_agent, ip, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sessionId,
        systemAdminId,
        hashToken(refreshToken),
        req.mfaVerified ? 1 : 0,
        req.userAgent ?? null,
        req.ip ?? null,
        expiresAt,
      ],
    );
    return { refreshToken, sessionId, expiresAt };
  },

  /**
   * Load a live session by id together with its administrator. Used by the
   * auth middleware so state (disabled, revoked, expired) is re-checked on
   * every request rather than trusted from the token.
   */
  async load(
    sessionId: string,
  ): Promise<{ admin: SystemAdmin; sessionId: string; mfaVerified: boolean } | null> {
    const result = await pool.query<SessionAdminRow>(
      `SELECT a.id, a.admin_id, a.name, a.email, a.status, a.is_owner, a.mfa_enabled,
              a.must_change_password, a.mfa_secret, a.password_hash, a.failed_login_count,
              a.locked_until, a.last_login_at, a.created_at,
              s.id AS session_id, s.revoked_at, s.expires_at, s.mfa_verified
       FROM system_admin_sessions s
       JOIN system_administrators a ON a.id = s.system_admin_id
       WHERE s.id = $1`,
      [sessionId],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (row.revoked_at || row.expires_at < new Date()) return null;
    if (row.status !== 'active') return null;
    return {
      admin: mapSystemAdminRow(row),
      sessionId: row.session_id,
      mfaVerified: Boolean(row.mfa_verified),
    };
  },

  /**
   * Rotate a refresh token. Returns a new access + refresh pair, or null when
   * the token is unknown, revoked, expired, or belongs to a disabled admin.
   */
  async rotate(
    token: string,
  ): Promise<{ admin: SystemAdmin; accessToken: string; refreshToken: string; mfaVerified: boolean } | null> {
    const hashed = hashToken(token);
    const result = await pool.query<SessionAdminRow>(
      `SELECT a.id, a.admin_id, a.name, a.email, a.status, a.is_owner, a.mfa_enabled,
              a.must_change_password, a.mfa_secret, a.password_hash, a.failed_login_count,
              a.locked_until, a.last_login_at, a.created_at,
              s.id AS session_id, s.revoked_at, s.expires_at, s.mfa_verified
       FROM system_admin_sessions s
       JOIN system_administrators a ON a.id = s.system_admin_id
       WHERE s.token_hash = $1`,
      [hashed],
    );
    const row = result.rows[0];
    if (!row || row.revoked_at || row.expires_at < new Date() || row.status !== 'active') {
      return null;
    }

    const refreshToken = createSystemRefreshToken();
    const expiresAt = new Date(Date.now() + systemSessionTtlMs());
    await pool.query(
      `UPDATE system_admin_sessions
       SET token_hash = $2, last_used_at = now(), expires_at = $3
       WHERE token_hash = $1`,
      [hashed, hashToken(refreshToken), expiresAt],
    );

    const mfaVerified = Boolean(row.mfa_verified);
    const admin = mapSystemAdminRow(row);
    const accessToken = signSystemAccessToken({
      sub: admin.id,
      sid: row.session_id,
      typ: 'system_admin',
      mfa: mfaVerified,
    });
    return { admin, accessToken, refreshToken, mfaVerified };
  },

  async revokeByToken(token: string): Promise<void> {
    await pool.query(
      `UPDATE system_admin_sessions SET revoked_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashToken(token)],
    );
  },

  async revokeAllForAdmin(systemAdminId: string): Promise<void> {
    await pool.query(
      `UPDATE system_admin_sessions SET revoked_at = now()
       WHERE system_admin_id = $1 AND revoked_at IS NULL`,
      [systemAdminId],
    );
  },
};

function accountLocked(lockedUntil: Date | null): boolean {
  return Boolean(lockedUntil && lockedUntil > new Date());
}

export const systemAuthService = {
  /**
   * Step 1 of authentication. Verifies the System Administrator ID + password.
   * When MFA is enabled a short-lived challenge token is returned instead of
   * session tokens; the session is only created after the second factor passes.
   */
  async login(
    adminIdInput: string,
    password: string,
    req: { ip?: string; userAgent?: string },
  ): Promise<
    | { mfaRequired: true; mfaToken: string }
    | { mfaRequired: false; user: SystemAdminAuthUser; accessToken: string; refreshToken: string }
  > {
    const record = await systemAdminService.findByAdminId(adminIdInput);
    // Generic error so the response never reveals whether an ID exists.
    const invalid = () =>
      new AppError(401, 'Incorrect System Administrator ID or password.', 'INVALID_CREDENTIALS');

    if (!record) throw invalid();

    if (accountLocked(record.lockedUntil)) {
      throw new AppError(
        423,
        'This account is temporarily locked after too many failed attempts. Try again later.',
        'ACCOUNT_LOCKED',
      );
    }

    const valid = await bcrypt.compare(password, record.passwordHash);
    if (!valid) {
      await systemAdminService.registerFailedLogin(record.id);
      await recordAudit({
        actorType: 'system',
        actorAdminId: record.id,
        action: 'system_admin.login_failed',
        targetType: 'system_admin',
        targetId: record.id,
        ip: req.ip ?? null,
      });
      throw invalid();
    }

    if (record.status !== 'active') {
      throw new AppError(403, 'This system administrator account is disabled.', 'ACCOUNT_DISABLED');
    }

    if (record.mfaEnabled && record.mfaSecret) {
      const mfaToken = signSystemMfaToken({ sub: record.id, sid: uid() });
      await recordAudit({
        actorType: 'system_admin',
        actorAdminId: record.id,
        action: 'system_admin.login_mfa_challenge',
        targetType: 'system_admin',
        targetId: record.id,
        ip: req.ip ?? null,
      });
      return { mfaRequired: true, mfaToken };
    }

    await systemAdminService.registerSuccessfulLogin(record.id);
    const { refreshToken, sessionId } = await systemSession.create(record.id, {
      ...req,
      mfaVerified: true,
    });
    const admin = (await systemAdminService.getById(record.id))!;
    const accessToken = signSystemAccessToken({
      sub: admin.id,
      sid: sessionId,
      typ: 'system_admin',
      mfa: true,
    });
    await recordAudit({
      actorType: 'system_admin',
      actorAdminId: record.id,
      action: 'system_admin.login',
      targetType: 'system_admin',
      targetId: record.id,
      ip: req.ip ?? null,
    });
    return { mfaRequired: false, user: toAuthUser(admin, true), accessToken, refreshToken };
  },

  /** Step 2: verify the TOTP code and issue the session. */
  async verifyMfa(
    mfaToken: string,
    code: string,
    req: { ip?: string; userAgent?: string },
  ): Promise<{ user: SystemAdminAuthUser; accessToken: string; refreshToken: string }> {
    let decoded: { sub: string; sid: string };
    try {
      decoded = verifySystemMfaToken(mfaToken);
    } catch {
      throw new AppError(401, 'Your verification session has expired. Please sign in again.', 'MFA_EXPIRED');
    }

    const record = await systemAdminService.findByAdminId(decoded.sub);
    if (!record || record.status !== 'active' || !record.mfaEnabled || !record.mfaSecret) {
      throw new AppError(401, 'This verification request is no longer valid.', 'MFA_INVALID');
    }
    if (accountLocked(record.lockedUntil)) {
      throw new AppError(423, 'This account is temporarily locked. Try again later.', 'ACCOUNT_LOCKED');
    }

    if (!verifyTotp(record.mfaSecret, code)) {
      await systemAdminService.registerFailedLogin(record.id);
      throw new AppError(401, 'That verification code is not valid.', 'MFA_INVALID_CODE');
    }

    await systemAdminService.registerSuccessfulLogin(record.id);
    const { refreshToken, sessionId } = await systemSession.create(record.id, {
      ...req,
      mfaVerified: true,
    });
    const admin = (await systemAdminService.getById(record.id))!;
    const accessToken = signSystemAccessToken({
      sub: admin.id,
      sid: sessionId,
      typ: 'system_admin',
      mfa: true,
    });
    await recordAudit({
      actorType: 'system_admin',
      actorAdminId: record.id,
      action: 'system_admin.login',
      targetType: 'system_admin',
      targetId: record.id,
      ip: req.ip ?? null,
    });
    return { user: toAuthUser(admin, true), accessToken, refreshToken };
  },

  async me(adminId: string, _sessionId: string, mfaVerified: boolean): Promise<SystemAdminAuthUser> {
    const admin = await systemAdminService.getById(adminId);
    if (!admin || admin.status !== 'active') {
      throw new AppError(401, 'Your session is no longer valid.', 'UNAUTHORIZED');
    }
    return toAuthUser(admin, mfaVerified);
  },

  async changePassword(adminId: string, currentPassword: string, newPassword: string): Promise<void> {
    const record = await systemAdminService.findByAdminId(adminId);
    if (!record) throw new AppError(404, 'System administrator not found.', 'NOT_FOUND');
    const valid = await bcrypt.compare(currentPassword, record.passwordHash);
    if (!valid) {
      throw new AppError(401, 'Your current password is incorrect.', 'INVALID_CREDENTIALS');
    }
    await systemAdminService.setPassword(adminId, newPassword, { mustChange: false });
    await recordAudit({
      actorType: 'system_admin',
      actorAdminId: adminId,
      action: 'system_admin.password_changed',
      targetType: 'system_admin',
      targetId: adminId,
    });
  },

  /** Begin MFA enrollment: store a pending secret (not yet enabled). */
  async beginMfaEnrollment(adminId: string): Promise<{ secret: string; otpauthUri: string }> {
    const admin = await systemAdminService.getById(adminId);
    if (!admin) throw new AppError(404, 'System administrator not found.', 'NOT_FOUND');
    const secret = generateTotpSecret();
    await systemAdminService.setMfa(adminId, false, secret);
    const accountName = admin.email ?? admin.adminId;
    return { secret, otpauthUri: buildOtpauthUri(env.SYSTEM_ADMIN_MFA_ISSUER, accountName, secret) };
  },

  /** Confirm enrollment with a first code, then enable MFA. */
  async confirmMfaEnrollment(adminId: string, code: string): Promise<void> {
    const record = await systemAdminService.findByAdminId(adminId);
    if (!record || !record.mfaSecret) {
      throw new AppError(400, 'Start authenticator setup before confirming.', 'MFA_NOT_STARTED');
    }
    if (!verifyTotp(record.mfaSecret, code)) {
      throw new AppError(400, 'That verification code is not valid.', 'MFA_INVALID_CODE');
    }
    await systemAdminService.setMfa(adminId, true, record.mfaSecret);
    await recordAudit({
      actorType: 'system_admin',
      actorAdminId: adminId,
      action: 'system_admin.mfa_enabled',
      targetType: 'system_admin',
      targetId: adminId,
    });
  },

  async disableMfa(adminId: string, password: string): Promise<void> {
    const record = await systemAdminService.findByAdminId(adminId);
    if (!record) throw new AppError(404, 'System administrator not found.', 'NOT_FOUND');
    const valid = await bcrypt.compare(password, record.passwordHash);
    if (!valid) {
      throw new AppError(401, 'Your current password is incorrect.', 'INVALID_CREDENTIALS');
    }
    await systemAdminService.setMfa(adminId, false, null);
    await recordAudit({
      actorType: 'system_admin',
      actorAdminId: adminId,
      action: 'system_admin.mfa_disabled',
      targetType: 'system_admin',
      targetId: adminId,
    });
  },

  /**
   * Request a password reset. Always reports success so callers cannot probe
   * which email addresses belong to system administrators.
   */
  async forgotPassword(emailInput: string): Promise<{ delivered: boolean; devResetLink?: string }> {
    const email = emailInput.trim().toLowerCase();
    const result = await pool.query<{ id: string; name: string; email: string | null }>(
      `SELECT id, name, email FROM system_administrators
       WHERE email = $1 AND status = 'active'`,
      [email],
    );
    const admin = result.rows[0];
    if (!admin || !admin.email) {
      return { delivered: false };
    }

    const rawToken = createOpaqueToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await pool.query(
      `INSERT INTO system_admin_password_resets (id, system_admin_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [uid(), admin.id, hashToken(rawToken), expiresAt],
    );

    const resetLink = `${env.APP_URL}/system/reset-password?token=${rawToken}`;
    const tpl = emailTemplates.passwordReset(admin.name, resetLink);
    const delivered = await sendEmail({ to: admin.email, subject: tpl.subject, html: tpl.html });
    await recordAudit({
      actorType: 'system',
      actorAdminId: admin.id,
      action: 'system_admin.password_reset_requested',
      targetType: 'system_admin',
      targetId: admin.id,
    });
    return {
      delivered,
      devResetLink: env.NODE_ENV !== 'production' ? resetLink : undefined,
    };
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const row = await pool.query<{ id: string; system_admin_id: string }>(
      `SELECT id, system_admin_id FROM system_admin_password_resets
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [hashToken(token)],
    );
    const reset = row.rows[0];
    if (!reset) {
      throw new AppError(400, 'This reset link is invalid or has expired.', 'INVALID_RESET_TOKEN');
    }
    await systemAdminService.setPassword(reset.system_admin_id, newPassword, { mustChange: false });
    await pool.query(
      `UPDATE system_admin_password_resets SET used_at = now() WHERE id = $1`,
      [reset.id],
    );
    await recordAudit({
      actorType: 'system',
      actorAdminId: reset.system_admin_id,
      action: 'system_admin.password_reset',
      targetType: 'system_admin',
      targetId: reset.system_admin_id,
    });
  },
};
