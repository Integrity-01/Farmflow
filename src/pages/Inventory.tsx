import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, ListFilter, Package, Plus, Search } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Pagination, pageRange } from '@/components/ui/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { ApiError } from '@/services/api';
import { canManageInventory, inventoryApi } from '@/services/inventory';
import { useToastStore } from '@/store/toast.store';
import { useAuthStore } from '@/store/auth.store';
import type { InputMovement, InputType, InventoryItem } from '@/types';
import { AdjustStockDialog } from '@/components/inventory/AdjustStockDialog';
import { InventoryFormDialog } from '@/components/inventory/InventoryFormDialog';
import { INPUT_TYPE_OPTIONS, formatCost, formatQuantity, stockBadge, STOCK_OPTIONS } from '@/components/inventory/labels';

const PAGE_SIZE = 10;
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export function Inventory() {
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.user?.role) ?? null;
  const canManage = canManageInventory(role);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [type, setType] = useState<'all' | InputType>('all');
  const [stock, setStock] = useState<'all' | 'low' | 'out'>('all');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingInput, setEditingInput] = useState<InventoryItem | null>(null);
  const [adjustInput, setAdjustInput] = useState<InventoryItem | null>(null);
  const [movementInput, setMovementInput] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, type, stock]);

  const listQuery = useQuery({
    queryKey: ['inventory', { search: debouncedSearch, type: type === 'all' ? undefined : type, stock: stock === 'all' ? undefined : stock, page }],
    queryFn: () =>
      inventoryApi.list({
        search: debouncedSearch || undefined,
        type: type === 'all' ? undefined : type,
        stock: stock === 'all' ? undefined : stock,
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
        ? 'Could not load your inventory.'
        : null;

  const deleteMutation = useMutation({
    mutationFn: inventoryApi.remove,
    onSuccess: async () => {
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      useToastStore.getState().add({
        title: 'Input deleted',
        description: 'The input was permanently removed.',
      });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not delete input',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const pageCount = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.total / PAGE_SIZE)) : 1;

  function openCreate() {
    setEditingInput(null);
    setFormOpen(true);
  }

  function openEdit(input: InventoryItem) {
    setEditingInput(input);
    setFormOpen(true);
  }

  const hasFilters = debouncedSearch !== '' || type !== 'all' || stock !== 'all';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Inventory</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {listQuery.data && !listQuery.isFetching
              ? `${listQuery.data.total} input${listQuery.data.total === 1 ? '' : 's'}`
              : 'Track seeds, inputs and consumables'}
          </p>
        </div>
        {canManage ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Add input
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 size-4 text-slate-400" aria-hidden />
          <Input
            className="pl-10"
            placeholder="Search inputs, suppliers or notes…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search inventory"
          />
        </div>
        <div className="sm:w-44">
          <Select value={type} onValueChange={(value) => setType(value as 'all' | InputType)}>
            <SelectTrigger aria-label="Filter by type">
              <span className="flex items-center gap-2">
                <ListFilter className="size-4 text-slate-400" aria-hidden />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {INPUT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:w-44">
          <Select value={stock} onValueChange={(value) => setStock(value as 'all' | 'low' | 'out')}>
            <SelectTrigger aria-label="Filter by stock">
              <span className="flex items-center gap-2">
                <ListFilter className="size-4 text-slate-400" aria-hidden />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              {STOCK_OPTIONS.filter((option) => option.value !== 'in_stock').map((option) => (
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
          <AlertTitle>Could not load inventory</AlertTitle>
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
                  <TableHead>Input</TableHead>
                  <TableHead>Farm</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>On hand</TableHead>
                  <TableHead>Unit cost</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.items.map((input) => (
                  <InputRow
                    key={input.id}
                    input={input}
                    canManage={canManage}
                    onEdit={() => openEdit(input)}
                    onAdjust={() => setAdjustInput(input)}
                    onMovements={() => setMovementInput(input)}
                    onDelete={() => setDeleteTarget(input)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-3 lg:hidden">
            {listQuery.data.items.map((input) => (
              <InputCard
                key={input.id}
                input={input}
                canManage={canManage}
                onEdit={() => openEdit(input)}
                onAdjust={() => setAdjustInput(input)}
                onMovements={() => setMovementInput(input)}
                onDelete={() => setDeleteTarget(input)}
              />
            ))}
          </ul>

          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-slate-500">
              {pageRange(listQuery.data.total, page, PAGE_SIZE, 'inputs')}
            </p>
            <Pagination page={page} pageCount={pageCount} onPageChange={(next) => { setPage(next); window.scrollTo({ top: 0 }); }} />
          </div>
        </>
      ) : (
        <EmptyState
          icon={Package}
          title={hasFilters ? 'No inputs match your filters' : 'No inputs yet'}
          description={
            hasFilters
              ? 'Try changing the search or clearing the filters.'
              : canManage
                ? 'Add your first input to start tracking farm stock.'
                : 'Inventory appears here when a manager adds inputs.'
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setType('all');
                  setStock('all');
                }}
              >
                Clear filters
              </Button>
            ) : canManage ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" aria-hidden />
                Add your first input
              </Button>
            ) : undefined
          }
        />
      )}

      <InventoryFormDialog open={formOpen} onOpenChange={setFormOpen} input={editingInput} />

      <AdjustStockDialog
        open={Boolean(adjustInput)}
        onOpenChange={(open) => {
          if (!open) setAdjustInput(null);
        }}
        input={adjustInput}
      />

      {movementInput ? (
        <MovementsDialog
          key={movementInput.id}
          input={movementInput}
          onOpenChange={(open) => {
            if (!open) setMovementInput(null);
          }}
        />
      ) : null}

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this input?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" and its movement history will be permanently
              removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete input
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InputRow({
  input,
  canManage,
  onEdit,
  onAdjust,
  onMovements,
  onDelete,
}: {
  input: InventoryItem;
  canManage: boolean;
  onEdit: () => void;
  onAdjust: () => void;
  onMovements: () => void;
  onDelete: () => void;
}) {
  const stock = stockBadge(input.stock);
  return (
    <TableRow>
      <TableCell>
        <p className="font-semibold text-slate-900">{input.name}</p>
        <p className="text-xs text-slate-500">
          {formatQuantity(input.quantity, input.unit)}
          {Number(input.lowStockThreshold) > 0
            ? ` · alert ≤ ${formatQuantity(input.lowStockThreshold, input.unit)}`
            : ''}
        </p>
      </TableCell>
      <TableCell className="text-slate-600">{input.farmName}</TableCell>
      <TableCell className="whitespace-nowrap capitalize text-slate-600">{input.type}</TableCell>
      <TableCell className="whitespace-nowrap text-slate-600">
        {formatQuantity(input.quantity, input.unit)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-slate-600">{formatCost(input.unitCost)}</TableCell>
      <TableCell className="text-slate-600">{input.supplier ?? '—'}</TableCell>
      <TableCell>
        <Badge variant={stock.variant}>{stock.label}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onMovements}>
            History
          </Button>
          {canManage ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={onAdjust}>
                Adjust
              </Button>
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

function InputCard({
  input,
  canManage,
  onEdit,
  onAdjust,
  onMovements,
  onDelete,
}: {
  input: InventoryItem;
  canManage: boolean;
  onEdit: () => void;
  onAdjust: () => void;
  onMovements: () => void;
  onDelete: () => void;
}) {
  const stock = stockBadge(input.stock);
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-slate-900">{input.name}</h3>
            <Badge variant={stock.variant}>{stock.label}</Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {input.farmName} · {input.type}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 px-2 py-2">
          <p className="text-sm font-bold text-slate-900">{formatQuantity(input.quantity, input.unit)}</p>
          <p className="text-[11px] text-slate-500">On hand</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-2 py-2">
          <p className="text-sm font-bold text-slate-900">{formatCost(input.unitCost)}</p>
          <p className="text-[11px] text-slate-500">Unit cost</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-2 py-2">
          <p className="text-sm font-bold text-slate-900">{input.supplier ?? '—'}</p>
          <p className="text-[11px] text-slate-500">Supplier</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {Number(input.lowStockThreshold) > 0
            ? `Low stock alert at ${formatQuantity(input.lowStockThreshold, input.unit)}`
            : 'No low stock alert set'}
        </p>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="sm" onClick={onMovements}>
            History
          </Button>
          {canManage ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={onAdjust}>
                Adjust
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
                Edit
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${input.name}`} onClick={onDelete}>
                <span className="text-xs font-semibold text-red-600">Del</span>
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function MovementsDialog({
  input,
  onOpenChange,
}: {
  input: InventoryItem;
  onOpenChange: (open: boolean) => void;
}) {
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['inventory-movements', input.id, page],
    queryFn: () => inventoryApi.movements(input.id, page, 10),
    placeholderData: keepPreviousData,
    retry: 0,
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Stock history</DialogTitle>
          <DialogDescription>
            "{input.name}" — {formatQuantity(input.quantity, input.unit)} on hand
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-12 w-full" />
            ))}
          </div>
        ) : query.data && query.data.items.length > 0 ? (
          <>
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {query.data.items.map((movement) => (
                <MovementRow key={movement.id} movement={movement} unit={input.unit} />
              ))}
            </ul>
            {query.data.total > 10 ? (
              <Pagination
                page={page}
                pageCount={Math.max(1, Math.ceil(query.data.total / 10))}
                onPageChange={setPage}
              />
            ) : null}
          </>
        ) : (
          <p className="py-6 text-center text-sm text-slate-500">No movements recorded yet.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MovementRow({ movement, unit }: { movement: InputMovement; unit: string }) {
  const positive = Number(movement.change) > 0;
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className={positive ? 'text-brand-700' : 'text-red-600'}>
            {positive ? '+' : ''}{formatQuantity(movement.change, unit)}
          </span>
          <span className="text-xs font-normal text-slate-500">{positive ? 'received' : 'used'}</span>
        </p>
        <p className="truncate text-xs text-slate-500">
          {movement.note || (positive ? 'Stock received' : 'Stock used')}
          {movement.createdByName ? ` · by ${movement.createdByName}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
        <History className="size-3" aria-hidden />
        {DATE_FORMAT.format(new Date(movement.createdAt))}
      </div>
    </li>
  );
}