import { NavLink } from 'react-router-dom';
import { ShieldCheck, X } from 'lucide-react';
import { SYSTEM_NAV } from '@/components/system/nav';
import { cn } from '@/utils/cn';
import type { SystemAdminAuthUser } from '@/types/system';

interface SystemSidebarProps {
  user: SystemAdminAuthUser;
  onNavigate?: () => void;
  onClose?: () => void;
  className?: string;
}

export function SystemSidebar({ user, onNavigate, onClose, className }: SystemSidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full w-72 flex-col bg-forest-900 text-white',
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-accent-400 text-brand-600">
          <ShieldCheck className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-white">FarmFlow System</p>
          <p className="truncate text-[11px] font-medium text-brand-200/80">Central Administration</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex size-9 items-center justify-center rounded-lg text-brand-200 hover:bg-forest-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-5" aria-hidden />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="System navigation">
        {SYSTEM_NAV.map((group) => {
          const items = group.items.filter((item) => !item.ownerOnly || user.isOwner);
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200/85">
                {group.label}
              </p>
              <ul className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-forest-900',
                            isActive
                              ? 'bg-accent-400 font-semibold text-brand-600'
                              : 'text-white hover:bg-forest-600 hover:text-white',
                          )
                        }
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-[11px] font-medium text-brand-200/85">
          Signed in as {user.isOwner ? 'System Owner' : 'System Administrator'}
        </p>
        <p className="truncate font-mono text-[11px] text-brand-200/90">{user.adminId}</p>
      </div>
    </aside>
  );
}
