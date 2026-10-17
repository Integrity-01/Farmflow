import { Link, useLocation } from 'react-router-dom';
import { Bell, LogOut, Menu, Sprout, Wifi, WifiOff } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Avatar, AvatarFallback, initialsOf } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/store/app.store';
import { useAuthStore } from '@/store/auth.store';
import { notificationsApi } from '@/services/notifications';
import { useSignOut } from '@/hooks/useSignOut';
import { canAccessPath, matchNavItem, navLabel } from './nav';
import { OrgSwitcher } from './OrgSwitcher';

export function TopBar() {
  const isOnline = useAppStore((state) => state.isOnline);
  const toggleMobileNav = useAppStore((state) => state.toggleMobileNav);
  const user = useAuthStore((state) => state.user);
  const userId = useAuthStore((state) => state.user?.id);
  const { pathname } = useLocation();
  const signOut = useSignOut();

  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.unreadCount,
    enabled: Boolean(userId),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 0,
  });
  const unreadCount = unreadQuery.data ?? 0;

  const role = user?.role ?? null;
  const permissions = user?.currentOrg?.permissions ?? null;
  const current = matchNavItem(pathname);
  const visibleLabel = current && canAccessPath(pathname, role, permissions) ? navLabel(current, role) : undefined;

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-white/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={toggleMobileNav}
          aria-label="Open navigation"
          className="flex size-10 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 lg:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </button>

        <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Sprout className="size-5" aria-hidden />
          </div>
          <span className="text-lg font-bold tracking-tight text-forest-900">FarmFlow</span>
        </Link>

        <h1 className="hidden text-sm font-semibold text-forest-900 sm:block lg:text-base">
          {visibleLabel ?? 'FarmFlow'}
        </h1>

        <div className="ml-auto flex items-center gap-2">
          <OrgSwitcher />
          {isOnline ? (
            <Badge variant="success">
              <Wifi className="size-3" aria-hidden />
              Online
            </Badge>
          ) : (
            <Badge variant="warning">
              <WifiOff className="size-3" aria-hidden />
              Offline
            </Badge>
          )}

          <Link
            to="/notifications"
            aria-label="Notifications"
            className="relative flex size-10 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <Bell className="size-5" aria-hidden />
            {unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-4 text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : (
              <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-brand-600" aria-hidden />
            )}
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="flex items-center justify-center rounded-full transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <Avatar>
                  <AvatarFallback>{initialsOf(user?.name ?? 'FarmFlow')}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <span className="block text-sm font-semibold text-slate-900">{user?.name ?? 'FarmFlow'}</span>
                <span className="block text-xs font-normal text-slate-500">{user?.email ?? 'member@farmflow'}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-700 focus:bg-red-50"
                onSelect={() => void signOut()}
              >
                <LogOut className="size-4" aria-hidden />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
