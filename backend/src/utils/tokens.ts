import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { UserRole } from '../types/auth.js';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  sid: string;
}

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 7;

export const ACCESS_TOKEN_TTL = '15m';

export function createRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export function createOpaqueToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
    issuer: 'farmflow',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: 'farmflow' });
  if (typeof decoded === 'string') {
    throw new Error('Invalid access token payload');
  }
  return {
    sub: decoded.sub as string,
    role: decoded.role as UserRole,
    sid: decoded.sid as string,
  };
}