import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { pool } from '../database/pool.js';
import type { AuthUser, UserRole } from '../types/auth.js';
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

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatar_url,
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