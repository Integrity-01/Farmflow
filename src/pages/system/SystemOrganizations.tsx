import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Search, ShieldCheck, ShieldOff } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/AlertDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Pagination, pageRange } from '@/components/ui/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { useToast } from '@/store/toast.store';
import { ApiError } from '@/services/api';
import { systemPlatformApi } from '@/services/system';
import { formatDate, formatNumber, humanizeAction } from '@/components/system/format';
import type { OrgListItem } from '@/types/system';

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  active: 'success',
  suspended: 'danger',
  pending: 'warning',
};

const SORTS = [
  { value: 'created_at', label: 'Newest' },
  { value: 'name', label: 'Name' },
  { value: 'member_count', label: 'Members' },
  { value: 'farm_count', label: 'Farms' },
  { value: 'task_count', label: 'Tasks' },
];

export function SystemOrganizations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('created_at');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<OrgListItem | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['system', 'organizations', { search: debounced, status, sort, page }],
    queryFn: () =>
      systemPlatformApi.organizations({
        search: debounced || undefined,
        status: status === 'all' ? undefined : status,
        sort,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'suspend' | 'activate' }) =>
      action === 'suspend'
        ? systemPlatformApi.suspendOrganization(id)
        : systemPlatformApi.activateOrganization(id),
    onSuccess: (result, variables) => {
      toast({
        title: variables.action === 'suspend' ? 'Organization suspended' : 'Organization activated',
        description: `${result.name} is now ${result.status}.`,
        variant: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['system'] });
    },
    onError: (error) => {
      toast({
        title: 'Action failed',
        description: error instanceof ApiError ? error.message : 'Please try again.',
        variant: 'danger',
      });
    },
    onSettled: () => setPending(null),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            type="search"
            placeholder="Search organizations…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            aria-label="Search organizations"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-40" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No organizations found"
            description={debounced ? 'Try a different search or filter.' : 'Organizations will appear here once created.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Farms</TableHead>
                  <TableHead className="text-right">Tasks</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <Link
                        to={`/system/organizations/${org.id}`}
                        className="font-semibold text-ink hover:text-forest-700 hover:underline"
                      >
                        {org.name}
                      </Link>
                      <p className="text-xs text-muted">
                        {org.ownerName ?? 'No owner'}
                        {org.country ? ` · ${org.country}` : ''}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[org.status] ?? 'default'}>{humanizeAction(org.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(org.memberCount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(org.farmCount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(org.taskCount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted">{formatDate(org.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {org.status === 'suspended' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={statusMutation.isPending && pending?.id === org.id}
                          onClick={() => statusMutation.mutate({ id: org.id, action: 'activate' })}
                        >
                          <ShieldCheck className="size-4" aria-hidden />
                          Activate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPending(org)}
                        >
                          <ShieldOff className="size-4" aria-hidden />
                          Suspend
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data && data.total > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-hairline px-5 py-4 sm:flex-row">
            <p className="text-sm text-muted">{pageRange(data.total, data.page, data.pageSize, 'organizations')}</p>
            <Pagination page={data.page} pageCount={data.totalPages} onPageChange={setPage} />
          </div>
        ) : null}
        {isFetching && !isLoading ? (
          <p className="px-5 py-2 text-right text-xs text-muted">Refreshing…</p>
        ) : null}
      </Card>

      <AlertDialog open={pending !== null} onOpenChange={(open) => (!open ? setPending(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {pending?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its members will lose access until the organization is activated again. No data is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              onClick={() => {
                if (pending) statusMutation.mutate({ id: pending.id, action: 'suspend' });
              }}
            >
              Suspend organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
