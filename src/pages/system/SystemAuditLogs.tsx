import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, ScrollText } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Pagination, pageRange } from '@/components/ui/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { systemPlatformApi } from '@/services/system';
import { formatDateTime, humanizeAction } from '@/components/system/format';
import type { ActivityItem } from '@/types/system';

const PAGE_SIZE = 25;

const ACTOR_VARIANT: Record<string, 'default' | 'info' | 'success'> = {
  user: 'info',
  system_admin: 'success',
  system: 'default',
};

function ActionRow({ item }: { item: ActivityItem }) {
  return (
    <TableRow>
      <TableCell>
        <p className="font-medium text-ink">{humanizeAction(item.action)}</p>
        <p className="text-xs text-muted">
          {item.targetType ? `${item.targetType}${item.targetId ? ` · ${item.targetId.slice(0, 8)}` : ''}` : '—'}
        </p>
      </TableCell>
      <TableCell>
        <Badge variant={ACTOR_VARIANT[item.actorType] ?? 'default'}>{humanizeAction(item.actorType)}</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted">
        {item.actorName ?? 'System'}
      </TableCell>
      <TableCell>
        {item.organizationId ? (
          <Link
            to={`/system/organizations/${item.organizationId}`}
            className="text-sm font-medium text-ink hover:text-forest-700 hover:underline"
          >
            {item.organizationName ?? 'Organization'}
          </Link>
        ) : (
          <span className="text-sm text-muted">—</span>
        )}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted">{item.ip ?? '—'}</TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted">{formatDateTime(item.createdAt)}</TableCell>
    </TableRow>
  );
}

export function SystemAuditLogs() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [actorType, setActorType] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['system', 'audit-logs', { search: debounced, actorType, page }],
    queryFn: () =>
      systemPlatformApi.auditLogs({
        search: debounced || undefined,
        actorType: actorType === 'all' ? undefined : actorType,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            type="search"
            placeholder="Search activity…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            aria-label="Search audit logs"
          />
        </div>
        <Select value={actorType} onValueChange={(value) => { setActorType(value); setPage(1); }}>
          <SelectTrigger className="h-10 w-52" aria-label="Filter by actor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actors</SelectItem>
            <SelectItem value="user">Users</SelectItem>
            <SelectItem value="system_admin">System admins</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : isError || items.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={isError ? 'Could not load audit logs' : 'No activity found'}
            description={isError ? 'Please try again shortly.' : debounced ? 'Try a different search or filter.' : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <ActionRow key={item.id} item={item} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data && data.total > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-hairline px-5 py-4 sm:flex-row">
            <p className="text-sm text-muted">{pageRange(data.total, data.page, data.pageSize, 'events')}</p>
            <Pagination page={data.page} pageCount={data.totalPages} onPageChange={setPage} />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
