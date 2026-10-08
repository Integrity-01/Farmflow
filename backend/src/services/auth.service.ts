import bcrypt from 'bcryptjs';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import {
  createOpaqueToken,
  createRefreshToken,
  hashToken,
  REFRESH_TOKEN_TTL_DAYS,
  signAccessToken,
} from '../utils/tokens.js';
import { env } from '../config/env.js';
import { sendEmail } from './email.service.js';
import { emailTemplates } from './email/templates.js';
import { pool, uid } from '../database/pool.js';
import type { AuthUser, UserRole } from '../types/auth.js';

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  password_hash: string;
  is_active: boolean;
}

// Row from `sessions s JOIN users u`: `id` is the SESSION id, `user_id` the
// account — never pass this straight to toAuthUser (see rotate()).
interface SessionJoinRow {
  id: string;
  user_id: string;
  revoked_at: Date | null;
  expires_at: Date;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  password_hash: string;
  is_active: boolean;
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    avatarUrl: row.avatar_url,
  };
}

const REFRESH_COOKIE_NAME = 'ff_refresh';

export const authSession = {
  REFRESH_COOKIE_NAME,

  async createSession(userId: string, req: { ip?: string; userAgent?: string }) {
    const refreshToken = createRefreshToken();
    const sessionId = uid();
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    await pool.query(
      `INSERT INTO sessions (id, user_id, token_hash, user_agent, ip, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sessionId, userId, hashToken(refreshToken), req.userAgent, req.ip, expiresAt],
    );
    return { refreshToken, sessionId };
  },

  async revokeSessionByToken(token: string) {
    await pool.query(
      `UPDATE sessions
       SET revoked_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashToken(token)],
    );
  },

  async revokeAllForUser(userId: string, db: { query: typeof pool.query } = pool) {
    await db.query(
      `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  },

  async rotate(token: string) {
    const hashed = hashToken(token);
    const result = await pool.query<SessionJoinRow>(
      `SELECT s.id, s.user_id, s.revoked_at, s.expires_at,
              u.name, u.email, u.phone, u.role, u.avatar_url, u.password_hash, u.is_active
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1`,
      [hashed],
    );

    const session = result.rows[0];
    if (!session || session.revoked_at || session.expires_at < new Date()) {
      return null;
    }
    if (!session.is_active) {
      return null;
    }

    const refreshToken = createRefreshToken();
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await pool.query(
      `UPDATE sessions
       SET token_hash = $2, last_used_at = now(), expires_at = $3
       WHERE token_hash = $1`,
      [hashed, hashToken(refreshToken), expiresAt],
    );

    const user = toAuthUser({ ...session, id: session.user_id });
    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      sid: session.id,
    });

    return { user, accessToken, refreshToken };
  },
};

async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `SELECT id, name, email, phone, role, avatar_url, password_hash, is_active
     FROM users
     WHERE email = $1`,
    [email],
  );
  return result.rows[0] ?? null;
}

export const authService = {
  async register(
    input: { name: string; email: string; password: string; phone?: string },
    req: { ip?: string; userAgent?: string },
  ): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();

    const existing = await findUserByEmail(email);
    if (existing) {
      throw new AppError(409, 'An account with this email already exists.', 'EMAIL_TAKEN');
    }

    const countResult = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
    const isFirstUser = Number(countResult.rows[0].count) === 0;
    const role: UserRole = isFirstUser ? 'administrator' : 'field_worker';

    const passwordHash = await bcrypt.hash(input.password, 10);
    const id = uid();
    await pool.query(
      `INSERT INTO users (id, name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, input.name.trim(), email, input.phone?.trim() || null, passwordHash, role],
    );
    const user = toAuthUser({ id, name: input.name.trim(), email, phone: input.phone?.trim() || null, role, avatar_url: null, password_hash: passwordHash, is_active: true });
    const { refreshToken, sessionId } = await authSession.createSession(user.id, req);

    await pool.query(
      `INSERT IGNORE INTO notification_preferences (user_id) VALUES ($1)`,
      [user.id],
    );

    const accessToken = signAccessToken({ sub: user.id, role: user.role, sid: sessionId });

    const welcome = emailTemplates.welcome(user.name);
    sendEmail({ to: user.email, subject: welcome.subject, html: welcome.html }).catch(() => {});

    return { user, accessToken, refreshToken };
  },

  async login(
    emailInput: string,
    password: string,
    req: { ip?: string; userAgent?: string },
  ): Promise<AuthResult> {
    const email = emailInput.trim().toLowerCase();
    const user = await findUserByEmail(email);

    const valid = user && (await bcrypt.compare(password, user.password_hash));
    if (!user || !valid) {
      throw new AppError(401, 'Incorrect email or password.', 'INVALID_CREDENTIALS');
    }

    if (!user.is_active) {
      throw new AppError(403, 'This account has been disabled.', 'ACCOUNT_DISABLED');
    }

    await pool.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);

    const { refreshToken, sessionId } = await authSession.createSession(user.id, req);
    const authUser = toAuthUser(user);
    const accessToken = signAccessToken({ sub: user.id, role: user.role, sid: sessionId });

    return { user: authUser, accessToken, refreshToken };
  },

  async me(userId: string): Promise<AuthUser> {
    const result = await pool.query<UserRow>(
      `SELECT id, name, email, phone, role, avatar_url, password_hash, is_active
       FROM users WHERE id = $1`,
      [userId],
    );
    const user = result.rows[0];
    if (!user || !user.is_active) {
      throw new AppError(401, 'Your account is no longer active.', 'UNAUTHORIZED');
    }
    return toAuthUser(user);
  },

  async forgotPassword(emailInput: string): Promise<{ delivered: boolean; devResetLink?: string }> {
    const email = emailInput.trim().toLowerCase();
    const user = await findUserByEmail(email);

    if (!user) {
      return { delivered: false };
    }

    const rawToken = createOpaqueToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, hashToken(rawToken), expiresAt],
    );

    const resetLink = `${env.APP_URL}/reset-password?token=${rawToken}`;
    const tpl = emailTemplates.passwordReset(user.name, resetLink);
    const delivered = await sendEmail({ to: user.email, subject: tpl.subject, html: tpl.html });

    logger.info(`Password reset requested for ${email}.`, { delivered });

    return {
      delivered,
      devResetLink: env.NODE_ENV !== 'production' ? resetLink : undefined,
    };
  },

  async resetPassword(token: string, password: string) {
    const tokenRow = await pool.query<{ id: string; user_id: string }>(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [hashToken(token)],
    );

    if (tokenRow.rows.length === 0) {
      throw new AppError(400, 'This reset link is invalid or has expired.', 'INVALID_RESET_TOKEN');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.withTransaction(async (db) => {
      await db.query(
        `UPDATE users SET password_hash = $1, last_login_at = NULL WHERE id = $2`,
        [passwordHash, tokenRow.rows[0].user_id],
      );
      await db.query(
        `UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`,
        [tokenRow.rows[0].id],
      );
      await db.query(
        `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
        [tokenRow.rows[0].user_id],
      );
    });
  },
};

// Attach bearer refresh cookie helper metadata
export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
  path: '/',
  maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};