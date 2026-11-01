import { NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';
import type { UserRole } from '@/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { navLabel, type NavItem } from './nav';

const BASE = [
  'group flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium',
  'transition-colors duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-forest-900',
].join(' ');

const ACTIVE = 'bg-accent-400 font-semibold text-brand-600';
const INACTIVE = 'text-white hover:bg-forest-600 hover:text-white';
const DISABLED = 'cursor-not-allowed text-brand-200/40 hover:bg-transparent';

export interface SidebarNavItemProps {
  item: NavItem;
  role: UserRole | null;
  collapsed?: boolean;
  onNavigate?: () => void;
  className?: string;
}

/**
 * One sidebar navigation link with default / hover / active / focus / disabled
 * states. When collapsed it shows only the icon plus an accessible tooltip.
 */
export function SidebarNavItem({ item, role, collapsed = false, onNavigate, className }: SidebarNavItemProps) {
  const Icon = item.icon;
  const label = navLabel(item, role);

  if (item.disabled) {
    return (
      <span
        aria-disabled="true"
        className={cn(BASE, DISABLED, collapsed && 'justify-center', className)}
      >
        <Icon className="size-5 shrink-0" aria-hidden />
        {!collapsed ? <span className="min-w-0 truncate">{label}</span> : null}
      </span>
    );
  }

  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(BASE, collapsed && 'justify-center px-0', isActive ? ACTIVE : INACTIVE, className)
      }
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {!collapsed ? <span className="min-w-0 truncate">{label}</span> : null}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
