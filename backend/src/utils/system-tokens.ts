import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Tokens for the isolated system-administrator environment. They use a distinct
 * issuer (`farmflow-system`) and a `typ` marker, and are signed with a dedicated
 * secret when configured, so a system token can never be accepted by the
 * organization `requireAuth` middleware and vice versa.
 */
export interface SystemAccessTokenPayload {
  sub: string;
  sid: string;
  typ: 'system_admin';
  mfa: boolean;
}

export const SYSTEM_ACCESS_TOKEN_TTL = '30m';
export const SYSTEM_MFA_TOKEN_TTL = '5m';
export const SYSTEM_ISSUER = 'farmflow-system';

interface SystemMfaTokenPayload {
  sub: string;
  sid: string;
  typ: 'system_admin_mfa';
}

export function systemSessionTtlMs(): number {
  return env.SYSTEM_ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000;
}

function systemSecret(): string {
  return env.SYSTEM_ADMIN_JWT_SECRET ?? env.JWT_SECRET;
}

export function createSystemRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export function signSystemAccessToken(payload: SystemAccessTokenPayload): string {
  return jwt.sign(payload, systemSecret(), {
    expiresIn: SYSTEM_ACCESS_TOKEN_TTL,
    issuer: SYSTEM_ISSUER,
  });
}

export function verifySystemAccessToken(token: string): SystemAccessTokenPayload {
  const decoded = jwt.verify(token, systemSecret(), { issuer: SYSTEM_ISSUER });
  if (typeof decoded === 'string') {
    throw new Error('Invalid system access token payload');
  }
  if (decoded.typ !== 'system_admin') {
    throw new Error('Not a system administrator token');
  }
  return {
    sub: decoded.sub as string,
    sid: decoded.sid as string,
    typ: 'system_admin',
    mfa: Boolean(decoded.mfa),
  };
}

/**
 * A short-lived token issued after a correct password when the administrator
 * has MFA enabled. It only authorises completing the MFA challenge; it can
 * never be used as an access token.
 */
export function signSystemMfaToken(payload: { sub: string; sid: string }): string {
  const full: SystemMfaTokenPayload = { ...payload, typ: 'system_admin_mfa' };
  return jwt.sign(full, systemSecret(), {
    expiresIn: SYSTEM_MFA_TOKEN_TTL,
    issuer: SYSTEM_ISSUER,
  });
}

export function verifySystemMfaToken(token: string): { sub: string; sid: string } {
  const decoded = jwt.verify(token, systemSecret(), { issuer: SYSTEM_ISSUER });
  if (typeof decoded === 'string' || decoded.typ !== 'system_admin_mfa') {
    throw new Error('Not a system MFA token');
  }
  return { sub: decoded.sub as string, sid: decoded.sid as string };
}
