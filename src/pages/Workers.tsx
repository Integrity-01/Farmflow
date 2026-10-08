import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListFilter, Mail, MapPin, Phone, Plus, Search, Users } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Pagination, pageRange } from '@/components/ui/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { ApiError } from '@/services/api';
import { canManageWorkers, workersApi } from '@/services/workers';
import { useToastStore } from '@/store/toast.store';
import { useAuthStore } from '@/store/auth.store';
import type { Worker, WorkerStatus } from '@/types';
import { WorkerFormDialog, WORKER_STATUS_OPTIONS } from '@/components/workers/WorkerFormDialog';

const PAGE_SIZE = 10;

export function Workers() {
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.user?.role) ?? null;
  const canManage = canManageWorkers(role);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<'all' | WorkerStatus>('all');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Worker | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const listQuery = useQuery({
    queryKey: ['workers', { search: debouncedSearch, status: status === 'all' ? undefined : status, page }],
    queryFn: () =>
      workersApi.list({
        search: debouncedSearch || undefined,
        status: status === 'all' ? undefined : status,
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
        ? 'Could not load your workers.'
        : null;

  const deleteMutation = useMutation({
    mutationFn: workersApi.remove,
    onSuccess: async () => {
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['workers'] });
      useToastStore.getState().add({
        title: 'Worker removed',
        description: 'The worker was permanently removed.',
      });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not remove worker',
        description:
          err instanceof ApiError && err.code === 'WORKER_HAS_TASKS'
            ? `${err.message} You can edit them and set the status to inactive.`
            : err instanceof ApiError
              ? err.message
              : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const pageCount = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.total / PAGE_SIZE)) : 1;

  function openCreate() {
    setEditingWorker(null);
    setFormOpen(true);
  }

  function openEdit(worker: Worker) {
    setEditingWorker(worker);
    setFormOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Workers</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {listQuery.data && !listQuery.isFetching
              ? `${listQuery.data.total} worker${listQuery.data.total === 1 ? '' : 's'}`
              : 'Manage the people on your farm'}
          </p>
        </div>
        {canManage ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Add worker
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
            aria-label="Search workers"
          />
        </div>
        <div className="sm:w-48">
          <Select value={status} onValueChange={(value) => setStatus(value as 'all' | WorkerStatus)}>
            <SelectTrigger aria-label="Filter by status">
              <span className="flex items-center gap-2">
                <ListFilter className="size-4 text-slate-400" aria-hidden />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {WORKER_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {listError ? (
        <Alert variant="danger">
          <AlertTitle>Could not load workers</AlertTitle>
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
                  <TableHead>Worker</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.items.map((worker) => (
                  <WorkerRow
                    key={worker.id}
                    worker={worker}
                    canManage={canManage}
                    onEdit={() => openEdit(worker)}
                    onDelete={() => setDeleteTarget(worker)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-3 lg:hidden">
            {listQuery.data.items.map((worker) => (
              <WorkerCard
                key={worker.id}
                worker={worker}
                canManage={canManage}
                onEdit={() => openEdit(worker)}
                onDelete={() => setDeleteTarget(worker)}
              />
            ))}
          </ul>

          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-slate-500">
              {pageRange(listQuery.data.total, page, PAGE_SIZE, 'workers')}
            </p>
            <Pagination page={page} pageCount={pageCount} onPageChange={(next) => { setPage(next); window.scrollTo({ top: 0 }); }} />
          </div>
        </>
      ) : (
        <EmptyState
          icon={Users}
          title={debouncedSearch || status !== 'all' ? 'No workers match your filters' : 'No workers yet'}
          description={
            debouncedSearch || status !== 'all'
              ? 'Try changing the search or clearing the status filter.'
              : canManage
                ? 'Add workers so you can assign them to farms, fields and tasks.'
                : 'Workers on your farms will appear here.'
          }
          action={
            debouncedSearch || status !== 'all' ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setStatus('all');
                }}
              >
                Clear filters
              </Button>
            ) : canManage ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" aria-hidden />
                Add your first worker
              </Button>
            ) : undefined
          }
        />
      )}

      <WorkerFormDialog open={formOpen} onOpenChange={setFormOpen} worker={editingWorker} />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this worker?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be permanently removed. If they have open
              tasks you will need to reassign them first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Remove worker
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function WorkerRow({
  worker,
  canManage,
  onEdit,
  onDelete,
}: {
  worker: Worker;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <p className="font-semibold text-slate-900">{worker.name}</p>
        <p className="text-xs text-slate-500">{worker.position ?? 'Worker'}</p>
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
      <TableCell className="text-slate-600">
        <div className="flex max-w-40 flex-wrap gap-1">
          {worker.skills.length > 0 ? (
            worker.skills.slice(0, 3).map((skill) => (
              <Badge key={skill} variant="outline">
                {skill}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
          {worker.skills.length > 3 ? <span className="text-xs text-slate-500">+{worker.skills.length - 3}</span> : null}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={workerStatusType(worker.status)}>{WORKER_STATUS_LABEL[worker.status]}</Badge>
      </TableCell>
      <TableCell className="text-right">
        {canManage ? (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
              Delete
            </Button>
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function WorkerCard({
  worker,
  canManage,
  onEdit,
  onDelete,
}: {
  worker: Worker;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-slate-900">{worker.name}</h3>
            <Badge variant={workerStatusType(worker.status)}>{WORKER_STATUS_LABEL[worker.status]}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{worker.position ?? 'Worker'}</p>
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

      <div className="mt-3 flex items-center justify-between">
        <div className="min-w-0">
          {worker.skills.length > 0 ? (
            <p className="truncate text-xs text-slate-500">{worker.skills.join(', ')}</p>
          ) : (
            <p className="text-xs text-slate-400">No skills listed</p>
          )}
          {worker.phone || worker.email ? (
            <p className="truncate text-xs text-slate-500">
              {worker.phone ?? ''}
              {worker.phone && worker.email ? ' · ' : ''}
              {worker.email ?? ''}
            </p>
          ) : null}
        </div>
        {canManage ? (
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={onDelete}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}