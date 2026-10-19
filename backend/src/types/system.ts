export type SystemAdminStatus = 'active' | 'disabled';

/** A platform-level system administrator identity (never an organization user). */
export interface SystemAdmin {
  id: string;
  adminId: string;
  name: string;
  email: string | null;
  status: SystemAdminStatus;
  isOwner: boolean;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SystemAdminAuthUser extends SystemAdmin {
  mfaVerified: boolean;
}
