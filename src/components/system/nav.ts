import {
  BarChart3,
  Building2,
  HeartPulse,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldHalf,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface SystemNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
}

export interface SystemNavGroup {
  label: string;
  items: SystemNavItem[];
}

export const SYSTEM_NAV: SystemNavGroup[] = [
  {
    label: 'Platform',
    items: [
      { to: '/system/overview', label: 'Overview', icon: LayoutDashboard },
      { to: '/system/organizations', label: 'Organizations', icon: Building2 },
      { to: '/system/users', label: 'Users', icon: Users },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { to: '/system/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/system/audit-logs', label: 'Audit Logs', icon: ScrollText },
      { to: '/system/health', label: 'System Health', icon: HeartPulse },
    ],
  },
  {
    label: 'Governance',
    items: [
      { to: '/system/administrators', label: 'Administrators', icon: ShieldHalf, ownerOnly: true },
      { to: '/system/settings', label: 'Account', icon: Settings },
    ],
  },
];
