import type { AuthUser } from './auth.js';
import type { SystemAdmin } from './system.js';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        user: AuthUser;
        sessionId: string;
      };
      systemAdmin?: {
        admin: SystemAdmin;
        sessionId: string;
        mfaVerified: boolean;
      };
    }
  }
}

export {};
