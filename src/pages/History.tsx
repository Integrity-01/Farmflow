import { useState, type FormEvent } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FilterX, History as HistoryIcon, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Pagination, pageRange } from '@/components/ui/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { farmsApi } from '@/services/farms';
import { historyApi } from '@/services/history';
import type { HistoryAction, HistoryEvent } from '@/types';

const PAGE_SIZE = 20;
const NO_SELECTION = 'none';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

const ACTION_META: Record<HistoryAction, { label: string; variant: BadgeVariant }> = {
  created: { label: 'Created', variant: 'info' },
  updated: { label: 'Updated', variant: 'default' },
  status_changed: { label: 'Status changed', variant: 'warning' },
  assigned: { label: 'Assigned', variant: 'warning' },
  started: { label: 'Started', variant: 'info' },
  completed: { label: 'Completed', variant: 'success' },
  reopened: { label: 'Reopened', variant: 'default' },
  progress_changed: { label: 'Progress updated', variant: 'default' },
  deadline_changed: { label: 'Deadline changed', variant: 'warning' },
  priority_changed: { label: 'Priority changed', variant: 'danger' },
  comment_added: { label: 'Comment added', variant: 'info' },
  attachment_added: { label: 'Attachment added', variant: 'success' },
  attachment_removed: { label: 'Attachment removed', variant: 'danger' },
};

const ACTION_OPTIONS = Object.entries(ACTION_META).map(([value, meta]) => ({
  value: value as HistoryAction,
  label: meta.label,
}));

function actionMeta(action: string): { label: string; variant: BadgeVariant } {
  return ACTION_META[action as HistoryAction] ?? { label: action, variant: 'default' };
}

function presentValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function describeEvent(event: HistoryEvent): string {
  switch (event.action) {
    case 'assigned':
      return `Assigned to ${presentValue(event.newValue) || 'Unassigned'}`;
    case 'status_changed':
      return `Status changed to ${presentValue(event.newValue)}`;
    case 'progress_changed':
      return `Progress set to ${presentValue(event.newValue)}%`;
    case 'priority_changed':
      return `Priority changed to ${presentValue(event.newValue)}`;
    case 'deadline_changed':
      return `Deadline changed to ${presentValue(event.newValue)}`;
    case 'comment_added':
      return presentValue(event.newValue) || 'Added a comment';
    case 'attachment_added':
      return `Attachment: ${presentValue(event.newValue) || 'File added'}`;
    case 'attachment_removed':
      return `Attachment removed: ${presentValue(event.newValue) || 'File removed'}`;
    case 'started':
      return 'Work started';
    case 'completed':
      return 'Marked as finished';
    case 'reopened':
      return 'Reopened for work';
    default:
      return '';
  }
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function History() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState(NO_SELECTION);
  const [farmId, setFarmId] = useState(NO_SELECTION);

  const listQuery = useQuery({
    queryKey: ['history', { search, action, farmId, page }],
    queryFn: () =>
      historyApi.list({
        search: search || undefined,
        action: action === NO_SELECTION ? undefined : action,
        farmId: farmId === NO_SELECTION ? undefined : farmId,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    retry: 0,
  });

  const farmsQuery = useQuery({
    queryKey: ['farms', 'options'],
    queryFn: () => farmsApi.list({ pageSize: 100 }),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function resetFilters() {
    setSearchInput('');
    setSearch('');
    setAction(NO_SELECTION);
    setFarmId(NO_SELECTION);
    setPage(1);
  }

  const pageCount = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.total / PAGE_SIZE)) : 1;
  const listError =
    listQuery.error instanceof Error
      ? listQuery.error.message
      : listQuery.error
        ? 'Could not load your activity history.'
        : null;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">History</h2>
        <p className="mt-1 text-sm text-slate-500">An audit trail of everything happening in your tasks.</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Find past activity by keyword, action or farm.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={applySearch} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div>
              <Label htmlFor="history-search" className="mb-1.5 block text-xs font-semibold text-slate-600">
                Search task
              </Label>
              <Input
                id="history-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Task title…"
                className="w-full"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-slate-600">Action</Label>
              <Select value={action} onValueChange={(value) => { setAction(value); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Any action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SELECTION}>Any action</SelectItem>
                  {ACTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-slate-600">Farm</Label>
              <Select value={farmId} onValueChange={(value) => { setFarmId(value); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="All farms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SELECTION}>All farms</SelectItem>
                  {farmsQuery.data?.items.map((farm) => (
                    <SelectItem key={farm.id} value={farm.id}>
                      {farm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </form>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              {action !== NO_SELECTION || farmId !== NO_SELECTION || search ? 'Showing filtered history.' : 'Showing all task activity.'}
            </p>
            <div className="flex items-center gap-2">
              <Button type="submit" onClick={applySearch} size="sm">
                <Search className="size-4" aria-hidden />
                Search
              </Button>
              {(action !== NO_SELECTION || farmId !== NO_SELECTION || search) && (
                <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                  <FilterX className="size-4" aria-hidden />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {listError ? (
        <Alert variant="danger">
          <AlertTitle>Could not load history</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{listError}</p>
            <Button variant="outline" size="sm" onClick={() => void listQuery.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Activity log</CardTitle>
          <CardDescription>Chronological, newest first</CardDescription>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-16 w-full" />
              ))}
            </div>
          ) : listQuery.data && listQuery.data.items.length > 0 ? (
            <>
              <ul className="space-y-2">
                {listQuery.data.items.map((event: HistoryEvent) => {
                  const meta = actionMeta(event.action);
                  const detail = describeEvent(event);
                  return (
                    <li key={event.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 p-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        <HistoryIcon className="size-4" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-semibold text-slate-900">{event.taskTitle}</span>
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </div>
                        {detail ? <p className="mt-0.5 text-sm text-slate-500">{detail}</p> : null}
                        <p className="mt-1 text-xs text-slate-400">
                          {event.actorName ? `${event.actorName} · ` : ''}
                          <time dateTime={event.createdAt} title={formatDate(event.createdAt)}>
                            {formatTime(event.createdAt)}
                          </time>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-sm text-slate-500">{pageRange(listQuery.data.total, page, PAGE_SIZE, 'events')}</p>
                <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
              </div>
            </>
          ) : (
            <EmptyState
              icon={HistoryIcon}
              title={search || action !== NO_SELECTION || farmId !== NO_SELECTION ? 'No matching activity' : 'No activity yet'}
              description={
                search || action !== NO_SELECTION || farmId !== NO_SELECTION
                  ? 'Try adjusting your filters to see more results.'
                  : 'Task changes will appear here as your team gets to work.'
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}