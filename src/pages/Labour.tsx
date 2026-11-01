import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, HardHat, MoreHorizontal, Plus, Search, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EngagementFormDialog } from '@/components/finance/EngagementFormDialog';
import { LabourerFormDialog } from '@/components/finance/LabourerFormDialog';
import { PaymentDialog } from '@/components/finance/PaymentDialog';
import { ReasonDialog } from '@/components/finance/ReasonDialog';
import {
  approvalBadge,
  formatDate,
  formatMoney,
  paymentBadge,
  pricingLabel,
} from '@/components/finance/labels';
import { ApiError } from '@/services/api';
import { farmsApi } from '@/services/farms';
import { financeApi, hasPermission } from '@/services/finance';
import { useAuthStore } from '@/store/auth.store';
import { useToastStore } from '@/store/toast.store';
import type {
  ApprovalStatus,
  ExternalLabourer,
  LabourEngagement,
  PaymentInput,
  PaymentStatus,
} from '@/types/finance';

const PAGE_SIZE = 10;

export function Labour() {
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.currentOrg?.permissions);
  const canCreate = hasPermission(permissions, 'labour:create');
  const canUpdate = hasPermission(permissions, 'labour:update');
  const canApprove = hasPermission(permissions, 'labour:approve');
  const canPay = hasPermission(permissions, 'labour:pay');
  const canReport = hasPermission(permissions, 'finance:report');

  const [tab, setTab] = useState('engagements');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [farmId, setFarmId] = useState('all');
  const [approvalStatus, setApprovalStatus] = useState<'all' | ApprovalStatus>('all');
  const [paymentStatus, setPaymentStatus] = useState<'all' | PaymentStatus>('all');
  const [page, setPage] = useState(1);
  const [labourerSearch, setLabourerSearch] = useState('');

  const [engagementFormOpen, setEngagementFormOpen] = useState(false);
  const [editingEngagement, setEditingEngagement] = useState<LabourEngagement | null>(null);
  const [labourerFormOpen, setLabourerFormOpen] = useState(false);
  const [editingLabourer, setEditingLabourer] = useState<ExternalLabourer | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<LabourEngagement | null>(null);
  const [reasonTarget, setReasonTarget] = useState<{
    kind: 'reject' | 'cancel';
    engagement: LabourEngagement;
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, farmId, approvalStatus, paymentStatus]);

  const engagementsQuery = useQuery({
    queryKey: [
      'labour-engagements',
      { search: debouncedSearch, farmId, approvalStatus, paymentStatus, page },
    ],
    queryFn: () =>
      financeApi.labour.engagements({
        search: debouncedSearch || undefined,
        farmId: farmId === 'all' ? undefined : farmId,
        approvalStatus: approvalStatus === 'all' ? undefined : approvalStatus,
        paymentStatus: paymentStatus === 'all' ? undefined : paymentStatus,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    retry: 0,
  });

  const labourersQuery = useQuery({
    queryKey: ['labourers', labourerSearch],
    queryFn: () =>
      financeApi.labour.labourers({
        search: labourerSearch || undefined,
        pageSize: 200,
      }),
    placeholderData: keepPreviousData,
    retry: 0,
  });

  const farmsQuery = useQuery({
    queryKey: ['finance-farms'],
    queryFn: () => farmsApi.list({ pageSize: 100 }),
    retry: 0,
  });

  const listError =
    engagementsQuery.error instanceof ApiError
      ? engagementsQuery.error.message
      : engagementsQuery.error
        ? 'Could not load labour records.'
        : null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['labour-engagements'] });
    void queryClient.invalidateQueries({ queryKey: ['labourers'] });
    void queryClient.invalidateQueries({ queryKey: ['finance-overview'] });
    void queryClient.invalidateQueries({ queryKey: ['cost-analysis'] });
  };

  const actionMutation = useMutation({
    mutationFn: async (variables: {
      engagement: LabourEngagement;
      action: 'submit' | 'approve' | 'reject' | 'cancel';
      reason?: string;
    }) => {
      const { engagement, action, reason } = variables;
      switch (action) {
        case 'submit':
          return financeApi.labour.submit(engagement.id);
        case 'approve':
          return financeApi.labour.approve(engagement.id);
        case 'reject':
          return financeApi.labour.reject(engagement.id, reason ?? '');
        case 'cancel':
          return financeApi.labour.cancel(engagement.id, reason ?? '');
      }
    },
    onSuccess: (_data, variables) => {
      invalidate();
      useToastStore.getState().add({
        title:
          variables.action === 'approve'
            ? 'Engagement approved'
            : variables.action === 'reject'
              ? 'Engagement rejected'
              : variables.action === 'cancel'
                ? 'Engagement cancelled'
                : 'Engagement submitted',
      });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not update the engagement',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: PaymentInput }) =>
      financeApi.labour.addPayment(id, input),
    onSuccess: () => {
      invalidate();
      useToastStore.getState().add({ title: 'Labour payment recorded' });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not record the payment',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  async function exportReport(type: 'labour-engagements' | 'labour-payments') {
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
  const labourers = labourersQuery.data?.items ?? [];
  const pageCount = engagementsQuery.data
    ? Math.max(1, Math.ceil(engagementsQuery.data.total / PAGE_SIZE))
    : 1;
  const hasFilters =
    debouncedSearch !== '' ||
    farmId !== 'all' ||
    approvalStatus !== 'all' ||
    paymentStatus !== 'all';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-brand-700">External labour</h2>
          <p className="mt-1 text-sm text-muted">
            Agreed work, approvals and payments for contractors and crews.
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
                <DropdownMenuItem onClick={() => void exportReport('labour-engagements')}>
                  Engagements CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportReport('labour-payments')}>
                  Payments CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {canCreate ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingLabourer(null);
                  setLabourerFormOpen(true);
                }}
              >
                <Users className="size-4" aria-hidden />
                Add labourer
              </Button>
              <Button
                onClick={() => {
                  setEditingEngagement(null);
                  setEngagementFormOpen(true);
                }}
              >
                <Plus className="size-4" aria-hidden />
                Record engagement
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="engagements">Engagements</TabsTrigger>
          <TabsTrigger value="labourers">Labourers</TabsTrigger>
        </TabsList>

        <TabsContent value="engagements" className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-2.5 size-4 text-slate-400" aria-hidden />
              <Input
                className="pl-10"
                placeholder="Search work type, labourer or notes…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search engagements"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-auto">
              <Select value={farmId} onValueChange={setFarmId}>
                <SelectTrigger aria-label="Filter by farm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All farms</SelectItem>
                  {farms.map((farm) => (
                    <SelectItem key={farm.id} value={farm.id}>
                      {farm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={approvalStatus}
                onValueChange={(value) => setApprovalStatus(value as 'all' | ApprovalStatus)}
              >
                <SelectTrigger aria-label="Filter by approval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All approvals</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Pending approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={paymentStatus}
                onValueChange={(value) => setPaymentStatus(value as 'all' | PaymentStatus)}
              >
                <SelectTrigger aria-label="Filter by payment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payments</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partially_paid">Part paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {listError ? (
            <Alert variant="danger">
              <AlertTitle>Could not load labour records</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{listError}</p>
                <Button variant="outline" size="sm" onClick={() => void engagementsQuery.refetch()}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {engagementsQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : engagementsQuery.data && engagementsQuery.data.items.length > 0 ? (
            <div className="overflow-hidden rounded-[14px] border border-neutral-200 bg-white shadow-soft">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Work</TableHead>
                    <TableHead>Farm</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-right">Agreed</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {engagementsQuery.data.items.map((engagement) => {
                    const approval = approvalBadge(engagement.approvalStatus);
                    const payment = paymentBadge(engagement.paymentStatus);
                    const editable =
                      canUpdate &&
                      (engagement.approvalStatus === 'draft' ||
                        engagement.approvalStatus === 'rejected');
                    const canCancel =
                      canUpdate &&
                      (engagement.approvalStatus === 'submitted' ||
                        engagement.approvalStatus === 'approved');
                    const hasActions =
                      editable ||
                      (canApprove && engagement.approvalStatus === 'submitted') ||
                      (canPay &&
                        engagement.approvalStatus === 'approved' &&
                        engagement.outstanding > 0) ||
                      canCancel;

                    return (
                      <TableRow key={engagement.id}>
                        <TableCell>
                          <p className="font-medium text-slate-900">{engagement.workType}</p>
                          <p className="text-xs text-slate-500">
                            {engagement.labourerName} · {pricingLabel(engagement.pricingMethod)}
                          </p>
                        </TableCell>
                        <TableCell className="text-slate-600">
                          <p>{engagement.farmName}</p>
                          {engagement.fieldName ? (
                            <p className="text-xs text-slate-400">{engagement.fieldName}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-slate-600">
                          {formatDate(engagement.startDate)}
                          {engagement.completionDate
                            ? ` – ${formatDate(engagement.completionDate)}`
                            : ''}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-semibold text-slate-900">
                          {formatMoney(engagement.agreedTotal)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-slate-600">
                          {engagement.outstanding > 0
                            ? formatMoney(engagement.outstanding)
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant={approval.variant}>{approval.label}</Badge>
                            <Badge variant={payment.variant}>{payment.label}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {hasActions ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Engagement actions">
                                  <MoreHorizontal className="size-4" aria-hidden />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {editable ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingEngagement(engagement);
                                      setEngagementFormOpen(true);
                                    }}
                                  >
                                    Edit
                                  </DropdownMenuItem>
                                ) : null}
                                {editable ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      actionMutation.mutate({ engagement, action: 'submit' })
                                    }
                                  >
                                    Submit for approval
                                  </DropdownMenuItem>
                                ) : null}
                                {canApprove && engagement.approvalStatus === 'submitted' ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      actionMutation.mutate({ engagement, action: 'approve' })
                                    }
                                  >
                                    Approve
                                  </DropdownMenuItem>
                                ) : null}
                                {canApprove && engagement.approvalStatus === 'submitted' ? (
                                  <DropdownMenuItem
                                    onClick={() => setReasonTarget({ kind: 'reject', engagement })}
                                  >
                                    Reject
                                  </DropdownMenuItem>
                                ) : null}
                                {canPay &&
                                engagement.approvalStatus === 'approved' &&
                                engagement.outstanding > 0 ? (
                                  <DropdownMenuItem onClick={() => setPaymentTarget(engagement)}>
                                    Record payment
                                  </DropdownMenuItem>
                                ) : null}
                                {canCancel ? (
                                  <DropdownMenuItem
                                    onClick={() => setReasonTarget({ kind: 'cancel', engagement })}
                                  >
                                    Cancel engagement
                                  </DropdownMenuItem>
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
              icon={HardHat}
              title={hasFilters ? 'No matching engagements' : 'No labour engagements yet'}
              description={
                hasFilters
                  ? 'Try clearing the filters or searching for something else.'
                  : canCreate
                    ? 'Record agreed work for a labourer or contractor to start tracking costs.'
                    : 'Labour engagements for your farms will appear here.'
              }
              action={
                canCreate && !hasFilters ? (
                  <Button
                    onClick={() => {
                      setEditingEngagement(null);
                      setEngagementFormOpen(true);
                    }}
                  >
                    <Plus className="size-4" aria-hidden />
                    Record engagement
                  </Button>
                ) : undefined
              }
            />
          )}
        </TabsContent>

        <TabsContent value="labourers" className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-2.5 size-4 text-slate-400" aria-hidden />
            <Input
              className="pl-10"
              placeholder="Search labourers by name, phone or type…"
              value={labourerSearch}
              onChange={(event) => setLabourerSearch(event.target.value)}
              aria-label="Search labourers"
            />
          </div>

          {labourersQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : labourers.length > 0 ? (
            <div className="overflow-hidden rounded-[14px] border border-neutral-200 bg-white shadow-soft">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labourers.map((labourer) => (
                    <TableRow key={labourer.id}>
                      <TableCell>
                        <p className="font-medium text-slate-900">{labourer.name}</p>
                        <p className="text-xs text-slate-500">
                          {labourer.isContractor ? 'Contractor' : 'External worker'}
                          {labourer.businessName ? ` · ${labourer.businessName}` : ''}
                        </p>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        <p>{labourer.phone ?? '—'}</p>
                        {labourer.email ? (
                          <p className="text-xs text-slate-400">{labourer.email}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-slate-600">{labourer.labourType ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={labourer.status === 'active' ? 'success' : 'outline'}>
                          {labourer.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {canUpdate ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Labourer actions">
                                <MoreHorizontal className="size-4" aria-hidden />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingLabourer(labourer);
                                  setLabourerFormOpen(true);
                                }}
                              >
                                Edit details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title={labourerSearch ? 'No matching labourers' : 'No external labourers yet'}
              description={
                labourerSearch
                  ? 'Try a different name, phone or labour type.'
                  : canCreate
                    ? 'Add the contractors and crews you work with.'
                    : 'External labourers recorded for your farms will appear here.'
              }
              action={
                canCreate && !labourerSearch ? (
                  <Button
                    onClick={() => {
                      setEditingLabourer(null);
                      setLabourerFormOpen(true);
                    }}
                  >
                    <Plus className="size-4" aria-hidden />
                    Add labourer
                  </Button>
                ) : undefined
              }
            />
          )}
        </TabsContent>
      </Tabs>

      <EngagementFormDialog
        open={engagementFormOpen}
        onOpenChange={setEngagementFormOpen}
        engagement={editingEngagement}
        labourers={labourers}
        farms={farms}
        onSaved={invalidate}
      />

      <LabourerFormDialog
        open={labourerFormOpen}
        onOpenChange={setLabourerFormOpen}
        labourer={editingLabourer}
        onSaved={invalidate}
      />

      <PaymentDialog
        open={Boolean(paymentTarget)}
        onOpenChange={(open) => {
          if (!open) setPaymentTarget(null);
        }}
        title="Record labour payment"
        description={
          paymentTarget
            ? `${paymentTarget.labourerName} · ${paymentTarget.workType} · Outstanding ${formatMoney(paymentTarget.outstanding)}`
            : undefined
        }
        outstanding={paymentTarget?.outstanding ?? 0}
        onSubmit={async (input) => {
          if (!paymentTarget) return;
          await paymentMutation.mutateAsync({ id: paymentTarget.id, input });
        }}
      />

      <ReasonDialog
        open={Boolean(reasonTarget)}
        onOpenChange={(open) => {
          if (!open) setReasonTarget(null);
        }}
        title={reasonTarget?.kind === 'reject' ? 'Reject engagement' : 'Cancel engagement'}
        description={
          reasonTarget?.kind === 'reject'
            ? 'Give the reason so the engagement can be corrected.'
            : 'The engagement stays on record but will be excluded from costs.'
        }
        actionLabel={reasonTarget?.kind === 'reject' ? 'Reject engagement' : 'Cancel engagement'}
        destructive={reasonTarget?.kind === 'reject'}
        onSubmit={async (reason) => {
          if (!reasonTarget) return;
          await actionMutation.mutateAsync({
            engagement: reasonTarget.engagement,
            action: reasonTarget.kind,
            reason,
          });
        }}
      />
    </div>
  );
}
