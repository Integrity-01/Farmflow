import type { AuthUser, UserRole } from './auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        user: AuthUser;
        sessionId: string;
      };
    }
  }
}

export {};