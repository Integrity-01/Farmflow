import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../utils/AppError.js';
import { verifySystemAccessToken } from '../utils/system-tokens.js';
import { systemSession } from '../services/system-auth.service.js';

/**
 * Guards the /api/system namespace. The token is only an *identifier*: the
 * live session and administrator row are re-loaded on every request so that a
 * disabled administrator or a revoked session is rejected immediately, even if
 * their short-lived access token has not yet expired.
 */
export function requireSystemAdmin(): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        throw new AppError(401, 'Please sign in to continue.', 'UNAUTHORIZED');
      }

      let payload;
      try {
        payload = verifySystemAccessToken(header.slice(7));
      } catch {
        throw new AppError(
          401,
          'Your session has expired. Please sign in again.',
          'UNAUTHORIZED',
        );
      }

      const loaded = await systemSession.load(payload.sid);
      if (!loaded || loaded.admin.id !== payload.sub) {
        throw new AppError(401, 'Your session is no longer valid.', 'UNAUTHORIZED');
      }

      req.systemAdmin = {
        admin: loaded.admin,
        sessionId: loaded.sessionId,
        mfaVerified: loaded.mfaVerified,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Restricts an endpoint to the founding owner. Used for actions that can
 * escalate platform access (creating/updating other system administrators).
 */
export function requireSystemOwner(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.systemAdmin?.admin.isOwner) {
      next(new AppError(403, 'Only the system owner can perform this action.', 'FORBIDDEN'));
      return;
    }
    next();
  };
}
