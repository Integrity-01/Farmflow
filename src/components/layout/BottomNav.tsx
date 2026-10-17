import { NavLink } from 'react-router-dom';
import { Bell, Home, ListTodo, Plus, User } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/auth.store';
import { canSeeNavItem, navItems, roleAtLeast } from './nav';

export function BottomNav() {
  const role = useAuthStore((state) => state.user?.role ?? null);
  const permissions = useAuthStore((state) => state.user?.currentOrg?.permissions ?? null);

  const destinations = [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/tasks', icon: ListTodo, label: 'Tasks' },
    { to: '/notifications', icon: Bell, label: 'Alerts' },
    { to: '/profile', icon: User, label: 'Profile' },
  ].filter(({ to }) => {
    const item = navItems.find((nav) => nav.to === to);
    return !item || canSeeNavItem(item, role, permissions);
  });

  const canCreateTask =
    roleAtLeast(role ?? 'field_officer', 'supervisor') && Boolean(permissions?.includes('task:create'));
  const columnCount = destinations.length + (canCreateTask ? 1 : 0);

  return (
    <nav
      className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-white/90 backdrop-blur-xl lg:hidden"
      aria-label="Main"
    >
      <div
        className="grid h-16 items-center px-1"
        style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
      >
        {destinations.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                isActive ? 'text-brand-700' : 'text-slate-500 hover:text-ink',
              )
            }
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}

        {canCreateTask ? (
          <div className="flex items-center justify-center">
            <NavLink
              to="/tasks?new=1"
              aria-label="Create task"
              className="flex size-14 -translate-y-2 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            >
              <Plus className="size-7" aria-hidden />
            </NavLink>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
