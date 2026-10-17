import { Link } from 'react-router-dom';
import { LogOut, PanelLeftClose, PanelLeftOpen, UserRound } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Avatar, AvatarFallback, initialsOf } from '@/components/ui/Avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/auth.store';
import { useSignOut } from '@/hooks/useSignOut';
import { formatRoleLabel } from './nav';

export interface SidebarFooterProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

/** Account identity, profile access and sign-out at the bottom of the sidebar. */
export function SidebarFooter({ collapsed = false, onToggleCollapse }: SidebarFooterProps) {
  const user = useAuthStore((state) => state.user);
  const signOut = useSignOut();

  const role = user?.currentOrg?.role ?? user?.role ?? null;
  const roleLabel = formatRoleLabel(role);
  const orgName = user?.currentOrg?.name ?? null;
  const subtitle = orgName ? `${orgName} · ${roleLabel}` : roleLabel;

  return (
    <div
      className={cn(
        'shrink-0 border-t border-hairline p-3',
        collapsed ? 'flex flex-col items-center gap-2' : 'flex items-center gap-2',
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Account menu"
            className={cn(
              'flex min-w-0 items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
              collapsed ? 'justify-center' : 'flex-1',
            )}
          >
            <Avatar>
              <AvatarFallback>{initialsOf(user?.name ?? 'FarmFlow')}</AvatarFallback>
            </Avatar>
            {!collapsed ? (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-forest-900">
                  {user?.name ?? 'Your account'}
                </span>
                <span className="block truncate text-xs text-muted">{subtitle}</span>
              </span>
            ) : null}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-60">
          <DropdownMenuLabel>
            <span className="block text-sm font-semibold text-slate-900">
              {user?.name ?? 'Your account'}
            </span>
            <span className="block text-xs font-normal text-slate-500">{user?.email}</span>
            <span className="mt-1 block text-xs font-normal text-slate-500">{subtitle}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/profile">
              <UserRound className="size-4" aria-hidden />
              My Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings">Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:bg-red-50 focus:text-red-700"
            onSelect={() => void signOut()}
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {onToggleCollapse ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cn(
                'flex size-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-forest-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
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
      ) : null}
    </div>
  );
}
