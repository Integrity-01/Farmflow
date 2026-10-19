import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Building2, ListTodo, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { SystemStatCard } from '@/components/system/SystemStatCard';
import { formatDate, formatNumber } from '@/components/system/format';
import { systemPlatformApi } from '@/services/system';
import type { AnalyticsSeriesPoint } from '@/types/system';

const RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

const SERIES = [
  { key: 'organizations', label: 'Organizations', color: '#226b41' },
  { key: 'users', label: 'Users', color: '#0ea5e9' },
  { key: 'tasks', label: 'Tasks', color: '#a8f05a' },
] as const;

function TrendChart({ series }: { series: AnalyticsSeriesPoint[] }) {
  const width = 720;
  const height = 240;
  const padding = { top: 16, right: 16, bottom: 28, left: 36 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(
    1,
    ...series.flatMap((point) => [point.organizations, point.users, point.tasks]),
  );

  const stepX = series.length > 1 ? innerW / (series.length - 1) : 0;
  const pointFor = (index: number, value: number) => ({
    x: padding.left + index * stepX,
    y: padding.top + innerH - (value / max) * innerH,
  });

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-64 w-full min-w-[36rem]"
        role="img"
        aria-label="Platform growth trend"
      >
        {gridLines.map((fraction) => {
          const y = padding.top + innerH * fraction;
          const value = Math.round(max * (1 - fraction));
          return (
            <g key={fraction}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e2e8e0" strokeWidth={1} />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-slate-400" fontSize={11}>
                {value}
              </text>
            </g>
          );
        })}

        {SERIES.map((line) => {
          const points = series.map((point, index) => pointFor(index, point[line.key]));
          const path = points.map((point) => `${point.x},${point.y}`).join(' ');
          return (
            <polyline
              key={line.key}
              points={path}
              fill="none"
              stroke={line.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}

        {series.map((point, index) => {
          const show = index === 0 || index === series.length - 1 || index % Math.ceil(series.length / 6) === 0;
          if (!show) return null;
          return (
            <text
              key={point.date}
              x={pointFor(index, 0).x}
              y={height - 8}
              textAnchor="middle"
              className="fill-slate-400"
              fontSize={10}
            >
              {formatDate(point.date)}
            </text>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-4 px-2">
        {SERIES.map((line) => (
          <span key={line.key} className="inline-flex items-center gap-2 text-xs font-medium text-muted">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: line.color }} />
            {line.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SystemAnalytics() {
  const [range, setRange] = useState('30d');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['system', 'analytics', range],
    queryFn: () => systemPlatformApi.analytics(range),
  });

  const orgTotal = data
    ? data.organizationStatus.active + data.organizationStatus.suspended + data.organizationStatus.pending
    : 0;
  const taskTotal = data ? data.taskStatus.todo + data.taskStatus.inProgress + data.taskStatus.finished : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setRange(option.value)}
            className={
              range === option.value
                ? 'rounded-xl bg-forest-900 px-4 py-2 text-sm font-semibold text-white'
                : 'rounded-xl border border-hairline bg-white px-4 py-2 text-sm font-medium text-muted hover:text-ink'
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : isError || !data ? (
        <EmptyState icon={BarChart3} title="Could not load analytics" description="Please try again shortly." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SystemStatCard
              label="New organizations"
              value={formatNumber(data.totals.organizations)}
              hint={`${data.range.days}-day range`}
              icon={Building2}
            />
            <SystemStatCard label="New users" value={formatNumber(data.totals.users)} icon={Users} tone="sky" />
            <SystemStatCard label="New tasks" value={formatNumber(data.totals.tasks)} icon={ListTodo} tone="amber" />
            <SystemStatCard
              label="Completion rate"
              value={`${data.taskStatus.completionRate}%`}
              hint={`${formatNumber(data.totals.tasksFinished)} finished`}
              icon={TrendingUp}
              tone="accent"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Growth trend</CardTitle>
              <CardDescription>
                Daily counts from {formatDate(data.range.from)} to {formatDate(data.range.to)}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart series={data.series} />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Organization status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatusBar
                  label="Active"
                  value={data.organizationStatus.active}
                  total={orgTotal}
                  tone="bg-accent-500"
                />
                <StatusBar
                  label="Suspended"
                  value={data.organizationStatus.suspended}
                  total={orgTotal}
                  tone="bg-red-500"
                />
                <StatusBar
                  label="Pending"
                  value={data.organizationStatus.pending}
                  total={orgTotal}
                  tone="bg-amber-500"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Task status (all time)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatusBar label="To do" value={data.taskStatus.todo} total={taskTotal} tone="bg-slate-300" />
                <StatusBar label="In progress" value={data.taskStatus.inProgress} total={taskTotal} tone="bg-forest-600" />
                <StatusBar label="Finished" value={data.taskStatus.finished} total={taskTotal} tone="bg-accent-500" />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted">{label}</span>
        <span className="font-semibold text-ink tabular-nums">{formatNumber(value)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={tone} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
