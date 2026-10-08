import {
  LayoutDashboard,
  ListTodo,
  UserCheck,
  Warehouse,
  Package,
  Users,
  BarChart3,
  CloudSun,
  FileText,
  History,
  Bell,
  Settings,
  Repeat,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  minRole: UserRole;
}

const ROLE_RANK: Record<UserRole, number> = {
  field_worker: 1,
  supervisor: 2,
  farm_manager: 3,
  administrator: 4,
};

export function roleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function canAccessPath(path: string, role: UserRole | null): boolean {
  if (!role) return false;
  const item = navItems.find((nav) => (nav.end ? path === nav.to : path === nav.to || path.startsWith(`${nav.to}/`)));
  if (!item) return true;
  return roleAtLeast(role, item.minRole);
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, minRole: 'field_worker' },
  { to: '/tasks', label: 'Tasks', icon: ListTodo, minRole: 'field_worker' },
  { to: '/my-tasks', label: 'My Tasks', icon: UserCheck, minRole: 'field_worker' },
  { to: '/recurring-tasks', label: 'Recurring', icon: Repeat, minRole: 'supervisor' },
  { to: '/farms', label: 'Farms', icon: Warehouse, minRole: 'farm_manager' },
  { to: '/inventory', label: 'Inventory', icon: Package, minRole: 'farm_manager' },
  { to: '/workers', label: 'Workers', icon: Users, minRole: 'farm_manager' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, minRole: 'farm_manager' },
  { to: '/weather', label: 'Weather', icon: CloudSun, minRole: 'farm_manager' },
  { to: '/assistant', label: 'AI Assistant', icon: Sparkles, minRole: 'farm_manager' },
  { to: '/reports', label: 'Reports', icon: FileText, minRole: 'farm_manager' },
  { to: '/history', label: 'History', icon: History, minRole: 'farm_manager' },
  { to: '/notifications', label: 'Notifications', icon: Bell, minRole: 'field_worker' },
  { to: '/settings', label: 'Settings', icon: Settings, minRole: 'field_worker' },
];