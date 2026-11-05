import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Mail, MapPin, Phone, Search, UserCog, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Pagination, pageRange } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { canAccessPath } from '@/components/layout/nav';
import { ApiError } from '@/services/api';
import { workersApi } from '@/services/workers';
import { useAuthStore } from '@/store/auth.store';
import type { Worker, WorkerStatus } from '@/types';

const PAGE_SIZE = 10;

export function FieldOfficers() {
  const role = useAuthStore((state) => state.user?.role) ?? null;
  const permissions = useAuthStore((state) => state.user?.currentOrg?.permissions) ?? null;
  const canManageTeam = canAccessPath('/team', role, permissions);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const listQuery = useQuery({
    queryKey: ['workers', { search: debouncedSearch, page }],
    queryFn: () =>
      workersApi.list({
        search: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    retry: 0,
  });

  const listError =
    listQuery.error instanceof ApiError
      ? listQuery.error.message
      : listQuery.error
        ? 'Could not load your field officers.'
        : null;

  const pageCount = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-brand-700">Field Officers</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {listQuery.data && !listQuery.isFetching
              ? `${listQuery.data.total} field officer${listQuery.data.total === 1 ? '' : 's'}`
              : 'The field officers in your organization'}
          </p>
        </div>
        {canManageTeam ? (
          <Button variant="outline" asChild>
            <Link to="/team">
              <UserCog className="size-4" aria-hidden />
              Manage in Team
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 size-4 text-slate-400" aria-hidden />
          <Input
            className="pl-10"
            placeholder="Search by name, phone or email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search field officers"
          />
        </div>
      </div>

      {listError ? (
        <Alert variant="danger">
          <AlertTitle>Could not load field officers</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{listError}</p>
            <Button variant="outline" size="sm" onClick={() => void listQuery.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-16 w-full" />
          ))}
        </div>
      ) : listQuery.data && listQuery.data.items.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field officer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Farm</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.items.map((worker) => (
                  <FieldOfficerRow key={worker.id} worker={worker} />
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-3 lg:hidden">
            {listQuery.data.items.map((worker) => (
              <FieldOfficerCard key={worker.id} worker={worker} />
            ))}
          </ul>

          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-slate-500">
              {pageRange(
                listQuery.data.total,
                page,
                PAGE_SIZE,
                listQuery.data.total === 1 ? 'field officer' : 'field officers',
              )}
            </p>
            <Pagination page={page} pageCount={pageCount} onPageChange={(next) => { setPage(next); window.scrollTo({ top: 0 }); }} />
          </div>
        </>
      ) : (
        <EmptyState
          icon={Users}
          title={debouncedSearch ? 'No field officers match your search' : 'No field officers yet'}
          description={
            debouncedSearch
              ? 'Try a different name, phone number or email address.'
              : canManageTeam
                ? 'Invite team members with the Field Officer role from Team & Users, and they will appear here.'
                : 'Field officers appear here once they join your organization.'
          }
          action={
            debouncedSearch ? (
              <Button variant="outline" onClick={() => setSearch('')}>
                Clear search
              </Button>
            ) : canManageTeam ? (
              <Button asChild>
                <Link to="/team">
                  <UserCog className="size-4" aria-hidden />
                  Invite a field officer
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

function workerStatusType(status: WorkerStatus): NonNullable<import('@/components/ui/Badge').BadgeProps['variant']> {
  switch (status) {
    case 'active':
      return 'success';
    case 'inactive':
      return 'default';
    case 'suspended':
      return 'danger';
  }
}

const WORKER_STATUS_LABEL: Record<WorkerStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
};

function FieldOfficerRow({ worker }: { worker: Worker }) {
  return (
    <TableRow>
      <TableCell>
        <p className="font-semibold text-slate-900">{worker.name}</p>
        <p className="text-xs text-slate-500">Field Officer</p>
      </TableCell>
      <TableCell className="text-slate-600">
        {worker.phone ? (
          <p className="flex items-center gap-1.5 text-sm">
            <Phone className="size-3.5 text-slate-400" aria-hidden />
            {worker.phone}
          </p>
        ) : null}
        {worker.email ? (
          <p className="flex items-center gap-1.5 text-sm">
            <Mail className="size-3.5 text-slate-400" aria-hidden />
            {worker.email}
          </p>
        ) : null}
        {!worker.phone && !worker.email ? <span className="text-xs text-slate-400">No contact set</span> : null}
      </TableCell>
      <TableCell>
        <p className="font-medium text-slate-700">{worker.farmName ?? 'Unassigned'}</p>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="size-3" aria-hidden />
          {worker.fieldName ?? 'No field'}
        </p>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">{worker.openTasks}</span>
          <span className="text-xs text-slate-500">of {worker.taskCount} open</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={workerStatusType(worker.status)}>{WORKER_STATUS_LABEL[worker.status]}</Badge>
      </TableCell>
    </TableRow>
  );
}

function FieldOfficerCard({ worker }: { worker: Worker }) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-slate-900">{worker.name}</h3>
            <Badge variant={workerStatusType(worker.status)}>{WORKER_STATUS_LABEL[worker.status]}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">Field Officer</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 px-2 py-2">
          <p className="text-sm font-bold text-slate-900">{worker.openTasks}</p>
          <p className="text-[11px] text-slate-500">Open tasks</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-2 py-2">
          <p className="truncate text-sm font-bold text-slate-900">{worker.taskCount}</p>
          <p className="text-[11px] text-slate-500">Total tasks</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-2 py-2">
          <p className="truncate text-sm font-bold text-slate-900">{worker.farmName ?? '—'}</p>
          <p className="text-[11px] text-slate-500">Farm</p>
        </div>
      </div>

      <div className="mt-3 min-w-0">
        {worker.phone || worker.email ? (
          <p className="truncate text-xs text-slate-500">
            {worker.phone ?? ''}
            {worker.phone && worker.email ? ' · ' : ''}
            {worker.email ?? ''}
          </p>
        ) : (
          <p className="text-xs text-slate-400">No contact set</p>
        )}
      </div>
    </li>
  );
}
