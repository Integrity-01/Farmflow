import { cn } from '@/utils/cn';
import type { UserRole } from '@/types';
import { SidebarNavItem } from './SidebarNavItem';
import type { NavGroup } from './nav';

export interface SidebarNavGroupProps {
  group: NavGroup;
  role: UserRole | null;
  collapsed?: boolean;
  onNavigate?: () => void;
}

/** A labelled cluster of related navigation links. */
export function SidebarNavGroup({ group, role, collapsed = false, onNavigate }: SidebarNavGroupProps) {
  if (group.items.length === 0) return null;

  return (
    <div className="pb-4 last:pb-0">
      {!collapsed ? (
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {group.label}
        </p>
      ) : (
        <div className="mx-auto mb-2 h-px w-6 bg-hairline" aria-hidden />
      )}
      <ul className={cn('space-y-1')}>
        {group.items.map((item) => (
          <li key={item.to}>
            <SidebarNavItem item={item} role={role} collapsed={collapsed} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  );
}
