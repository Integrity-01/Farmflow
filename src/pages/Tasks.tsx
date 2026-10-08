import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, ListFilter, MapPin, Plus, Search } from 'lucide-react';
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
import { Input } from '@/components/ui/Input';
import { Pagination, pageRange } from '@/components/ui/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { ApiError } from '@/services/api';
import { canCreateTasks, canMutateTask, tasksApi } from '@/services/tasks';
import { useToastStore } from '@/store/toast.store';
import { useAuthStore } from '@/store/auth.store';
import type { Task, TaskPriority, TaskStatus } from '@/types';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { TaskFormDialog, TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from '@/components/tasks/TaskFormDialog';

const PAGE_SIZE = 10;

function formatDeadline(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: '—', overdue: false };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { text: '—', overdue: false };
  const overdue = date.getTime() < Date.now();
  return {
    text: date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    overdue,
  };
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

function statusVariant(status: TaskStatus): NonNullable<import('@/components/ui/Badge').BadgeProps['variant']> {
  switch (status) {
    case 'todo':
      return 'default';
    case 'in_progress':
      return 'info';
    case 'finished':
      return 'success';
  }
}

interface TasksProps {
  mine?: boolean;
}

export function Tasks({ mine = false }: TasksProps) {
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.user?.role) ?? null;
  const canManage = canMutateTask(role);
  const canCreate = canCreateTasks(role);
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<'all' | TaskStatus>('all');
  const [priority, setPriority] = useState<'all' | TaskPriority>('all');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, priority, mine]);

  const taskFromUrl = searchParams.get('task');
  useEffect(() => {
    if (taskFromUrl) {
      setDetailTaskId(taskFromUrl);
      setSearchParams({}, { replace: true });
    }
  }, [taskFromUrl, setSearchParams]);

  const listQuery = useQuery({
    queryKey: [
      mine ? 'my-tasks' : 'tasks',
      { search: debouncedSearch, status: status === 'all' ? undefined : status, priority: priority === 'all' ? undefined : priority, page },
    ],
    queryFn: () =>
      tasksApi.list({
        search: debouncedSearch || undefined,
        status: status === 'all' ? undefined : status,
        priority: priority === 'all' ? undefined : priority,
        mine: mine || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    retry: 0,
  });

  const listError =
    listQuery.error instanceof ApiError
      ? listQuery.error.message
      : listQuery.error
        ? mine
          ? 'Could not load your tasks.'
          : 'Could not load tasks.'
        : null;

  const deleteMutation = useMutation({
    mutationFn: tasksApi.remove,
    onSuccess: async () => {
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      useToastStore.getState().add({
        title: 'Task deleted',
        description: 'The task was permanently removed.',
      });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not delete task',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const pageCount = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.total / PAGE_SIZE)) : 1;

  function openCreate() {
    setEditingTask(null);
    setFormOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setFormOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {mine ? 'My Tasks' : 'Tasks'}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {listQuery.data && !listQuery.isFetching
              ? `${listQuery.data.total} task${listQuery.data.total === 1 ? '' : 's'}`
              : mine
                ? 'The work assigned to you'
                : 'Plan, assign and track work'}
          </p>
        </div>
        {canCreate && !mine ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            New task
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 size-4 text-slate-400" aria-hidden />
          <Input
            className="pl-10"
            placeholder="Search tasks…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search tasks"
          />
        </div>
        <div className="sm:w-40">
          <Select value={status} onValueChange={(value) => setStatus(value as 'all' | TaskStatus)}>
            <SelectTrigger aria-label="Filter by status">
              <span className="flex items-center gap-2">
                <ListFilter className="size-4 text-slate-400" aria-hidden />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {TASK_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:w-40">
          <Select value={priority} onValueChange={(value) => setPriority(value as 'all' | TaskPriority)}>
            <SelectTrigger aria-label="Filter by priority">
              <span className="flex items-center gap-2">
                <span className="truncate">
                  <SelectValue />
                </span>
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {TASK_PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {listError ? (
        <Alert variant="danger">
          <AlertTitle>{mine ? 'Could not load your tasks' : 'Could not load tasks'}</AlertTitle>
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
            <Skeleton key={item} className="h-16 w-full" />
          ))}
        </div>
      ) : listQuery.data && listQuery.data.items.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  {!mine ? <TableHead>Assignee</TableHead> : null}
                  <TableHead>Farm / Field</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.items.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    mine={mine}
                    canManage={canManage}
                    onView={() => setDetailTaskId(task.id)}
                    onEdit={() => openEdit(task)}
                    onDelete={() => setDeleteTarget(task)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-3 lg:hidden">
            {listQuery.data.items.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                mine={mine}
                canManage={canManage}
                onView={() => setDetailTaskId(task.id)}
                onEdit={() => openEdit(task)}
                onDelete={() => setDeleteTarget(task)}
              />
            ))}
          </ul>

          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-slate-500">
              {pageRange(listQuery.data.total, page, PAGE_SIZE, 'tasks')}
            </p>
            <Pagination page={page} pageCount={pageCount} onPageChange={(next) => { setPage(next); window.scrollTo({ top: 0 }); }} />
          </div>
        </>
      ) : (
        <EmptyState
          icon={Search}
          title={debouncedSearch || status !== 'all' || priority !== 'all' ? 'No tasks match your filters' : mine ? 'You have no tasks yet' : 'No tasks yet'}
          description={
            debouncedSearch || status !== 'all' || priority !== 'all'
              ? 'Try changing the search or clearing the filters.'
              : mine
                ? 'Tasks assigned to you will appear here.'
                : canCreate
                  ? 'Create a task and assign it to someone on your team.'
                  : 'Tasks from your team will appear here.'
          }
          action={
            debouncedSearch || status !== 'all' || priority !== 'all' ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setStatus('all');
                  setPriority('all');
                }}
              >
                Clear filters
              </Button>
            ) : canCreate && !mine ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" aria-hidden />
                Create your first task
              </Button>
            ) : undefined
          }
        />
      )}

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} task={editingTask} />

      <TaskDetailDialog open={Boolean(detailTaskId)} onOpenChange={(open) => { if (!open) setDetailTaskId(null); }} taskId={detailTaskId} />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" and its comments and attachments will be
              permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TaskRow({
  task,
  mine,
  canManage,
  onView,
  onEdit,
  onDelete,
}: {
  task: Task;
  mine: boolean;
  canManage: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const deadline = formatDeadline(task.deadlineAt);
  return (
    <TableRow className="cursor-pointer" onClick={onView}>
      <TableCell>
        <p className="font-semibold text-slate-900">{task.title}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="text-xs text-slate-500">{task.categoryName}</p>
          <Badge variant={priorityVariant(task.priority)} className="text-[10px]">
            {task.priority}
          </Badge>
        </div>
      </TableCell>
      {!mine ? (
        <TableCell className="text-slate-600">{task.assigneeName ?? 'Unassigned'}</TableCell>
      ) : null}
      <TableCell>
        <p className="font-medium text-slate-700">{task.farmName}</p>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="size-3" aria-hidden />
          {task.fieldName ?? 'No field'}
        </p>
      </TableCell>
      <TableCell className="whitespace-nowrap text-slate-600">
        <span className={deadline.overdue ? 'font-semibold text-red-600' : ''}>
          <CalendarClock className="mr-1 inline size-3.5 text-slate-400" aria-hidden />
          {deadline.text}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${task.progress}%` }} />
          </div>
          <span className="text-xs font-medium text-slate-600">{task.progress}%</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={statusVariant(task.status)}>
          {TASK_STATUS_OPTIONS.find((option) => option.value === task.status)?.label}
        </Badge>
      </TableCell>
      <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
        {canManage ? (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
              Delete
            </Button>
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function TaskCard({
  task,
  mine,
  canManage,
  onView,
  onEdit,
  onDelete,
}: {
  task: Task;
  mine: boolean;
  canManage: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const deadline = formatDeadline(task.deadlineAt);
  return (
    <li
      className="rounded-2xl border border-slate-200 bg-white p-4"
      onClick={onView}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onView();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{task.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(task.status)}>
              {TASK_STATUS_OPTIONS.find((option) => option.value === task.status)?.label}
            </Badge>
            <Badge variant={priorityVariant(task.priority)} className="text-[10px]">
              {task.priority}
            </Badge>
            <span className="text-xs text-slate-500">{task.categoryName}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 px-2 py-2">
          <p className="truncate text-sm font-bold text-slate-900">{task.assigneeName ?? '—'}</p>
          <p className="text-[11px] text-slate-500">Assignee</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-2 py-2">
          <p className="truncate text-sm font-bold text-slate-900">{task.farmName}</p>
          <p className="text-[11px] text-slate-500">Farm</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-2 py-2">
          <p className={`text-sm font-bold ${deadline.overdue ? 'text-red-600' : 'text-slate-900'}`}>
            {deadline.text}
          </p>
          <p className="text-[11px] text-slate-500">Deadline</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${task.progress}%` }} />
        </div>
        <span className="text-xs font-medium text-slate-600">{task.progress}%</span>
      </div>

      {canManage ? (
        <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
          {!mine ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
            >
              Edit
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-red-600"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            Delete
          </Button>
        </div>
      ) : null}
    </li>
  );
}