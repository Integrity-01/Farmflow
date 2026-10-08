import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListFilter, MapPin, Plus, Search, Warehouse } from 'lucide-react';
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
import { canManageFarms, farmsApi } from '@/services/farms';
import { useToastStore } from '@/store/toast.store';
import { useAuthStore } from '@/store/auth.store';
import type { Farm, FarmStatus } from '@/types';
import { FarmFormDialog } from '@/components/farms/FarmFormDialog';
import { FieldsDialog } from '@/components/farms/FieldsDialog';
import { FARM_STATUS_OPTIONS, farmStatusBadge, formatSize } from '@/components/farms/labels';

const PAGE_SIZE = 10;

export function Farms() {
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.user?.role) ?? null;
  const canManage = canManageFarms(role);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<'all' | FarmStatus>('all');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [fieldsFarm, setFieldsFarm] = useState<Farm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Farm | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const listQuery = useQuery({
    queryKey: ['farms', { search: debouncedSearch, status: status === 'all' ? undefined : status, page }],
    queryFn: () =>
      farmsApi.list({
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
        ? 'Could not load your farms.'
        : null;

  const deleteMutation = useMutation({
    mutationFn: farmsApi.remove,
    onSuccess: async () => {
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['farms'] });
      useToastStore.getState().add({
        title: 'Farm deleted',
        description: 'The farm was permanently removed.',
      });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not delete farm',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const pageCount = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.total / PAGE_SIZE)) : 1;

  function openCreate() {
    setEditingFarm(null);
    setFormOpen(true);
  }

  function openEdit(farm: Farm) {
    setEditingFarm(farm);
    setFormOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Farms</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {listQuery.data && !listQuery.isFetching
              ? `${listQuery.data.total} farm${listQuery.data.total === 1 ? '' : 's'}`
              : 'Manage your farms and fields'}
          </p>
        </div>
        {canManage ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Add farm
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 size-4 text-slate-400" aria-hidden />
          <Input
            className="pl-10"
            placeholder="Search farms or locations…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search farms"
          />
        </div>
        <div className="sm:w-48">
          <Select value={status} onValueChange={(value) => setStatus(value as 'all' | FarmStatus)}>
            <SelectTrigger aria-label="Filter by status">
              <span className="flex items-center gap-2">
                <ListFilter className="size-4 text-slate-400" aria-hidden />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {FARM_STATUS_OPTIONS.map((option) => (
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
          <AlertTitle>Could not load farms</AlertTitle>
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
                  <TableHead>Farm</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead>Workers</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.items.map((farm) => (
                  <FarmRow
                    key={farm.id}
                    farm={farm}
                    canManage={canManage}
                    onEdit={() => openEdit(farm)}
                    onFields={() => setFieldsFarm(farm)}
                    onDelete={() => setDeleteTarget(farm)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-3 lg:hidden">
            {listQuery.data.items.map((farm) => (
              <FarmCard
                key={farm.id}
                farm={farm}
                canManage={canManage}
                onEdit={() => openEdit(farm)}
                onFields={() => setFieldsFarm(farm)}
                onDelete={() => setDeleteTarget(farm)}
              />
            ))}
          </ul>

          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-slate-500">
              {pageRange(listQuery.data.total, page, PAGE_SIZE, 'farms')}
            </p>
            <Pagination page={page} pageCount={pageCount} onPageChange={(next) => { setPage(next); window.scrollTo({ top: 0 }); }} />
          </div>
        </>
      ) : (
        <EmptyState
          icon={Warehouse}
          title={debouncedSearch || status !== 'all' ? 'No farms match your filters' : 'No farms yet'}
          description={
            debouncedSearch || status !== 'all'
              ? 'Try changing the search or clearing the status filter.'
              : canManage
                ? 'Add your first farm to start organising fields, workers and tasks.'
                : 'Farms you are part of will appear here.'
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
                Add your first farm
              </Button>
            ) : undefined
          }
        />
      )}

      <FarmFormDialog open={formOpen} onOpenChange={setFormOpen} farm={editingFarm} />

      {fieldsFarm ? (
        <FieldsDialog
          key={fieldsFarm.id}
          open={Boolean(fieldsFarm)}
          onOpenChange={(open) => {
            if (!open) setFieldsFarm(null);
          }}
          farm={fieldsFarm}
        />
      ) : null}

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this farm?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be permanently removed. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete farm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FarmRow({
  farm,
  canManage,
  onEdit,
  onFields,
  onDelete,
}: {
  farm: Farm;
  canManage: boolean;
  onEdit: () => void;
  onFields: () => void;
  onDelete: () => void;
}) {
  const status = farmStatusBadge(farm.status);
  return (
    <TableRow>
      <TableCell>
        <p className="font-semibold text-slate-900">{farm.name}</p>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="size-3" aria-hidden />
          {farm.location ?? 'No location set'}
        </p>
      </TableCell>
      <TableCell className="whitespace-nowrap text-slate-600">
        {formatSize(farm.size, farm.sizeUnit)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">{farm.pendingTasks}</span>
          <span className="text-xs text-slate-500">of {farm.taskCount} open</span>
        </div>
      </TableCell>
      <TableCell className="text-slate-600">{farm.fieldCount}</TableCell>
      <TableCell className="text-slate-600">{farm.workerCount}</TableCell>
      <TableCell className="text-slate-600">{farm.managerName ?? '—'}</TableCell>
      <TableCell>
        <Badge variant={status.variant}>{status.label}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onFields}>
            Fields
          </Button>
          {canManage ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                Edit
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
                Delete
              </Button>
            </>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function FarmCard({
  farm,
  canManage,
  onEdit,
  onFields,
  onDelete,
}: {
  farm: Farm;
  canManage: boolean;
  onEdit: () => void;
  onFields: () => void;
  onDelete: () => void;
}) {
  const status = farmStatusBadge(farm.status);
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-slate-900">{farm.name}</h3>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="size-3" aria-hidden />
            {farm.location ?? 'No location set'}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 px-2 py-2">
          <p className="text-sm font-bold text-slate-900">{farm.pendingTasks}</p>
          <p className="text-[11px] text-slate-500">Open tasks</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-2 py-2">
          <p className="text-sm font-bold text-slate-900">{farm.fieldCount}</p>
          <p className="text-[11px] text-slate-500">Fields</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-2 py-2">
          <p className="text-sm font-bold text-slate-900">{farm.workerCount}</p>
          <p className="text-[11px] text-slate-500">Workers</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {formatSize(farm.size, farm.sizeUnit)}
          {farm.managerName ? ` · ${farm.managerName}` : ''}
        </p>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="sm" onClick={onFields}>
            Fields
          </Button>
          {canManage ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
                Edit
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${farm.name}`} onClick={onDelete}>
                <span className="text-red-600 text-xs font-semibold">Del</span>
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}