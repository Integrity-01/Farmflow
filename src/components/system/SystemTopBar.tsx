import { useNavigate } from 'react-router-dom';
import { LogOut, Menu, Settings, ShieldCheck } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { initialsOf } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { systemAuthApi } from '@/services/system';
import { useSystemAdminStore } from '@/store/systemAdmin.store';
import type { SystemAdminAuthUser } from '@/types/system';

interface SystemTopBarProps {
  user: SystemAdminAuthUser;
  onMenuClick: () => void;
  title: string;
}

export function SystemTopBar({ user, onMenuClick, title }: SystemTopBarProps) {
  const navigate = useNavigate();

  async function signOut() {
    try {
      await systemAuthApi.logout();
    } catch {
      // Local sign-out is still valid even if the request fails.
    }
    useSystemAdminStore.getState().clearSession();
    navigate('/system/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-hairline bg-white/80 px-4 backdrop-blur-lg sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="flex size-10 items-center justify-center rounded-xl text-ink hover:bg-pale lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-bold tracking-tight text-ink sm:text-lg">{title}</h1>
      </div>

      <Badge variant="success" className="hidden sm:inline-flex">
        <ShieldCheck className="size-3" aria-hidden />
        Secure realm
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 hover:bg-pale"
            aria-label="Account menu"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-forest-900 text-xs font-bold text-white">
              {initialsOf(user.name)}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block max-w-[10rem] truncate text-sm font-semibold text-ink">
                {user.name}
              </span>
              <span className="block font-mono text-[11px] text-muted">{user.adminId}</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <span className="block truncate text-sm font-semibold text-ink">{user.name}</span>
            <span className="block truncate font-mono text-[11px] text-muted">{user.adminId}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate('/system/settings')}>
            <Settings className="size-4" aria-hidden />
            Account settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOut className="size-4" aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
