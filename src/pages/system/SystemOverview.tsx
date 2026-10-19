import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  Building2,
  CheckCircle2,
  Layers,
  ListTodo,
  Sprout,
  Tractor,
  UserCheck,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SystemStatCard } from '@/components/system/SystemStatCard';
import { formatNumber, humanizeAction, relativeTime } from '@/components/system/format';
import { systemPlatformApi } from '@/services/system';
import { cn } from '@/utils/cn';

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  active: 'success',
  suspended: 'danger',
  pending: 'warning',
};

export function SystemOverview() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['system', 'overview'],
    queryFn: () => systemPlatformApi.overview(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={Activity}
        title="Could not load overview"
        description="We couldn't reach the platform service. Please try again shortly."
      />
    );
  }

  const { stats, taskStatus, recentOrganizations, topOrganizations, recentActivity } = data;
  const maxMembers = Math.max(1, ...topOrganizations.map((org) => org.memberCount));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SystemStatCard
          label="Organizations"
          value={formatNumber(stats.organizations)}
          hint={`${stats.activeOrganizations} active · ${stats.suspendedOrganizations} suspended`}
          icon={Building2}
        />
        <SystemStatCard label="Users" value={formatNumber(stats.users)} hint={`${formatNumber(stats.activeUsers)} active`} icon={Users} tone="sky" />
        <SystemStatCard label="Farms" value={formatNumber(stats.farms)} hint={`${formatNumber(stats.fields)} fields`} icon={Tractor} tone="accent" />
        <SystemStatCard label="Tasks" value={formatNumber(stats.tasks)} hint={`${taskStatus.completionRate}% completion`} icon={ListTodo} tone="amber" />
        <SystemStatCard label="New this month" value={formatNumber(stats.organizationsThisMonth)} hint="Organizations" icon={Sprout} />
        <SystemStatCard label="New this month" value={formatNumber(stats.usersThisMonth)} hint="Users" icon={UserCheck} tone="sky" />
        <SystemStatCard label="Workers" value={formatNumber(stats.workers)} icon={Layers} tone="slate" />
        <SystemStatCard
          label="Pending review"
          value={formatNumber(stats.pendingOrganizations)}
          hint="Organizations"
          icon={CheckCircle2}
          tone="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Task completion</CardTitle>
            <CardDescription>Current status of all tasks across the platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
              {taskStatus.todo > 0 ? <div className="bg-slate-300" style={{ width: `${(taskStatus.todo / Math.max(1, stats.tasks)) * 100}%` }} /> : null}
              {taskStatus.inProgress > 0 ? <div className="bg-forest-600" style={{ width: `${(taskStatus.inProgress / Math.max(1, stats.tasks)) * 100}%` }} /> : null}
              {taskStatus.finished > 0 ? <div className="bg-accent-500" style={{ width: `${(taskStatus.finished / Math.max(1, stats.tasks)) * 100}%` }} /> : null}
            </div>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-pale p-3">
                <dt className="text-xs font-medium text-muted">To do</dt>
                <dd className="mt-1 text-lg font-bold text-ink tabular-nums">{formatNumber(taskStatus.todo)}</dd>
              </div>
              <div className="rounded-xl bg-pale p-3">
                <dt className="text-xs font-medium text-muted">In progress</dt>
                <dd className="mt-1 text-lg font-bold text-ink tabular-nums">{formatNumber(taskStatus.inProgress)}</dd>
              </div>
              <div className="rounded-xl bg-pale p-3">
                <dt className="text-xs font-medium text-muted">Finished</dt>
                <dd className="mt-1 text-lg font-bold text-ink tabular-nums">{formatNumber(taskStatus.finished)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Largest organizations</CardTitle>
            <CardDescription>By active member count.</CardDescription>
          </CardHeader>
          <CardContent>
            {topOrganizations.length === 0 ? (
              <EmptyState icon={Building2} title="No organizations yet" />
            ) : (
              <ul className="space-y-3">
                {topOrganizations.map((org) => (
                  <li key={org.id} className="flex items-center gap-3">
                    <Link
                      to={`/system/organizations/${org.id}`}
                      className="w-36 shrink-0 truncate text-sm font-medium text-ink hover:text-forest-700 hover:underline"
                    >
                      {org.name}
                    </Link>
                    <div className="h-5 flex-1 overflow-hidden rounded-md bg-slate-100">
                      <div
                        className="h-full rounded-md bg-forest-600"
                        style={{ width: `${(org.memberCount / maxMembers) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-sm font-semibold text-ink tabular-nums">
                      {formatNumber(org.memberCount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent organizations</CardTitle>
            <CardDescription>Newest tenants on the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentOrganizations.length === 0 ? (
              <EmptyState icon={Building2} title="No organizations yet" />
            ) : (
              <ul className="divide-y divide-hairline">
                {recentOrganizations.map((org) => (
                  <li key={org.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link
                        to={`/system/organizations/${org.id}`}
                        className="block truncate text-sm font-semibold text-ink hover:text-forest-700 hover:underline"
                      >
                        {org.name}
                      </Link>
                      <p className="text-xs text-muted">
                        {formatNumber(org.memberCount)} members · {relativeTime(org.createdAt)}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[org.status] ?? 'default'}>{humanizeAction(org.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent platform activity</CardTitle>
            <CardDescription>Latest recorded events.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <EmptyState icon={Activity} title="No activity yet" />
            ) : (
              <ul className="space-y-3">
                {recentActivity.map((item) => (
                  <li key={item.id} className="flex items-start gap-3">
                    <span
                      className={cn(
                        'mt-1 size-2 shrink-0 rounded-full',
                        item.actorType === 'system_admin' ? 'bg-accent-500' : 'bg-forest-600',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{humanizeAction(item.action)}</p>
                      <p className="truncate text-xs text-muted">
                        {item.actorName ?? 'System'}
                        {item.organizationName ? ` · ${item.organizationName}` : ''} · {relativeTime(item.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
