import { Link } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SidebarHeaderProps {
  collapsed?: boolean;
  onNavigate?: () => void;
  className?: string;
}

/** FarmFlow identity at the top of the sidebar. */
export function SidebarHeader({ collapsed = false, onNavigate, className }: SidebarHeaderProps) {
  return (
    <div
      className={cn(
        'flex h-16 shrink-0 items-center gap-3 border-b border-hairline px-4',
        collapsed && 'justify-center px-2',
        className,
      )}
    >
      <Link
        to="/dashboard"
        onClick={onNavigate}
        className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
          <Sprout className="size-5" aria-hidden />
        </span>
        {!collapsed ? (
          <span className="min-w-0">
            <span className="block truncate text-lg font-bold tracking-tight text-forest-900">
              FarmFlow
            </span>
            <span className="block truncate text-[11px] font-medium text-slate-400">
              Farm management
            </span>
          </span>
        ) : null}
      </Link>
    </div>
  );
}
