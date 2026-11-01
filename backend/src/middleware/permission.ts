import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { getRolePermissions } from '../services/permission.service.js';
import { AppError } from '../utils/AppError.js';

/**
 * Allows the request when the member's role in the active organization grants
 * at least one of the supplied permission codes. Financial endpoints never rely
 * on a client-supplied organization or role.
 */
export function requirePermission(...codes: string[]): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.auth?.user;
      if (!user) {
        throw new AppError(401, 'Please sign in to continue.', 'UNAUTHORIZED');
      }

      const roleId = user.currentOrg?.roleId;
      if (!user.currentOrg?.id || !roleId) {
        throw new AppError(
          403,
          'Select an organization before using financial features.',
          'NO_ORGANIZATION',
        );
      }

      const permissions = await getRolePermissions(roleId);
      if (!codes.some((code) => permissions.includes(code))) {
        throw new AppError(403, "You don't have permission to do this.", 'FORBIDDEN');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
