import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Landmark,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { BudgetDialog } from '@/components/finance/BudgetDialog';
import {
  formatDate,
  formatMoney,
  formatNumber,
  moduleLabel,
  monthStart,
  today,
} from '@/components/finance/labels';
import { ApiError } from '@/services/api';
import { farmsApi } from '@/services/farms';
import { financeApi, hasPermission } from '@/services/finance';
import { useAuthStore } from '@/store/auth.store';
import { useToastStore } from '@/store/toast.store';
import type { CostAnalysis, ExportType, FarmBudget, FinancialOverview } from '@/types/finance';

type GroupBy = 'farm' | 'field' | 'category';

const GROUP_OPTIONS: Array<{ value: GroupBy; label: string }> = [
  { value: 'farm', label: 'By farm' },
  { value: 'field', label: 'By field' },
  { value: 'category', label: 'By category' },
];

const EXPORT_OPTIONS: Array<{ value: ExportType; label: string }> = [
  { value: 'expenses', label: 'Expenses' },
  { value: 'chemical-usage', label: 'Chemical usage' },
  { value: 'chemical-stock', label: 'Chemical stock' },
  { value: 'labour-engagements', label: 'Labour engagements' },
  { value: 'labour-payments', label: 'Labour payments' },
  { value: 'outstanding-payments', label: 'Outstanding payments' },
  { value: 'budget-vs-actual', label: 'Budget vs actual' },
  { value: 'farm-cost-summary', label: 'Farm cost summary' },
];

