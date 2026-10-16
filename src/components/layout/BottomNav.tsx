import { NavLink } from 'react-router-dom';
import { Bell, Home, ListTodo, Plus, User } from 'lucide-react';
import { cn } from '@/utils/cn';

export function BottomNav() {
  return (
    <nav
      className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-white/90 backdrop-blur-xl lg:hidden"
      aria-label="Main"
    >
      <div className="grid h-16 grid-cols-5 items-center px-1">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[11px] font-medium',
              isActive ? 'text-brand-700' : 'text-slate-500',
            )
          }
        >
          <Home className="size-5" aria-hidden />
          Home
        </NavLink>

        <NavLink
          to="/tasks"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[11px] font-medium',
              isActive ? 'text-brand-700' : 'text-slate-500',
            )
          }
        >
          <ListTodo className="size-5" aria-hidden />
          Tasks
        </NavLink>

        <div className="flex items-center justify-center">
          <NavLink
            to="/tasks?new=1"
            aria-label="Create task"
            className="flex size-14 -translate-y-2 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition-colors hover:bg-brand-700"
          >
            <Plus className="size-7" aria-hidden />
          </NavLink>
        </div>

        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[11px] font-medium',
              isActive ? 'text-brand-700' : 'text-slate-500',
            )
          }
        >
          <Bell className="size-5" aria-hidden />
          Alerts
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[11px] font-medium',
              isActive ? 'text-brand-700' : 'text-slate-500',
            )
          }
        >
          <User className="size-5" aria-hidden />
          Profile
        </NavLink>
      </div>
    </nav>
  );
}