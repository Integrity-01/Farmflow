import { useState } from 'react';
import { ChevronDown, Building2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { useAuthStore } from '@/store/auth.store';
import { organizationApi } from '@/services/organization';
import { useToastStore } from '@/store/toast.store';
import { ApiError } from '@/services/api';

export function OrgSwitcher() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();
  const orgs = user?.orgs ?? [];
  const current = user?.currentOrg ?? orgs.find((o) => o.status === 'active') ?? null;
  const [switching, setSwitching] = useState(false);

  if (!current && orgs.length === 0) return null;

  async function handleSwitch(id: string) {
    if (id === current?.id || switching) return;
    setSwitching(true);
    try {
      const updated = await organizationApi.switch(id);
      setUser(updated);
      await queryClient.invalidateQueries();
      useToastStore.getState().add({
        title: 'Organization switched',
        description: `Now working in ${updated.currentOrg?.name ?? 'your organization'}.`,
      });
    } catch (err) {
      useToastStore.getState().add({
        title: 'Could not switch organization',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    } finally {
      setSwitching(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={switching}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          <Building2 className="size-4 text-slate-500" aria-hidden />
          <span className="max-w-[160px] truncate font-medium text-slate-700">
            {current?.name ?? 'Organization'}
          </span>
          <ChevronDown className="size-4 text-slate-500" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Your organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => void handleSwitch(org.id)}
            disabled={org.status !== 'active'}
          >
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-900">
                {org.name}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {org.role.replace(/_/g, ' ')}
                {org.status !== 'active' ? ` · ${org.status}` : ''}
              </span>
            </div>
            {current?.id === org.id ? (
              <span className="ml-auto text-xs font-semibold text-brand-700">Current</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
