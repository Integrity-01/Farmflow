import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, ListTodo, Loader2, Plus, Trash2, Users, Warehouse } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination, pageRange } from '@/components/ui/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { TASK_STATUS_OPTIONS } from '@/components/tasks/TaskFormDialog';
import { fileUrl } from '@/services/api';
import { farmsApi } from '@/services/farms';
import { reportsApi } from '@/services/reports';
import { useToastStore } from '@/store/toast.store';
import type { ReportItem, ReportType } from '@/types';

const PAGE_SIZE = 10;
const NO_SELECTION = 'none';

const TYPE_OPTIONS: { value: ReportType; label: string; description: string; icon: typeof ListTodo }[] = [
  { value: 'tasks', label: 'Tasks', description: 'All tasks with status, assignee and dates', icon: ListTodo },
  { value: 'workers', label: 'Workers', description: 'Team members with workload and contact info', icon: Users },
  { value: 'farms', label: 'Farms', description: 'Farms with fields, workers and task counts', icon: Warehouse },
];

const RANGE_OPTIONS = [
  { value: NO_SELECTION, label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

function typeLabel(type: ReportType): string {
  return TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

function statusVariant(status: string): 'success' | 'danger' | 'warning' {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  return 'warning';
}

function formatStarted(iso: string): string {
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

export function Reports() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [reportType, setReportType] = useState<ReportType>('tasks');
  const [farmId, setFarmId] = useState(NO_SELECTION);
  const [status, setStatus] = useState(NO_SELECTION);
  const [rangeDays, setRangeDays] = useState(NO_SELECTION);

  const listQuery = useQuery({
    queryKey: ['reports', page],
    queryFn: () => reportsApi.list(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
    retry: 0,
  });

  const farmsQuery = useQuery({
    queryKey: ['farms', 'options'],
    queryFn: () => farmsApi.list({ pageSize: 100 }),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const createMutation = useMutation({
    mutationFn: reportsApi.create,
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      useToastStore.getState().add({
        title: 'Report generated',
        description:
          created.status === 'completed'
            ? 'Your CSV is ready to download.'
            : "The report couldn't be built — check its status below.",
        variant: created.status === 'completed' ? 'success' : 'danger',
      });
      setFarmId(NO_SELECTION);
      setStatus(NO_SELECTION);
      setRangeDays(NO_SELECTION);
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not generate report',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: reportsApi.remove,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      useToastStore.getState().add({ title: 'Report deleted' });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not delete report',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  function handleGenerate() {
    createMutation.mutate({
      reportType,
      format: 'csv',
      filters: {
        farmId: farmId === NO_SELECTION ? undefined : farmId,
        status: status === NO_SELECTION ? undefined : status,
        rangeDays: rangeDays === NO_SELECTION ? undefined : Number(rangeDays),
      },
    });
  }

  const pageCount = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.total / PAGE_SIZE)) : 1;
  const listError =
    listQuery.error instanceof Error ? listQuery.error.message : listQuery.error ? 'Could not load your reports.' : null;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Reports</h2>
        <p className="mt-1 text-sm text-slate-500">Generate CSV exports of your farm operations.</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Generate a report</CardTitle>
          <CardDescription>Tasks, workers or farms — filtered how you like.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Report type</label>
              <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a report" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Farm</label>
              <Select value={farmId} onValueChange={setFarmId}>
                <SelectTrigger>
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
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Status (tasks only)</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Any status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SELECTION}>Any status</SelectItem>
                  {TASK_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Created:</span>
              <Select value={rangeDays} onValueChange={setRangeDays} disabled={reportType !== 'tasks'}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline">CSV</Badge>
            </div>
            <Button onClick={handleGenerate} loading={createMutation.isPending}>
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              Generate report
            </Button>
          </div>

          <p className="text-xs text-slate-400">
            Reports match what you can see in the app. Downloads are served from <code className="font-mono">/reports</code>.
          </p>
        </CardContent>
      </Card>

      {listError ? (
        <Alert variant="danger">
          <AlertTitle>Could not load reports</AlertTitle>
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
          <CardTitle>Your reports</CardTitle>
          <CardDescription>Recent exports and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-14 w-full" />
              ))}
            </div>
          ) : listQuery.data && listQuery.data.items.length > 0 ? (
            <>
              <ul className="space-y-2">
                {listQuery.data.items.map((report: ReportItem) => (
                  <li
                    key={report.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <FileText className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {typeLabel(report.reportType)}
                        </p>
                        <Badge variant="outline">{report.format.toUpperCase()}</Badge>
                      </div>
                      <p className="text-xs text-slate-400">{formatStarted(report.startedAt)}</p>
                    </div>
                    <Badge variant={statusVariant(report.status)}>{report.status}</Badge>
                    {report.status === 'completed' && report.fileUrl ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={fileUrl(report.fileUrl)} download target="_blank" rel="noreferrer">
                          <Download className="size-4" aria-hidden />
                          <span className="hidden sm:inline">Download</span>
                        </a>
                      </Button>
                    ) : report.status === 'failed' ? (
                      <span className="max-w-40 truncate text-xs text-slate-400" title={report.errorMessage ?? ''}>
                        {report.errorMessage ?? 'Generation failed'}
                      </span>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete report"
                      onClick={() => deleteMutation.mutate(report.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-sm text-slate-500">{pageRange(listQuery.data.total, page, PAGE_SIZE, 'reports')}</p>
                <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
              </div>
            </>
          ) : (
            <EmptyState
              icon={FileText}
              title="No reports yet"
              description="Use the form above to generate your first CSV export."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}