export function FarmCosts() {
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.currentOrg?.permissions);
  const canReport = hasPermission(permissions, 'finance:report');

  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [farmId, setFarmId] = useState('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('farm');
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<FarmBudget | null>(null);

  const params = useMemo(
    () => ({
      dateFrom,
      dateTo,
      farmId: farmId === 'all' ? undefined : farmId,
    }),
    [dateFrom, dateTo, farmId],
  );

  const farmsQuery = useQuery({
    queryKey: ['finance-farms'],
    queryFn: () => farmsApi.list({ pageSize: 100 }),
    retry: 0,
  });

  const overviewQuery = useQuery({
    queryKey: ['finance-overview', params],
    queryFn: () => financeApi.financial.overview(params),
    retry: 0,
  });

  const costQuery = useQuery({
    queryKey: ['cost-analysis', { ...params, groupBy }],
    queryFn: () => financeApi.financial.costAnalysis({ ...params, groupBy }),
    retry: 0,
  });

  const budgetsQuery = useQuery({
    queryKey: ['budgets', params],
    queryFn: () => financeApi.financial.budgets(params),
    retry: 0,
  });

  const listError =
    overviewQuery.error instanceof ApiError
      ? overviewQuery.error.message
      : overviewQuery.error
        ? 'Could not load financial data.'
        : null;

  async function exportReport(type: ExportType) {
    try {
      await financeApi.financial.export(type, params);
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
  const overview = overviewQuery.data;
  const cost = costQuery.data;
  const budgets = budgetsQuery.data ?? [];
  const cards = overview?.cards;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-brand-700">Farm costs</h2>
          <p className="mt-1 text-sm text-muted">
            Overview, cost analysis and budgets for the selected period.
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
              <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                {EXPORT_OPTIONS.map((option) => (
                  <DropdownMenuItem key={option.value} onClick={() => void exportReport(option.value)}>
                    {option.label} CSV
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Button
            onClick={() => {
              setEditingBudget(null);
              setBudgetOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Set budget
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex-1">
          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>From</span>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>To</span>
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>Farm</span>
            <Select value={farmId} onValueChange={setFarmId}>
              <SelectTrigger>
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
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>Group by</span>
            <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      </div>

      {listError ? (
        <Alert variant="danger">
          <AlertTitle>Could not load financial data</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{listError}</p>
            <Button variant="outline" size="sm" onClick={() => void overviewQuery.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {overviewQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : cards ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total spend"
            value={formatMoney(cards.totalSpend)}
            hint={`${cards.expenseCount} approved expense${cards.expenseCount === 1 ? '' : 's'}`}
            icon={<Wallet className="size-4" aria-hidden />}
            tone="green"
          />
          <MetricCard
            label="Budget"
            value={formatMoney(cards.budget)}
            hint={
              cards.budgetUtilisation !== null
                ? `${cards.budgetUtilisation}% used`
                : 'No budget set for this period'
            }
            icon={<Landmark className="size-4" aria-hidden />}
            tone={
              cards.budgetUtilisation !== null && cards.budgetUtilisation > 100
                ? 'danger'
                : 'lime'
            }
          />
          <MetricCard
            label="Unpaid + labour due"
            value={formatMoney(cards.unpaidValue + cards.outstandingLabour)}
            hint={`${cards.unpaidCount} unpaid expense${cards.unpaidCount === 1 ? '' : 's'}`}
            icon={<Receipt className="size-4" aria-hidden />}
            tone="orange"
          />
          <MetricCard
            label="Awaiting approval"
            value={formatMoney(cards.pendingApprovalValue)}
            hint={`${cards.pendingApprovalCount} submitted`}
            icon={<TrendingUp className="size-4" aria-hidden />}
            tone="orange"
          />
        </div>
      ) : null}

      {cards ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SplitCard label="Chemical" value={cards.chemicalSpend} total={cards.totalSpend} tone="green" />
          <SplitCard label="Labour" value={cards.labourSpend} total={cards.totalSpend} tone="lime" />
          <SplitCard label="Other" value={cards.otherSpend} total={cards.totalSpend} tone="neutral" />
          <Card>
            <CardHeader>
              <CardTitle>Stock alerts</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4 text-sm">
              <span>
                <span className={`block text-lg font-bold ${cards.lowStockCount > 0 ? 'text-orange-700' : 'text-neutral-950'}`}>
                  {cards.lowStockCount}
                </span>
                <span className="text-xs text-muted">low stock</span>
              </span>
              <span>
                <span className={`block text-lg font-bold ${cards.expiringCount > 0 ? 'text-orange-700' : 'text-neutral-950'}`}>
                  {cards.expiringCount}
                </span>
                <span className="text-xs text-muted">expiring soon</span>
              </span>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cost analysis</CardTitle>
            <Badge variant="outline">{GROUP_OPTIONS.find((item) => item.value === groupBy)?.label}</Badge>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {costQuery.isLoading ? (
              <div className="space-y-2 px-5 pb-5">
                {[0, 1, 2].map((item) => (
                  <Skeleton key={item} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : cost && cost.groups.length > 0 ? (
              <CostTable analysis={cost} />
            ) : (
              <p className="px-5 pb-5 text-sm text-slate-500">
                No approved expenses in this period yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>6-month trend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overview && overview.monthlyTrend.length > 0 ? (
              <TrendBars data={overview.monthlyTrend} />
            ) : (
              <p className="text-sm text-slate-500">No trend data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overview && overview.topCategories.length > 0 ? (
              overview.topCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-neutral-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{category.name}</p>
                    <p className="text-xs text-slate-500">
                      {moduleLabel(category.module)} · {category.count} record
                      {category.count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-900">
                    {formatMoney(category.total)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No spending in this period.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent expenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overview && overview.recentExpenses.length > 0 ? (
              overview.recentExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-neutral-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {expense.description}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(expense.expenseDate)} · {expense.farmName} ·{' '}
                      {expense.categoryName}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-900">
                    {formatMoney(expense.amount)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No recent expenses.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budgets</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingBudget(null);
              setBudgetOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add budget
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {budgetsQuery.isLoading ? (
            <div className="space-y-2 px-5 pb-5">
              {[0, 1].map((item) => (
                <Skeleton key={item} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : budgets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Farm</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((budget) => (
                  <TableRow key={budget.id}>
                    <TableCell className="font-medium text-slate-900">{budget.farmName}</TableCell>
                    <TableCell className="whitespace-nowrap text-slate-600">
                      {formatDate(budget.periodStart)} – {formatDate(budget.periodEnd)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold text-slate-900">
                      {formatMoney(budget.amount)}
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-slate-600">
                      {budget.notes ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingBudget(budget);
                          setBudgetOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="pb-5">
              <EmptyState
                icon={Landmark}
                title="No budgets set"
                description="Set a budget per farm and period to see variance and utilisation."
              />
            </div>
          )}
        </CardContent>
      </Card>

      <BudgetDialog
        open={budgetOpen}
        onOpenChange={setBudgetOpen}
        budget={editingBudget}
        farms={farms}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ['budgets'] });
          void queryClient.invalidateQueries({ queryKey: ['cost-analysis'] });
          void queryClient.invalidateQueries({ queryKey: ['finance-overview'] });
        }}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = 'green',
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone?: 'green' | 'lime' | 'orange' | 'danger';
}) {
  const iconTone = {
    green: 'bg-brand-50 text-brand-700',
    lime: 'bg-accent-100 text-brand-600',
    orange: 'bg-orange-50 text-orange-700',
    danger: 'bg-red-50 text-red-600',
  }[tone];

  return (
    <Card>
      <CardContent className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <span className={`flex size-8 items-center justify-center rounded-lg ${iconTone}`}>
            {icon}
          </span>
        </div>
        <p className="text-xl font-bold tracking-tight text-neutral-950">{value}</p>
        <p className="text-xs text-muted">{hint}</p>
      </CardContent>
    </Card>
  );
}

function SplitCard({
  label,
  value,
  total,
  tone = 'green',
}: {
  label: string;
  value: number;
  total: number;
  tone?: 'green' | 'lime' | 'neutral';
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  const barTone = {
    green: 'bg-brand-500',
    lime: 'bg-accent-500',
    neutral: 'bg-neutral-400',
  }[tone];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <span className="text-xs font-medium text-muted">{percent}%</span>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-lg font-bold text-neutral-950">{formatMoney(value)}</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full ${barTone}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function TrendBars({ data }: { data: FinancialOverview['monthlyTrend'] }) {
  const max = Math.max(...data.map((item) => item.total), 1);
  return (
    <div className="flex h-36 items-end gap-2">
      {data.map((item) => (
        <div key={item.month} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-lg bg-brand-500/80"
              style={{ height: `${Math.max((item.total / max) * 100, 2)}%` }}
              title={`${item.month}: ${formatMoney(item.total)}`}
            />
          </div>
          <span className="text-[10px] text-slate-400">{item.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function CostTable({ analysis }: { analysis: CostAnalysis }) {
  if (analysis.groupBy === 'category') {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Module</TableHead>
            <TableHead className="text-right">Records</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {analysis.groups.map((group) => (
            <TableRow key={group.id}>
              <TableCell className="font-medium text-slate-900">{group.name}</TableCell>
              <TableCell className="text-slate-600">{moduleLabel(group.module ?? 'other')}</TableCell>
              <TableCell className="text-right text-slate-600">{group.count}</TableCell>
              <TableCell className="text-right font-semibold text-slate-900">
                {formatMoney(group.total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  const isFarm = analysis.groupBy === 'farm';
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{isFarm ? 'Farm' : 'Field'}</TableHead>
          {!isFarm ? <TableHead>Farm</TableHead> : null}
          {isFarm ? <TableHead className="text-right">Size</TableHead> : null}
          <TableHead className="text-right">Chemical</TableHead>
          <TableHead className="text-right">Labour</TableHead>
          <TableHead className="text-right">Other</TableHead>
          <TableHead className="text-right">Total</TableHead>
          {isFarm ? <TableHead className="text-right">Budget</TableHead> : null}
          {isFarm ? <TableHead className="text-right">Variance</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {analysis.groups.map((group) => (
          <TableRow key={group.id}>
            <TableCell className="font-medium text-slate-900">{group.name}</TableCell>
            {!isFarm ? <TableCell className="text-slate-600">{group.farmName}</TableCell> : null}
            {isFarm ? (
              <TableCell className="whitespace-nowrap text-right text-slate-600">
                {group.size
                  ? `${formatNumber(group.size)} ${group.sizeUnit ?? ''}`
                  : '—'}
              </TableCell>
            ) : null}
            <TableCell className="text-right text-slate-600">
              {formatMoney(group.chemical ?? 0)}
            </TableCell>
            <TableCell className="text-right text-slate-600">
              {formatMoney(group.labour ?? 0)}
            </TableCell>
            <TableCell className="text-right text-slate-600">{formatMoney(group.other ?? 0)}</TableCell>
            <TableCell className="text-right font-semibold text-slate-900">
              {formatMoney(group.total)}
            </TableCell>
            {isFarm ? (
              <TableCell className="text-right text-slate-600">
                {group.budget ? formatMoney(group.budget) : '—'}
              </TableCell>
            ) : null}
            {isFarm ? (
              <TableCell className="text-right">
                {group.variance !== null && group.variance !== undefined ? (
                  <span
                    className={
                      group.variance >= 0
                        ? 'inline-flex items-center gap-1 font-medium text-brand-700'
                        : 'inline-flex items-center gap-1 font-medium text-red-600'
                    }
                  >
                    {group.variance >= 0 ? (
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    ) : (
                      <ArrowDownRight className="size-3.5" aria-hidden />
                    )}
                    {formatMoney(Math.abs(group.variance))}
                  </span>
                ) : (
                  '—'
                )}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
