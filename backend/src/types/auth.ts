import type { OrgSummary } from './org.js';

export type UserRole =
  | 'organization_administrator'
  | 'farm_manager'
  | 'supervisor'
  | 'field_officer';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatarUrl: string | null;
  currentOrg?: OrgSummary | null;
  orgs?: OrgSummary[];
}

export const USER_ROLES: UserRole[] = [
  'organization_administrator',
  'farm_manager',
  'supervisor',
  'field_officer',
];

const ROLE_RANK: Record<UserRole, number> = {
  organization_administrator: 4,
  farm_manager: 3,
  supervisor: 2,
  field_officer: 1,
};

export function roleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
