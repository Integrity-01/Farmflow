import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Sprout } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { cn } from '@/utils/cn';
import { useAppStore } from '@/store/app.store';
import { useAuthStore } from '@/store/auth.store';
import { canAccessPath, navItems, type NavItem } from './nav';

const GROUPS: { label: string; to: string[] }[] = [
  { label: 'Overview', to: ['/', '/tasks', '/my-tasks', '/recurring-tasks'] },
  { label: 'Farm', to: ['/farms', '/inventory', '/workers'] },
  { label: 'Insights', to: ['/analytics', '/weather', '/assistant', '/reports', '/history'] },
  { label: 'Organization', to: ['/team'] },
  { label: 'System', to: ['/notifications', '/settings'] },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function roleLabel(role: string): string {
  const spaced = role.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function Sidebar() {
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const role = useAuthStore((state) => state.user?.role) ?? null;
  const user = useAuthStore((state) => state.user);

  const visibleItems = navItems.filter((item) => canAccessPath(item.to, role));
  const byPath = new Map(visibleItems.map((item) => [item.to, item]));

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-hairline bg-white/95 backdrop-blur-xl transition-[width] duration-200 lg:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-3 border-b border-hairline px-4',
          collapsed && 'justify-center px-2',
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
          <Sprout className="size-5" aria-hidden />
        </div>
        {!collapsed ? (
          <span className="min-w-0">
            <span className="block truncate text-lg font-bold tracking-tight text-slate-900">
              FarmFlow
            </span>
            <span className="block truncate text-[11px] font-medium text-slate-400">
              Farm management
            </span>
          </span>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        {GROUPS.map((group) => {
          const items = group.to
            .map((to) => byPath.get(to))
            .filter((item): item is NavItem => Boolean(item));
          if (items.length === 0) return null;

          return (
            <div key={group.label} className="pb-4 first:pt-0">
              {!collapsed ? (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.label}
                </p>
              ) : null}
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <NavLink
                          to={item.to}
                          end={item.end}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                              collapsed && 'justify-center px-0',
                              isActive
                                ? 'bg-forest-50 text-forest-900 font-semibold ring-1 ring-inset ring-hairline'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                            )
                          }
                        >
                          <item.icon className="size-5 shrink-0" aria-hidden />
                          {!collapsed ? <span className="min-w-0 truncate">{item.label}</span> : null}
                        </NavLink>
                      </TooltipTrigger>
                      {collapsed ? (
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      ) : null}
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div
        className={cn(
          'shrink-0 border-t border-hairline p-3',
          collapsed ? 'flex flex-col items-center gap-2' : 'flex items-center justify-between gap-2',
        )}
      >
        {user ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex min-w-0 items-center gap-3 rounded-xl p-1.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {initials(user.name)}
                </span>
                {!collapsed ? (
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {user.name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {roleLabel(user.role)}
                    </span>
                  </span>
                ) : null}
              </div>
            </TooltipTrigger>
            {collapsed ? <TooltipContent side="right">{user.name}</TooltipContent> : null}
          </Tooltip>
        ) : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                collapsed && 'w-full',
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-5" aria-hidden />
              ) : (
                <PanelLeftClose className="size-5" aria-hidden />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
