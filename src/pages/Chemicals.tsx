import { useEffect, useState, type ReactNode } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Beaker,
  CalendarClock,
  Download,
  FlaskConical,
  MoreHorizontal,
  Plus,
  Search,
  SprayCan,
} from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { ChemicalFormDialog } from '@/components/finance/ChemicalFormDialog';
import { ChemicalMovementDialog } from '@/components/finance/ChemicalMovementDialog';
import { ChemicalUsageDialog } from '@/components/finance/ChemicalUsageDialog';
import { ReasonDialog } from '@/components/finance/ReasonDialog';
import {
  chemicalStockBadge,
  formatDate,
  formatMoney,
  formatNumber,
} from '@/components/finance/labels';
import { ApiError } from '@/services/api';
import { farmsApi } from '@/services/farms';
import { financeApi, hasPermission } from '@/services/finance';
import { useAuthStore } from '@/store/auth.store';
import { useToastStore } from '@/store/toast.store';
import type { ChemicalProduct, ChemicalUsage } from '@/types/finance';

const PAGE_SIZE = 10;

export function Chemicals() {
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.currentOrg?.permissions);
  const canCreate = hasPermission(permissions, 'chemical:create');
  const canUpdate = hasPermission(permissions, 'chemical:update');
  const canDelete = hasPermission(permissions, 'chemical:delete');
  const canUse = hasPermission(permissions, 'chemical:use');
  const canAdjust = hasPermission(permissions, 'chemical:adjust');
  const canReport = hasPermission(permissions, 'finance:report');

  const [tab, setTab] = useState('stock');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [usagePage, setUsagePage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ChemicalProduct | null>(null);
  const [movementProduct, setMovementProduct] = useState<ChemicalProduct | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const [usageProductId, setUsageProductId] = useState<string | undefined>(undefined);
  const [archiveTarget, setArchiveTarget] = useState<ChemicalProduct | null>(null);
  const [cancelUsageTarget, setCancelUsageTarget] = useState<ChemicalUsage | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const productsQuery = useQuery({
    queryKey: ['chemicals', { search: debouncedSearch, page }],
    queryFn: () =>
      financeApi.chemicals.list({
        search: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    retry: 0,
  });

  const usageQuery = useQuery({
    queryKey: ['chemical-usage', usagePage],
    queryFn: () => financeApi.chemicals.usage({ page: usagePage, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    retry: 0,
    enabled: tab === 'usage',
  });

  const alertsQuery = useQuery({
    queryKey: ['chemical-alerts'],
    queryFn: () => financeApi.chemicals.alerts(),
    retry: 0,
    enabled: tab === 'alerts',
  });

  const farmsQuery = useQuery({
    queryKey: ['finance-farms'],
    queryFn: () => farmsApi.list({ pageSize: 100 }),
    retry: 0,
  });

  const activeProductsQuery = useQuery({
    queryKey: ['chemicals', 'active'],
    queryFn: () => financeApi.chemicals.list({ pageSize: 200 }),
    retry: 0,
    enabled: usageOpen || tab === 'alerts',
  });

  const showError =
    productsQuery.error instanceof ApiError
      ? productsQuery.error.message
      : productsQuery.error
        ? 'Could not load chemical stock.'
        : null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['chemicals'] });
    void queryClient.invalidateQueries({ queryKey: ['chemical-usage'] });
    void queryClient.invalidateQueries({ queryKey: ['chemical-alerts'] });
    void queryClient.invalidateQueries({ queryKey: ['finance-overview'] });
  };

  const archiveMutation = useMutation({
    mutationFn: (id: string) => financeApi.chemicals.remove(id),
    onSuccess: () => {
      setArchiveTarget(null);
      invalidate();
      useToastStore.getState().add({ title: 'Chemical archived' });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not archive the chemical',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const cancelUsageMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      financeApi.chemicals.cancelUsage(id, reason),
    onSuccess: () => {
      invalidate();
      useToastStore.getState().add({
        title: 'Usage reversed',
        description: 'The stock has been returned to the batch.',
      });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not reverse the usage',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  async function exportReport(type: 'chemical-usage' | 'chemical-stock') {
    try {
      await financeApi.financial.export(type);
      useToastStore.getState().add({ title: 'Report downloaded' });
    } catch (err) {
      useToastStore.getState().add({
        title: 'Could not download the report',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    }
  }

  const farms = farmsQuery.data?.items ?? [];
  const products = productsQuery.data?.items ?? [];
  const activeProducts = (activeProductsQuery.data?.items ?? []).filter((item) => item.isActive);
  const pageCount = productsQuery.data
    ? Math.max(1, Math.ceil(productsQuery.data.total / PAGE_SIZE))
    : 1;
  const usagePageCount = usageQuery.data
    ? Math.max(1, Math.ceil(usageQuery.data.total / PAGE_SIZE))
    : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-brand-700">Chemical tracking</h2>
          <p className="mt-1 text-sm text-muted">
            Batch-level stock, usage and expiry — with every deduction costed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReport ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="size-4" aria-hidden />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void exportReport('chemical-stock')}>
                  Chemical stock CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportReport('chemical-usage')}>
                  Chemical usage CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {canUse ? (
            <Button
              variant="outline"
              onClick={() => {
                setUsageProductId(undefined);
                setUsageOpen(true);
              }}
            >
              <SprayCan className="size-4" aria-hidden />
              Record usage
            </Button>
          ) : null}
          {canCreate ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              Add chemical
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-2.5 size-4 text-slate-400" aria-hidden />
            <Input
              className="pl-10"
              placeholder="Search products, batches or active ingredients…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search chemicals"
            />
          </div>

          {showError ? (
            <Alert variant="danger">
              <AlertTitle>Could not load chemical stock</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{showError}</p>
                <Button variant="outline" size="sm" onClick={() => void productsQuery.refetch()}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {productsQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="overflow-hidden rounded-[14px] border border-neutral-200 bg-white shadow-soft">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chemical</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Unit cost</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const stock = chemicalStockBadge(product.stockStatus);
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <p className="font-medium text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-500">
                            {[product.activeIngredient, product.formulation, product.supplier]
                              .filter(Boolean)
                              .join(' · ') || 'No product details'}
                          </p>
                        </TableCell>
                        <TableCell className="text-slate-600">{product.batchNumber ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          <p className="font-semibold text-slate-900">
                            {formatNumber(product.availableStock)} {product.unit}
                          </p>
                          <p className="text-xs text-slate-400">
                            min {formatNumber(product.minimumStock)}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-slate-600">
                          {formatMoney(product.unitCost)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-slate-600">
                          {product.expiryDate ? (
                            <span className={product.isExpired ? 'text-red-600' : undefined}>
                              {formatDate(product.expiryDate)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant={stock.variant}>{stock.label}</Badge>
                            {product.isExpired ? (
                              <Badge variant="danger">Expired</Badge>
                            ) : product.daysToExpiry !== null && product.daysToExpiry <= 30 ? (
                              <Badge variant="warning">{product.daysToExpiry}d left</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          {canUse || canAdjust || canUpdate || canDelete ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Chemical actions">
                                  <MoreHorizontal className="size-4" aria-hidden />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canUse ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setUsageProductId(product.id);
                                      setUsageOpen(true);
                                    }}
                                  >
                                    Record usage
                                  </DropdownMenuItem>
                                ) : null}
                                {canAdjust ? (
                                  <DropdownMenuItem onClick={() => setMovementProduct(product)}>
                                    Stock movement
                                  </DropdownMenuItem>
                                ) : null}
                                {canUpdate ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditing(product);
                                      setFormOpen(true);
                                    }}
                                  >
                                    Edit details
                                  </DropdownMenuItem>
                                ) : null}
                                {canDelete ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600 focus:bg-red-50 focus:text-red-700"
                                      onClick={() => setArchiveTarget(product)}
                                    >
                                      Archive
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
                <p className="text-xs text-slate-500">
                  Page {page} of {pageCount}
                </p>
                <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
              </div>
            </div>
          ) : (
            <EmptyState
              icon={FlaskConical}
              title={debouncedSearch ? 'No matching chemicals' : 'No chemical stock yet'}
              description={
                debouncedSearch
                  ? 'Try a different product, batch or active ingredient.'
                  : canCreate
                    ? 'Add a product batch to track stock, usage and expiry.'
                    : 'Chemical stock recorded for your farms will appear here.'
              }
              action={
                canCreate && !debouncedSearch ? (
                  <Button
                    onClick={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="size-4" aria-hidden />
                    Add chemical
                  </Button>
                ) : undefined
              }
            />
          )}
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          {usageQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : usageQuery.data && usageQuery.data.items.length > 0 ? (
            <div className="overflow-hidden rounded-[14px] border border-neutral-200 bg-white shadow-soft">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Chemical</TableHead>
                    <TableHead>Farm / field</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                    <TableHead className="text-right">Stock deducted</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageQuery.data.items.map((usage) => (
                    <TableRow key={usage.id}>
                      <TableCell className="whitespace-nowrap text-slate-600">
                        {formatDate(usage.usageDate)}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-slate-900">{usage.productName}</p>
                        <p className="text-xs text-slate-500">
                          {usage.crop || usage.purpose || usage.applicationMethod || '—'}
                        </p>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        <p>{usage.farmName}</p>
                        {usage.fieldName ? (
                          <p className="text-xs text-slate-400">{usage.fieldName}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-slate-900">
                        {formatNumber(usage.quantityUsed)} {usage.unit}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-slate-600">
                        {formatNumber(usage.quantityDeducted)} {usage.stockUnit}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-slate-600">
                        {usage.totalCostAtUse !== null ? formatMoney(usage.totalCostAtUse) : '—'}
                      </TableCell>
                      <TableCell>
                        {usage.cancelledAt ? (
                          <Badge variant="outline">Reversed</Badge>
                        ) : (
                          <Badge variant="success">Recorded</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {canUse && !usage.cancelledAt ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Usage actions">
                                <MoreHorizontal className="size-4" aria-hidden />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-red-600 focus:bg-red-50 focus:text-red-700"
                                onClick={() => setCancelUsageTarget(usage)}
                              >
                                Reverse usage
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
                <p className="text-xs text-slate-500">
                  Page {usagePage} of {usagePageCount}
                </p>
                <Pagination
                  page={usagePage}
                  pageCount={usagePageCount}
                  onPageChange={setUsagePage}
                />
              </div>
            </div>
          ) : (
            <EmptyState
              icon={SprayCan}
              title="No chemical usage recorded"
              description={
                canUse
                  ? 'Record applications to deduct stock and allocate the cost to a farm.'
                  : 'Chemical applications for your farms will appear here.'
              }
              action={
                canUse ? (
                  <Button
                    onClick={() => {
                      setUsageProductId(undefined);
                      setUsageOpen(true);
                    }}
                  >
                    <Plus className="size-4" aria-hidden />
                    Record usage
                  </Button>
                ) : undefined
              }
            />
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {alertsQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          ) : alertsQuery.data ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <AlertPanel
                title="Low stock"
                icon={<Beaker className="size-4" aria-hidden />}
                items={alertsQuery.data.lowStock}
                empty="No products are at or below their minimum."
              />
              <AlertPanel
                title="Expiring in 30 days"
                icon={<CalendarClock className="size-4" aria-hidden />}
                items={alertsQuery.data.expiringSoon}
                empty="Nothing expires in the next 30 days."
              />
              <AlertPanel
                title="Expired"
                icon={<AlertTriangle className="size-4" aria-hidden />}
                items={alertsQuery.data.expired}
                empty="No expired stock on hand."
              />
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <ChemicalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        farms={farms}
        onSaved={invalidate}
      />

      <ChemicalMovementDialog
        open={Boolean(movementProduct)}
        onOpenChange={(open) => {
          if (!open) setMovementProduct(null);
        }}
        product={movementProduct}
        farms={farms}
        onSaved={invalidate}
      />

      <ChemicalUsageDialog
        open={usageOpen}
        onOpenChange={setUsageOpen}
        products={activeProducts}
        farms={farms}
        initialProductId={usageProductId}
        onSaved={invalidate}
      />

      <ReasonDialog
        open={Boolean(cancelUsageTarget)}
        onOpenChange={(open) => {
          if (!open) setCancelUsageTarget(null);
        }}
        title="Reverse chemical usage"
        description="The recorded quantity will be added back to the batch. The original usage stays on record."
        actionLabel="Reverse usage"
        destructive
        onSubmit={async (reason) => {
          if (!cancelUsageTarget) return;
          await cancelUsageMutation.mutateAsync({ id: cancelUsageTarget.id, reason });
        }}
      />

      <AlertDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this chemical?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be hidden from the active stock list. Usage history stays intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (archiveTarget) archiveMutation.mutate(archiveTarget.id);
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AlertPanel({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: ReactNode;
  items: ChemicalProduct[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <Badge variant={items.length > 0 ? 'warning' : 'success'}>{items.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">{empty}</p>
        ) : (
          items.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-neutral-100 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{product.name}</p>
                <p className="text-xs text-slate-500">
                  {product.batchNumber ? `${product.batchNumber} · ` : ''}
                  {formatNumber(product.availableStock)} {product.unit}
                </p>
              </div>
              {product.daysToExpiry !== null ? (
                <span className="shrink-0 text-xs font-medium text-amber-700">
                  {product.daysToExpiry < 0
                    ? `${Math.abs(product.daysToExpiry)}d ago`
                    : `${product.daysToExpiry}d`}
                </span>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
