export type UserRole = 'administrator' | 'farm_manager' | 'supervisor' | 'field_worker';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatarUrl: string | null;
}

export const USER_ROLES: UserRole[] = [
  'administrator',
  'farm_manager',
  'supervisor',
  'field_worker',
];

const ROLE_RANK: Record<UserRole, number> = {
  administrator: 4,
  farm_manager: 3,
  supervisor: 2,
  field_worker: 1,
};

export function roleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}