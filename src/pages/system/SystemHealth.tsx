import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, Clock, Database, Globe, Server, ShieldCheck, Timer, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { SystemStatCard } from '@/components/system/SystemStatCard';
import { formatNumber } from '@/components/system/format';
import { systemPlatformApi } from '@/services/system';

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

export function SystemHealth() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['system', 'health'],
    queryFn: () => systemPlatformApi.health(),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return <EmptyState icon={Activity} title="Could not load system health" description="Please try again shortly." />;
  }

  const dbUp = data.health.database.status === 'up';

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SystemStatCard label="System admins" value={formatNumber(data.systemAdministrators)} hint={`${data.activeSystemAdministrators} active`} icon={ShieldCheck} />
        <SystemStatCard label="Admin sessions" value={formatNumber(data.activeSystemSessions)} icon={ShieldCheck} tone="accent" />
        <SystemStatCard label="User sessions" value={formatNumber(data.activeUserSessions)} icon={Activity} tone="sky" />
        <SystemStatCard label="DB latency" value={data.health.database.latencyMs != null ? `${data.health.database.latencyMs} ms` : '—'} icon={Timer} tone="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service status</CardTitle>
          <CardDescription>Live platform health checks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <HealthRow
            label="API"
            status={data.health.status === 'ok' ? 'Up' : 'Down'}
            ok={data.health.status === 'ok'}
            detail={`${data.health.service} v${data.health.version}`}
            icon={<Server className="size-4" aria-hidden />}
          />
          <HealthRow
            label="Database"
            status={dbUp ? 'Connected' : 'Disconnected'}
            ok={dbUp}
            detail={
              data.health.database.message ??
              (data.health.database.latencyMs != null ? `${data.health.database.latencyMs} ms latency` : undefined)
            }
            icon={<Database className="size-4" aria-hidden />}
          />
          <InfoRow icon={<Clock className="size-4" aria-hidden />} label="Uptime" value={formatUptime(data.health.uptimeSeconds)} />
          <InfoRow icon={<Globe className="size-4" aria-hidden />} label="Timezone" value={data.health.timezone} />
          <InfoRow icon={<Timer className="size-4" aria-hidden />} label="Last checked" value={new Date(data.health.timestamp).toLocaleTimeString()} />
        </CardContent>
      </Card>
    </div>
  );
}

function HealthRow({
  label,
  status,
  ok,
  detail,
  icon,
}: {
  label: string;
  status: string;
  ok: boolean;
  detail?: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-white p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-forest-50 text-forest-700">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{label}</p>
          {detail ? <p className="truncate text-xs text-muted">{detail}</p> : null}
        </div>
      </div>
      <Badge variant={ok ? 'success' : 'danger'}>
        {ok ? <CheckCircle2 className="size-3" aria-hidden /> : <XCircle className="size-3" aria-hidden />}
        {status}
      </Badge>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-forest-50 text-forest-700">{icon}</span>
        <p className="text-sm font-semibold text-ink">{label}</p>
      </div>
      <p className="text-sm text-muted">{value}</p>
    </div>
  );
}
