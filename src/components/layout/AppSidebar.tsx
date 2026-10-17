import { useAuthStore } from '@/store/auth.store';
import { SidebarHeader } from './SidebarHeader';
import { SidebarNavGroup } from './SidebarNavGroup';
import { SidebarFooter } from './SidebarFooter';
import { visibleNavGroups } from './nav';

export interface AppSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Called after a navigation link is followed (used to close the mobile drawer). */
  onNavigate?: () => void;
  className?: string;
}

/**
 * The single sidebar navigation surface shared by every role and by both the
 * desktop rail and the mobile drawer. Role-specific and permission-specific
 * differences come entirely from the navigation configuration.
 */
export function AppSidebar({ collapsed = false, onToggleCollapse, onNavigate, className }: AppSidebarProps) {
  const user = useAuthStore((state) => state.user);
  const role = user?.role ?? null;
  const permissions = user?.currentOrg?.permissions ?? null;
  const groups = visibleNavGroups(role, permissions);

  return (
    <div className={className ? `flex h-full flex-col ${className}` : 'flex h-full flex-col'}>
      <SidebarHeader collapsed={collapsed} onNavigate={onNavigate} />

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        {groups.map((group) => (
          <SidebarNavGroup
            key={group.label}
            group={group}
            role={role}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <SidebarFooter collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
    </div>
  );
}
