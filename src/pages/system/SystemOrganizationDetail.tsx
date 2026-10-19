import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Globe, Mail, MapPin, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { useToast } from '@/store/toast.store';
import { ApiError } from '@/services/api';
import { systemPlatformApi } from '@/services/system';
import { formatDate, formatDateTime, formatNumber, humanizeAction, humanizeRole, relativeTime } from '@/components/system/format';
import type { OrgMemberItem } from '@/types/system';

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  active: 'success',
  suspended: 'danger',
  pending: 'warning',
};

const MEMBER_STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  active: 'success',
  suspended: 'danger',
  pending: 'warning',
};

function MemberRow({ member }: { member: OrgMemberItem }) {
  return (
    <TableRow>
      <TableCell>
        <p className="font-semibold text-ink">{member.name}</p>
        <p className="text-xs text-muted">{member.email}</p>
      </TableCell>
      <TableCell className="text-sm text-muted">{humanizeRole(member.roleName || member.role)}</TableCell>
      <TableCell>
        <Badge variant={MEMBER_STATUS_VARIANT[member.status] ?? 'default'}>{humanizeAction(member.status)}</Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted">{formatDate(member.joinedAt)}</TableCell>
    </TableRow>
  );
}

export function SystemOrganizationDetail() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['system', 'organization', id],
    queryFn: () => systemPlatformApi.organization(id),
    enabled: Boolean(id),
  });

  const suspendMutation = useMutation({
    mutationFn: (action: 'suspend' | 'activate') =>
      action === 'suspend' ? systemPlatformApi.suspendOrganization(id) : systemPlatformApi.activateOrganization(id),
    onSuccess: (result) => {
      toast({
        title: result.status === 'suspended' ? 'Organization suspended' : 'Organization activated',
        description: `${result.name} is now ${result.status}.`,
        variant: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['system'] });
    },
    onError: (error) => {
      toast({
        title: 'Action failed',
        description: error instanceof ApiError ? error.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={Building2}
        title="Organization not found"
        description="This organization may have been removed."
        action={
          <Button asChild variant="outline">
            <Link to="/system/organizations">Back to organizations</Link>
          </Button>
        }
      />
    );
  }

  const taskTotal = data.taskStatus.todo + data.taskStatus.inProgress + data.taskStatus.finished;

  return (
    <div className="space-y-6">
      <Link
        to="/system/organizations"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All organizations
      </Link>

      <Card>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-bold tracking-tight text-ink">{data.name}</h2>
              <Badge variant={STATUS_VARIANT[data.status] ?? 'default'}>{humanizeAction(data.status)}</Badge>
              <Badge variant="outline">{humanizeAction(data.verificationStatus)}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-4" aria-hidden />
                {data.contactEmail ?? 'No contact email'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Globe className="size-4" aria-hidden />
                {data.website ?? 'No website'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {data.country ?? 'Unknown location'}
              </span>
            </div>
            <p className="mt-3 text-xs text-muted">
              {data.currency} · {data.timezone} · created {formatDate(data.createdAt)}
            </p>
          </div>

          <div className="shrink-0">
            {data.status === 'suspended' ? (
              <Button
                variant="secondary"
                loading={suspendMutation.isPending}
                onClick={() => suspendMutation.mutate('activate')}
              >
                Activate organization
              </Button>
            ) : (
              <Button
                variant="danger"
                loading={suspendMutation.isPending}
                onClick={() => suspendMutation.mutate('suspend')}
              >
                Suspend organization
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Members" value={formatNumber(data.counts.members)} />
        <Metric label="Farms" value={formatNumber(data.counts.farms)} />
        <Metric label="Fields" value={formatNumber(data.counts.fields)} />
        <Metric label="Tasks" value={formatNumber(data.counts.tasks)} />
        <Metric label="Workers" value={formatNumber(data.counts.workers)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Task status</CardTitle>
            <CardDescription>{data.taskStatus.completionRate}% completion rate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow label="To do" value={data.taskStatus.todo} total={taskTotal} tone="bg-slate-300" />
            <StatusRow label="In progress" value={data.taskStatus.inProgress} total={taskTotal} tone="bg-forest-600" />
            <StatusRow label="Finished" value={data.taskStatus.finished} total={taskTotal} tone="bg-accent-500" />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest events for this organization.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <EmptyState icon={Building2} title="No activity recorded" />
            ) : (
              <ul className="space-y-3">
                {data.recentActivity.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{humanizeAction(item.action)}</p>
                      <p className="truncate text-xs text-muted">
                        {item.actorName ?? 'System'} · {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{relativeTime(item.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Users className="size-5 text-forest-600" aria-hidden />
            Members
          </CardTitle>
          <CardDescription>{formatNumber(data.counts.members)} total members in this organization.</CardDescription>
        </CardHeader>
        {data.members.length === 0 ? (
          <EmptyState icon={Users} title="No members yet" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.members.map((member) => (
                  <MemberRow key={member.userId} member={member} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-ink tabular-nums">{value}</p>
    </div>
  );
}

function StatusRow({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
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
