import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ListTodo,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from '@/components/tasks/TaskFormDialog';
import { cn } from '@/utils/cn';
import { analyticsApi } from '@/services/analytics';
import type { AnalyticsSummary, TaskPriority, TaskStatus } from '@/types';

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 0, label: 'All time' },
];

const STATUS_BAR: Record<TaskStatus, string> = {
  todo: 'bg-slate-300',
  in_progress: 'bg-brand-500',
  finished: 'bg-emerald-500',
};

const PRIORITY_BAR: Record<TaskPriority, string> = {
  low: 'bg-slate-300',
  medium: 'bg-sky-500',
  high: 'bg-amber-500',
  critical: 'bg-red-500',
};

interface ChartRow {
  label: string;
  group: number;
  detail?: string;
  barClass: string;
}

function SegmentBar({ rows }: { rows: ChartRow[] }) {
  const max = Math.max(1, ...rows.map((row) => row.group));
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-3">
          <div className="w-28 shrink-0 truncate text-xs font-medium text-slate-700">
            {row.label}
            {row.detail ? <span className="block text-[11px] font-normal text-slate-400">{row.detail}</span> : null}
          </div>
          <div className="h-5 flex-1 overflow-hidden rounded-md bg-slate-100">
            <div
              className={cn('h-full rounded-md transition-all', row.barClass)}
              style={{ width: `${Math.max(0, (row.group / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">
            {row.group}
          </span>
        </li>
      ))}
    </ul>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  iconClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  iconClass: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4">
        <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', iconClass)}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">{value}</p>
          {sub ? <p className="text-xs text-slate-400">{sub}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function deadFriendly(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diff = date.getTime() - Date.now();
  const hours = Math.round(diff / 3_600_000);
  if (hours < 1) return 'within the hour';
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return `in ${days}d`;
}

export function Analytics() {
  const [rangeDays, setRangeDays] = useState(30);

  const summaryQuery = useQuery({
    queryKey: ['analytics', 'summary', rangeDays],
    queryFn: () => analyticsApi.summary(rangeDays),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const data: AnalyticsSummary | undefined = summaryQuery.data;

  if (summaryQuery.isError) {
    return (
      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Analytics</h2>
          <p className="mt-1 text-sm text-slate-500">We couldn't load your analytics.</p>
        </section>
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-sm text-slate-600">
              {summaryQuery.error instanceof Error ? summaryQuery.error.message : 'Something went wrong.'}
            </p>
            <Button variant="outline" onClick={() => summaryQuery.refetch()} loading={summaryQuery.isLoading}>
              <RefreshCw className="size-4" aria-hidden />
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (summaryQuery.isLoading || !data) {
    return (
      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Analytics</h2>
          <p className="mt-1 text-sm text-slate-500">Task activity at a glance.</p>
        </section>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}>
                <CardContent>
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const kpi = data.kpis;
  const statusRows: ChartRow[] = (TASK_STATUS_OPTIONS as { value: TaskStatus; label: string }[]).map(
    (option) => ({
      label: option.label,
      group: data.byStatus.find((row) => row.status === option.value)?.count ?? 0,
      barClass: STATUS_BAR[option.value],
    }),
  );
  const priorityRows: ChartRow[] = TASK_PRIORITY_OPTIONS.map((option) => ({
    label: option.label,
    group: data.byPriority.find((row) => row.priority === option.value)?.count ?? 0,
    barClass: PRIORITY_BAR[option.value],
  }));

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Analytics</h2>
          <p className="mt-1 text-sm text-slate-500">
            Task activity at a glance. Homegrown charts, zero extra libraries.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {RANGES.map((range) => (
            <button
              key={range.value}
              type="button"
              onClick={() => setRangeDays(range.value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                rangeDays === range.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <KpiCard
              icon={<ListTodo className="size-5" aria-hidden />}
              iconClass="bg-brand-50 text-brand-600"
              label="Total tasks"
              value={kpi.total}
            />
            <KpiCard
              icon={<CircleDashed className="size-5" aria-hidden />}
              iconClass="bg-sky-50 text-sky-600"
              label="Open tasks"
              value={kpi.open}
              sub={kpi.total > 0 ? `${Math.round((kpi.open / kpi.total) * 100)}% of all` : undefined}
            />
            <KpiCard
              icon={<AlertTriangle className="size-5" aria-hidden />}
              iconClass="bg-red-50 text-red-600"
              label="Overdue"
              value={kpi.overdue}
            />
            <KpiCard
              icon={kpi.completionRate >= 50 ? <CheckCircle2 className="size-5" aria-hidden /> : <TrendingUp className="size-5" aria-hidden />}
              iconClass="bg-emerald-50 text-emerald-600"
              label="Completion rate"
              value={`${kpi.completionRate}%`}
              sub={`${kpi.finished} finished`}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tasks by status</CardTitle>
                <CardDescription>How work is spread across the board</CardDescription>
              </CardHeader>
              <CardContent>
                <SegmentBar rows={statusRows} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tasks by priority</CardTitle>
                <CardDescription>Where the pressure is</CardDescription>
              </CardHeader>
              <CardContent>
                <SegmentBar rows={priorityRows} />
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By farm</CardTitle>
                <CardDescription>Open, finished and total per farm</CardDescription>
              </CardHeader>
              <CardContent>
                {data.byFarm.length === 0 ? (
                  <p className="text-sm text-slate-400">No farms yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.byFarm.map((farm) => (
                      <li key={farm.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{farm.name}</p>
                          <div className="mt-1 flex h-1.5 w-36 gap-0.5 overflow-hidden rounded-full">
                            {farm.finished > 0 ? (
                              <div className="h-full bg-emerald-400" style={{ width: `${(farm.finished / Math.max(1, farm.total)) * 100}%` }} />
                            ) : null}
                            {farm.open > 0 ? (
                              <div className="h-full bg-slate-300" style={{ width: `${(farm.open / Math.max(1, farm.total)) * 100}%` }} />
                            ) : null}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-semibold tabular-nums text-slate-700">{farm.total}</p>
                          <p className="text-[11px] text-slate-400">
                            {farm.finished} done · {farm.open} open
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By category</CardTitle>
                <CardDescription>Which task categories get the most attention</CardDescription>
              </CardHeader>
              <CardContent>
                {data.byCategory.length === 0 ? (
                  <p className="text-sm text-slate-400">No categories yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.byCategory.map((category) => (
                      <li key={category.id} className="flex items-center gap-3">
                        <div className="flex h-1.5 w-40 overflow-hidden rounded-full bg-emerald-100" />
                        <span className="text-sm font-medium text-slate-700">{category.name}</span>
                        <span className="ml-auto text-xs font-semibold tabular-nums text-slate-700">
                          {category.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top workers</CardTitle>
                <CardDescription>Open workload per team member</CardDescription>
              </CardHeader>
              <CardContent>
                {data.topWorkers.length === 0 ? (
                  <p className="text-sm text-slate-400">No worker activity yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.topWorkers.map((worker) => (
                      <li key={worker.id} className="flex items-center gap-3">
                        <div className="w-28 truncate text-sm font-medium text-slate-700">{worker.name}</div>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand-500"
                            style={{ width: `${(worker.open / Math.max(1, data.topWorkers[0].open)) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">
                          {worker.open}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming deadlines</CardTitle>
                <CardDescription>What's due next</CardDescription>
              </CardHeader>
              <CardContent>
                {data.upcomingDeadlines.length === 0 ? (
                  <p className="text-sm text-slate-400">Nothing due right now.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.upcomingDeadlines.map((task) => (
                      <li key={task.id}>
                        <Link
                          to={`/tasks?task=${task.id}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition-colors hover:bg-slate-50"
                        >
                          <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                            {task.title}
                          </span>
                          <span className="shrink-0">
                            <Badge variant="warning">{deadFriendly(task.deadlineAt)}</Badge>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
    </div>
  );
}