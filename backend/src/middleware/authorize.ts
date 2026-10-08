import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { UserRole } from '../types/auth.js';
import { roleAtLeast } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';

export function requireRole(minimum: UserRole): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.auth?.user.role;

    if (!role) {
      next(new AppError(401, 'Please sign in to continue.', 'UNAUTHORIZED'));
      return;
    }

    if (!roleAtLeast(role, minimum)) {
      next(
        new AppError(
          403,
          "You don't have permission to do this.",
          'FORBIDDEN',
        ),
      );
      return;
    }

    next();
  };
}

export function requireRoleExactly(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.auth?.user.role;

    if (!role) {
      next(new AppError(401, 'Please sign in to continue.', 'UNAUTHORIZED'));
      return;
    }

    if (!roles.includes(role)) {
      next(
        new AppError(
          403,
          "You don't have permission to do this.",
          'FORBIDDEN',
        ),
      );
      return;
    }

    next();
  };
}