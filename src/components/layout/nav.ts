import {
  LayoutDashboard,
  ListTodo,
  UserCheck,
  Repeat,
  Warehouse,
  Package,
  Users,
  BarChart3,
  CloudSun,
  Sparkles,
  FileText,
  History,
  UserCog,
  Bell,
  Settings,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types';

/**
 * A single sidebar navigation destination.
 *
 * Visibility is expressed as:
 *  - `minRole`     — minimum role rank, mirroring the backend route guards.
 *  - `permissions` — any-of permission codes held by the member's role. Used to
 *                    restrict custom roles that do not inherit a built-in role.
 *
 * The sidebar is a presentation layer only; the API independently enforces
 * every protected action.
 */
export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Match the path exactly (used for index-style routes such as /dashboard). */
  end?: boolean;
  /** Any-of permission codes that grant access. Omit for personal pages. */
  permissions?: string[];
  /** Minimum role rank required, mirroring backend route authorization. */
  minRole?: UserRole;
  /** Optional per-role label overrides, e.g. "My Farms" for field officers. */
  labels?: Partial<Record<UserRole, string>>;
  /** Render as non-interactive when true. */
  disabled?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ROLE_RANK: Record<UserRole, number> = {
  field_officer: 1,
  supervisor: 2,
  farm_manager: 3,
  organization_administrator: 4,
};

export function roleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Human-readable role label that also handles custom role codes. */
export function formatRoleLabel(role: string | null | undefined): string {
  if (!role) return 'Member';
  return role
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function navLabel(item: NavItem, role: UserRole | null): string {
  if (role && item.labels?.[role]) return item.labels[role] as string;
  return item.label;
}

/**
 * Navigation grouped by purpose. Groups are ordered; empty groups are dropped
 * when a user lacks access to every item inside them.
 */
export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', end: true, label: 'Dashboard', icon: LayoutDashboard, minRole: 'field_officer' },
    ],
  },
  {
    label: 'Work',
    items: [
      {
        to: '/tasks',
        label: 'Tasks',
        icon: ListTodo,
        minRole: 'field_officer',
        permissions: ['task:view'],
        labels: { field_officer: 'Field Activities' },
      },
      { to: '/my-tasks', label: 'My Tasks', icon: UserCheck, minRole: 'field_officer', permissions: ['task:view'] },
      { to: '/recurring-tasks', label: 'Recurring Tasks', icon: Repeat, minRole: 'supervisor', permissions: ['task:create'] },
    ],
  },
  {
    label: 'Farm',
    items: [
      {
        to: '/farms',
        label: 'Farms & Fields',
        icon: Warehouse,
        minRole: 'field_officer',
        permissions: ['farm:view'],
        labels: { field_officer: 'My Farms', supervisor: 'My Farms' },
      },
      { to: '/inventory', label: 'Inventory', icon: Package, minRole: 'supervisor', permissions: ['inventory:view'] },
      { to: '/workers', label: 'Workers', icon: Users, minRole: 'supervisor', permissions: ['worker:view'] },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/analytics', label: 'Analytics', icon: BarChart3, minRole: 'farm_manager', permissions: ['analytics:view'] },
      { to: '/weather', label: 'Weather', icon: CloudSun, minRole: 'field_officer', permissions: ['weather:view'] },
      { to: '/assistant', label: 'AI Assistant', icon: Sparkles, minRole: 'farm_manager', permissions: ['ai:use'] },
      { to: '/reports', label: 'Reports', icon: FileText, minRole: 'farm_manager', permissions: ['report:view'] },
      { to: '/history', label: 'History', icon: History, minRole: 'farm_manager', permissions: ['history:view'] },
    ],
  },
  {
    label: 'Organization',
    items: [
      {
        to: '/team',
        label: 'Team & Users',
        icon: UserCog,
        minRole: 'farm_manager',
        permissions: ['member:invite', 'member:approve', 'member:manage', 'role:manage', 'access_key:manage'],
      },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/notifications', label: 'Notifications', icon: Bell, minRole: 'field_officer' },
      { to: '/profile', label: 'My Profile', icon: UserRound, minRole: 'field_officer' },
      { to: '/settings', label: 'Settings', icon: Settings, minRole: 'field_officer' },
    ],
  },
];

/** Flat list of every navigation item, in display order. */
export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);

/** Returns the nav item that owns a path, if any. */
export function matchNavItem(path: string): NavItem | undefined {
  return navItems.find((item) =>
    item.end ? path === item.to : path === item.to || path.startsWith(`${item.to}/`),
  );
}

/**
 * Decide whether a navigation item is visible for a user.
 *
 * - Rank is always enforced when `minRole` is set.
 * - When the member's permission list is known, any-of `permissions` is also
 *   required — this keeps custom roles scoped to what they were granted.
 * - When permissions are unknown (e.g. a persisted session before the API
 *   responds), the rank gate alone decides so the shell still renders.
 */
export function canSeeNavItem(
  item: NavItem,
  role: UserRole | null,
  permissions?: string[] | null,
): boolean {
  if (!role) return false;
  if (item.minRole && !roleAtLeast(role, item.minRole)) return false;
  if (item.permissions && item.permissions.length > 0 && Array.isArray(permissions)) {
    return item.permissions.some((permission) => permissions.includes(permission));
  }
  return true;
}

/** Navigation groups with inaccessible items removed and empty groups dropped. */
export function visibleNavGroups(role: UserRole | null, permissions?: string[] | null): NavGroup[] {
  return navGroups
    .map((group) => ({
      label: group.label,
      items: group.items.filter((item) => canSeeNavItem(item, role, permissions)),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Route guard for direct URL access. Unknown paths are allowed through (they
 * resolve to NotFound or a page not represented in the sidebar); known paths
 * must pass the same visibility rules as the sidebar.
 */
export function canAccessPath(
  path: string,
  role: UserRole | null,
  permissions?: string[] | null,
): boolean {
  if (!role) return false;
  const item = matchNavItem(path);
  if (!item) return true;
  return canSeeNavItem(item, role, permissions);
}
