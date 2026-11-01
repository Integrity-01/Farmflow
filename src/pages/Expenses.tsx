import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ListFilter, MoreHorizontal, Plus, Search, Wallet } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { ExpenseFormDialog } from '@/components/finance/ExpenseFormDialog';
import { PaymentDialog } from '@/components/finance/PaymentDialog';
import { ReasonDialog } from '@/components/finance/ReasonDialog';
import {
  approvalBadge,
  formatDate,
  formatMoney,
  moduleLabel,
  paymentBadge,
} from '@/components/finance/labels';
import { ApiError } from '@/services/api';
import { farmsApi } from '@/services/farms';
import { financeApi, hasPermission } from '@/services/finance';
import { useAuthStore } from '@/store/auth.store';
import { useToastStore } from '@/store/toast.store';
import type {
  ApprovalStatus,
  ExpenseRecord,
  PaymentInput,
  PaymentStatus,
} from '@/types/finance';

const PAGE_SIZE = 10;

export function Expenses() {
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.currentOrg?.permissions);
  const canCreate = hasPermission(permissions, 'expense:create');
  const canUpdate = hasPermission(permissions, 'expense:update');
  const canDelete = hasPermission(permissions, 'expense:delete');
  const canApprove = hasPermission(permissions, 'expense:approve');
  const canPay = hasPermission(permissions, 'expense:pay');
  const canReport = hasPermission(permissions, 'finance:report');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [farmId, setFarmId] = useState('all');
  const [approvalStatus, setApprovalStatus] = useState<'all' | ApprovalStatus>('all');
  const [paymentStatus, setPaymentStatus] = useState<'all' | PaymentStatus>('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<ExpenseRecord | null>(null);
  const [reasonTarget, setReasonTarget] = useState<{
    kind: 'reject' | 'cancel';
    expense: ExpenseRecord;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRecord | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, farmId, approvalStatus, paymentStatus]);

  const expensesQuery = useQuery({
    queryKey: [
      'expenses',
      { search: debouncedSearch, farmId, approvalStatus, paymentStatus, page },
    ],
    queryFn: () =>
      financeApi.expenses.list({
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

  const farmsQuery = useQuery({
    queryKey: ['finance-farms'],
    queryFn: () => farmsApi.list({ pageSize: 100 }),
    retry: 0,
  });

  const categoriesQuery = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => financeApi.expenses.categories(),
    retry: 0,
  });

  const listError =
    expensesQuery.error instanceof ApiError
      ? expensesQuery.error.message
      : expensesQuery.error
        ? 'Could not load expenses.'
        : null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['expenses'] });
    void queryClient.invalidateQueries({ queryKey: ['finance-overview'] });
    void queryClient.invalidateQueries({ queryKey: ['cost-analysis'] });
  };

  const actionMutation = useMutation({
    mutationFn: async (variables: {
      expense: ExpenseRecord;
      action: 'submit' | 'approve' | 'reject' | 'cancel';
      reason?: string;
    }) => {
      const { expense, action, reason } = variables;
      switch (action) {
        case 'submit':
          return financeApi.expenses.submit(expense.id);
        case 'approve':
          return financeApi.expenses.approve(expense.id);
        case 'reject':
          return financeApi.expenses.reject(expense.id, reason ?? '');
        case 'cancel':
          return financeApi.expenses.cancel(expense.id, reason ?? '');
      }
    },
    onSuccess: (_data, variables) => {
      invalidate();
      useToastStore.getState().add({
        title:
          variables.action === 'approve'
            ? 'Expense approved'
            : variables.action === 'reject'
              ? 'Expense rejected'
              : variables.action === 'cancel'
                ? 'Expense cancelled'
                : 'Expense submitted',
      });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not update the expense',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeApi.expenses.remove(id),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
      useToastStore.getState().add({ title: 'Draft deleted' });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not delete the draft',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: PaymentInput }) =>
      financeApi.expenses.addPayment(id, input),
    onSuccess: () => {
      invalidate();
      useToastStore.getState().add({ title: 'Payment recorded' });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not record the payment',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  async function exportCsv() {
    try {
      await financeApi.financial.export('expenses');
      useToastStore.getState().add({ title: 'Expense report downloaded' });
    } catch (err) {
      useToastStore.getState().add({
        title: 'Could not export expenses',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    }
  }

  const farms = farmsQuery.data?.items ?? [];
  const categories = categoriesQuery.data ?? [];
  const pageCount = expensesQuery.data
    ? Math.max(1, Math.ceil(expensesQuery.data.total / PAGE_SIZE))
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
          <h2 className="text-2xl font-bold tracking-tight text-brand-700">Farm expenses</h2>
          <p className="mt-1 text-sm text-muted">
            {expensesQuery.data && !expensesQuery.isFetching
              ? `${expensesQuery.data.total} expense${expensesQuery.data.total === 1 ? '' : 's'}`
              : 'Record costs, approvals and payments'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReport ? (
            <Button variant="outline" onClick={() => void exportCsv()}>
              <Download className="size-4" aria-hidden />
              Export
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
              Record expense
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 size-4 text-slate-400" aria-hidden />
          <Input
            className="pl-10"
            placeholder="Search descriptions, suppliers or references…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search expenses"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-auto">
          <Select value={farmId} onValueChange={setFarmId}>
            <SelectTrigger aria-label="Filter by farm">
              <span className="flex items-center gap-2 truncate">
                <ListFilter className="size-4 shrink-0 text-slate-400" aria-hidden />
                <SelectValue />
              </span>
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
          <AlertTitle>Could not load expenses</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{listError}</p>
            <Button variant="outline" size="sm" onClick={() => void expensesQuery.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {expensesQuery.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : expensesQuery.data && expensesQuery.data.items.length > 0 ? (
        <div className="overflow-hidden rounded-[14px] border border-neutral-200 bg-white shadow-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Expense</TableHead>
                <TableHead>Farm / field</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expensesQuery.data.items.map((expense) => {
                const approval = approvalBadge(expense.approvalStatus);
                const payment = paymentBadge(expense.paymentStatus);
                const editable =
                  canUpdate &&
                  (expense.approvalStatus === 'draft' || expense.approvalStatus === 'rejected');
                const canCancel =
                  canUpdate &&
                  (expense.approvalStatus === 'submitted' || expense.approvalStatus === 'approved');
                const hasActions =
                  editable ||
                  (canApprove && expense.approvalStatus === 'submitted') ||
                  (canPay && expense.approvalStatus === 'approved' && expense.outstanding > 0) ||
                  canCancel ||
                  (canDelete && expense.approvalStatus === 'draft');

                return (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap text-slate-600">
                      {formatDate(expense.expenseDate)}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{expense.description}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {expense.categoryName} · {moduleLabel(expense.categoryModule)}
                          {expense.supplier ? ` · ${expense.supplier}` : ''}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      <p className="truncate">{expense.farmName}</p>
                      {expense.fieldName ? (
                        <p className="text-xs text-slate-400">{expense.fieldName}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold text-slate-900">
                      {formatMoney(expense.amount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-slate-600">
                      {expense.outstanding > 0 ? formatMoney(expense.outstanding) : '—'}
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
                            <Button variant="ghost" size="icon" aria-label="Expense actions">
                              <MoreHorizontal className="size-4" aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {editable ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(expense);
                                  setFormOpen(true);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                            ) : null}
                            {editable ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  actionMutation.mutate({ expense, action: 'submit' })
                                }
                              >
                                Submit for approval
                              </DropdownMenuItem>
                            ) : null}
                            {canApprove && expense.approvalStatus === 'submitted' ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  actionMutation.mutate({ expense, action: 'approve' })
                                }
                              >
                                Approve
                              </DropdownMenuItem>
                            ) : null}
                            {canApprove && expense.approvalStatus === 'submitted' ? (
                              <DropdownMenuItem
                                onClick={() => setReasonTarget({ kind: 'reject', expense })}
                              >
                                Reject
                              </DropdownMenuItem>
                            ) : null}
                            {canPay &&
                            expense.approvalStatus === 'approved' &&
                            expense.outstanding > 0 ? (
                              <DropdownMenuItem onClick={() => setPaymentTarget(expense)}>
                                Record payment
                              </DropdownMenuItem>
                            ) : null}
                            {canCancel ? (
                              <DropdownMenuItem
                                onClick={() => setReasonTarget({ kind: 'cancel', expense })}
                              >
                                Cancel expense
                              </DropdownMenuItem>
                            ) : null}
                            {canDelete && expense.approvalStatus === 'draft' ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:bg-red-50 focus:text-red-700"
                                  onClick={() => setDeleteTarget(expense)}
                                >
                                  Delete draft
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
          icon={Wallet}
          title={hasFilters ? 'No matching expenses' : 'No expenses yet'}
          description={
            hasFilters
              ? 'Try clearing the filters or searching for something else.'
              : canCreate
                ? 'Record your first farm cost to start tracking approvals and payments.'
                : 'Expenses recorded for your farms will appear here.'
          }
          action={
            canCreate && !hasFilters ? (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-4" aria-hidden />
                Record expense
              </Button>
            ) : undefined
          }
        />
      )}

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={editing}
        categories={categories}
        farms={farms}
        onSaved={invalidate}
      />

      <PaymentDialog
        open={Boolean(paymentTarget)}
        onOpenChange={(open) => {
          if (!open) setPaymentTarget(null);
        }}
        title="Record expense payment"
        description={
          paymentTarget
            ? `${paymentTarget.description} · Outstanding ${formatMoney(paymentTarget.outstanding)}`
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
        title={reasonTarget?.kind === 'reject' ? 'Reject expense' : 'Cancel expense'}
        description={
          reasonTarget?.kind === 'reject'
            ? 'Give the reason so the person who recorded it can fix it.'
            : 'The expense stays on record but will be excluded from reported costs.'
        }
        actionLabel={reasonTarget?.kind === 'reject' ? 'Reject expense' : 'Cancel expense'}
        destructive={reasonTarget?.kind === 'reject'}
        onSubmit={async (reason) => {
          if (!reasonTarget) return;
          await actionMutation.mutateAsync({
            expense: reasonTarget.expense,
            action: reasonTarget.kind,
            reason,
          });
        }}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Only drafts can be deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
