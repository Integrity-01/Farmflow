import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, CalendarClock, Pause, Play, Plus, Repeat, SkipForward, Trash2 } from 'lucide-react';
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
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError } from '@/services/api';
import { recurringTasksApi } from '@/services/recurringTasks';
import { useAuthStore } from '@/store/auth.store';
import { useToastStore } from '@/store/toast.store';
import type { RecurringTask, TaskPriority } from '@/types';
import { RecurringTaskFormDialog } from '@/components/recurring/RecurringTaskFormDialog';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatNextRun(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatLastGenerated(iso: string | null): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function scheduleSummary(rule: RecurringTask): string {
  const prefix =
    rule.intervalCount > 1 || rule.frequency === 'daily'
      ? `${rule.frequency}${rule.intervalCount > 1 ? ` (every ${rule.intervalCount} days)` : ''}`
      : rule.frequency === 'weekly'
        ? 'weekly'
        : 'monthly';
  if (rule.frequency === 'weekly' && rule.weekdays.length > 0) {
    const days = rule.weekdays
      .slice()
      .sort((a, b) => a - b)
      .map((day) => WEEKDAY_LABELS[day])
      .join(', ');
    const every = rule.intervalCount > 1 ? `every ${rule.intervalCount} weeks` : 'weekly';
    return `${every} on ${days}`;
  }
  if (rule.frequency === 'monthly' && rule.dayOfMonth) {
    return `monthly on day ${rule.dayOfMonth}${rule.intervalCount > 1 ? ` (every ${rule.intervalCount} months)` : ''}`;
  }
  return prefix;
}

function toTime(minutes: number): string {
  const m = Math.max(0, Math.min(1439, minutes));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function priorityVariant(priority: TaskPriority): NonNullable<import('@/components/ui/Badge').BadgeProps['variant']> {
  switch (priority) {
    case 'critical':
      return 'danger';
    case 'high':
      return 'warning';
    case 'medium':
      return 'info';
    case 'low':
      return 'default';
  }
}

export function RecurringTasks() {
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.user?.role) ?? null;
  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecurringTask | null>(null);

  const listQuery = useQuery({
    queryKey: ['recurring-tasks'],
    queryFn: recurringTasksApi.list,
    retry: 0,
  });

  const listError =
    listQuery.error instanceof ApiError ? listQuery.error.message : listQuery.error ? 'Could not load recurring tasks.' : null;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['recurring-tasks'] });
  }

  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? recurringTasksApi.activate(id) : recurringTasksApi.pause(id),
    onSuccess: async (rule, { active }) => {
      useToastStore.getState().add({
        title: active ? 'Schedule resumed' : 'Schedule paused',
        description: `"${rule.title}" is now ${active ? 'active' : 'paused'}.`,
      });
      await refresh();
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not update schedule',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const skipMutation = useMutation({
    mutationFn: recurringTasksApi.skipNext,
    onSuccess: async (rule) => {
      useToastStore.getState().add({
        title: 'Next occurrence skipped',
        description: `"${rule.title}" will not generate its next task.`,
        variant: 'info',
      });
      await refresh();
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not skip occurrence',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: recurringTasksApi.generate,
    onSuccess: async (result) => {
      if (result.skipped) {
        useToastStore.getState().add({
          title: 'Occurrence skipped',
          description: 'The next occurrence is marked as skipped, so no task was created.',
          variant: 'info',
        });
      } else {
        useToastStore.getState().add({
          title: 'Task generated',
          description: result.task ? `"${result.task.title}"` : 'A new task was created from this schedule.',
        });
      }
      await refresh();
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not generate task',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: recurringTasksApi.remove,
    onSuccess: async () => {
      setDeleteTarget(null);
      await refresh();
      useToastStore.getState().add({
        title: 'Schedule deleted',
        description: 'No more tasks will be generated from this schedule.',
      });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not delete schedule',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  function openCreate() {
    setEditingRule(null);
    setFormOpen(true);
  }

  function openEdit(rule: RecurringTask) {
    setEditingRule(rule);
    setFormOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Recurring tasks</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {listQuery.data
              ? `${listQuery.data.length} schedule${listQuery.data.length === 1 ? '' : 's'}`
              : 'Automatically generated work'}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          New recurring task
        </Button>
      </div>

      {listError ? (
        <Alert variant="danger">
          <AlertTitle>Could not load recurring tasks</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{listError}</p>
            <Button variant="outline" size="sm" onClick={() => void listQuery.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-40 w-full" />
          ))}
        </div>
      ) : listQuery.data && listQuery.data.length > 0 ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {listQuery.data.map((rule) => {
            const busy =
              setActiveMutation.isPending ||
              skipMutation.isPending ||
              generateMutation.isPending ||
              deleteMutation.isPending;
            return (
              <li key={rule.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">{rule.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant={priorityVariant(rule.priority)} className="text-[10px]">
                        {rule.priority}
                      </Badge>
                      {rule.active ? (
                        <Badge variant="success" className="text-[10px]">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px]">
                          Paused
                        </Badge>
                      )}
                      {rule.skipNext ? (
                        <Badge variant="warning" className="text-[10px]">
                          Next skipped
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <Repeat className="mt-0.5 size-5 shrink-0 text-slate-300" aria-hidden />
                </div>

                <div className="mt-4 space-y-1.5 text-sm text-slate-600">
                  <p className="flex items-center gap-2">
                    <Repeat className="size-4 text-slate-400" aria-hidden />
                    {scheduleSummary(rule)} at {toTime(rule.startTimeMinutes)}
                  </p>
                  <p className="flex items-center gap-2">
                    <Calendar className="size-4 text-slate-400" aria-hidden />
                    {rule.farmName}{rule.fieldName ? ` / ${rule.fieldName}` : ''} · {rule.categoryName}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="size-4" aria-hidden />
                    Assigned to {rule.assigneeName ?? 'unassigned'}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{formatNextRun(rule.nextRunAt)}</p>
                    <p className="text-[11px] text-slate-500">Next run</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{rule.generatedCount}</p>
                    <p className="text-[11px] text-slate-500">Generated</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{formatLastGenerated(rule.lastGeneratedAt)}</p>
                    <p className="text-[11px] text-slate-500">Last run</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => setActiveMutation.mutate({ id: rule.id, active: !rule.active })}
                  >
                    {rule.active ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
                    {rule.active ? 'Pause' : 'Resume'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => skipMutation.mutate(rule.id)}
                  >
                    <SkipForward className="size-3.5" aria-hidden />
                    Skip next
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => generateMutation.mutate(rule.id)}
                  >
                    <CalendarClock className="size-3.5" aria-hidden />
                    Generate now
                  </Button>
                  <div className="ml-auto flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => setDeleteTarget(rule)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={Repeat}
          title="No recurring tasks yet"
          description="Automate repeatable work — irrigation checks, pest scouting, maintenance rounds — and let the farm run itself."
          action={
            role ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" aria-hidden />
                Create your first schedule
              </Button>
            ) : undefined
          }
        />
      )}

      <RecurringTaskFormDialog open={formOpen} onOpenChange={setFormOpen} rule={editingRule} />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" will stop running. Already-generated tasks are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}