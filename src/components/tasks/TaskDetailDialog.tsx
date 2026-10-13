import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Download, FileText, Link2, MapPin, Send, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError, fileUrl } from '@/services/api';
import { tasksApi } from '@/services/tasks';
import { appendOfflineComment, patchTaskInCache } from '@/pwa/offlineCache';
import { isQueuedError } from '@/pwa/syncQueue';
import { useToastStore } from '@/store/toast.store';
import { useAuthStore } from '@/store/auth.store';
import type { Task, TaskStatus } from '@/types';
import { TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from './TaskFormDialog';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function priorityBadge(priority: Task['priority']): NonNullable<import('@/components/ui/Badge').BadgeProps['variant']> {
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

function statusBadge(status: TaskStatus): NonNullable<import('@/components/ui/Badge').BadgeProps['variant']> {
  switch (status) {
    case 'todo':
      return 'default';
    case 'in_progress':
      return 'info';
    case 'finished':
      return 'success';
  }
}

const MAX_FILE_BYTES = 15 * 1024 * 1024;

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string | null;
}

export function TaskDetailDialog({ open, onOpenChange, taskId }: TaskDetailDialogProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  const detailQuery = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.get(taskId!),
    enabled: open && Boolean(taskId),
  });

  const task = detailQuery.data;

  useEffect(() => {
    if (task) setProgress(task.progress);
  }, [task]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    await queryClient.invalidateQueries({ queryKey: ['task', taskId] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: 'start' | 'complete') =>
      status === 'start' ? tasksApi.start(taskId!) : tasksApi.complete(taskId!),
    onSuccess: async () => {
      await invalidate();
      useToastStore.getState().add({ title: 'Task updated', description: 'The task status changed.' });
    },
    onError: (err, status) => {
      if (isQueuedError(err)) {
        patchTaskInCache(queryClient, taskId!, () =>
          status === 'start'
            ? { status: 'in_progress' }
            : { status: 'finished', progress: 100, completedAt: new Date().toISOString() },
        );
        useToastStore.getState().add({
          title: 'Change saved offline',
          description: "It will upload automatically when you're back online.",
          variant: 'info',
        });
        return;
      }
      useToastStore.getState().add({
        title: 'Could not update task',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const progressMutation = useMutation({
    mutationFn: (value: number) => tasksApi.update(taskId!, { progress: value }),
    onSuccess: async () => {
      await invalidate();
      useToastStore.getState().add({ title: 'Progress saved', description: 'Progress updated.' });
    },
    onError: (err, value) => {
      if (isQueuedError(err)) {
        patchTaskInCache(queryClient, taskId!, () => ({ progress: value }));
        useToastStore.getState().add({
          title: 'Progress saved offline',
          description: "It will upload automatically when you're back online.",
          variant: 'info',
        });
        return;
      }
      useToastStore.getState().add({
        title: 'Could not save progress',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) => tasksApi.addComment(taskId!, body),
    onSuccess: async () => {
      setComment('');
      setCommentError(null);
      await invalidate();
    },
    onError: (err, body) => {
      if (isQueuedError(err)) {
        appendOfflineComment(queryClient, taskId!, {
          body,
          userId: user?.id ?? null,
          userName: user?.name ?? null,
        });
        setComment('');
        setCommentError(null);
        useToastStore.getState().add({
          title: 'Comment saved offline',
          description: "It will upload automatically when you're back online.",
          variant: 'info',
        });
        return;
      }
      setCommentError(err instanceof ApiError ? err.message : 'Could not add your comment.');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => tasksApi.addAttachment(taskId!, file),
    onSuccess: async () => {
      if (fileInputRef.current) fileInputRef.current.value = '';
      await invalidate();
      useToastStore.getState().add({ title: 'File attached', description: 'The file was uploaded.' });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Upload failed',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: tasksApi.removeAttachment,
    onSuccess: async () => {
      await invalidate();
      useToastStore.getState().add({ title: 'File removed', description: 'The attachment was deleted.' });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not remove file',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  function handleCommentSubmit(event: FormEvent) {
    event.preventDefault();
    const body = comment.trim();
    if (!body) {
      setCommentError('Write a comment first.');
      return;
    }
    commentMutation.mutate(body);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      useToastStore.getState().add({
        title: 'File too large',
        description: 'Keep attachments under 15 MB.',
        variant: 'danger',
      });
      event.target.value = '';
      return;
    }
    uploadMutation.mutate(file);
  }

  if (!open) return null;

  const canLead =
    user &&
    (user.role === 'organization_administrator' ||
      user.role === 'farm_manager' ||
      user.role === 'supervisor');
  const isAssignee = task ? Boolean(user && task.assigneeUserId === user.id) : false;
  const canAdvance = task ? Boolean(canLead || isAssignee) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8">Task</DialogTitle>
          <DialogDescription className="sr-only">Task details</DialogDescription>
        </DialogHeader>

        {!task || detailQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : detailQuery.error ? (
          <Alert variant="danger">
            <AlertDescription>
              {detailQuery.error instanceof ApiError
                ? detailQuery.error.message
                : 'Could not load this task.'}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">{task.title}</h3>
                <Badge variant={statusBadge(task.status)}>
                  {TASK_STATUS_OPTIONS.find((option) => option.value === task.status)?.label}
                </Badge>
                <Badge variant={priorityBadge(task.priority)}>
                  {TASK_PRIORITY_OPTIONS.find((option) => option.value === task.priority)?.label}
                </Badge>
              </div>
              {task.description ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{task.description}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Farm</p>
                <p className="mt-0.5 font-medium text-slate-800">
                  <MapPin className="mr-1 inline size-3.5 text-slate-400" aria-hidden />
                  {task.farmName ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Field</p>
                <p className="mt-0.5 font-medium text-slate-800">{task.fieldName ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Assignee</p>
                <p className="mt-0.5 font-medium text-slate-800">{task.assigneeName ?? 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Category</p>
                <p className="mt-0.5 font-medium text-slate-800">{task.categoryName}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Starts</p>
                <p className="mt-0.5 font-medium text-slate-800">
                  <CalendarClock className="mr-1 inline size-3.5 text-slate-400" aria-hidden />
                  {formatDateTime(task.startAt)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Deadline</p>
                <p className="mt-0.5 font-medium text-slate-800">{formatDateTime(task.deadlineAt)}</p>
              </div>
              {task.actualDurationMinutes ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Took</p>
                  <p className="mt-0.5 font-medium text-slate-800">
                    {task.actualDurationMinutes} min
                    {task.estimatedDurationMinutes ? ` (est. ${task.estimatedDurationMinutes})` : ''}
                  </p>
                </div>
              ) : task.estimatedDurationMinutes ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Est. duration</p>
                  <p className="mt-0.5 font-medium text-slate-800">{task.estimatedDurationMinutes} min</p>
                </div>
              ) : null}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Created by</p>
                <p className="mt-0.5 font-medium text-slate-800">{task.createdByName ?? '—'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Progress</p>
                <span className="text-sm font-bold text-slate-900">{task.progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              {canLead ? (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={progress}
                    aria-label="Set progress"
                    onChange={(event) => setProgress(Number(event.target.value))}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={progressMutation.isPending}
                    onClick={() => progressMutation.mutate(progress)}
                  >
                    Save
                  </Button>
                </div>
              ) : null}
            </div>

            {canAdvance ? (
              <div className="flex flex-wrap gap-2">
                {task.status === 'todo' ? (
                  <Button onClick={() => statusMutation.mutate('start')} loading={statusMutation.isPending}>
                    Start task
                  </Button>
                ) : null}
                {task.status === 'in_progress' ? (
                  <Button onClick={() => statusMutation.mutate('complete')} loading={statusMutation.isPending}>
                    Mark complete
                  </Button>
                ) : null}
                {task.status === 'finished' && canLead ? (
                  <Button
                    variant="outline"
                    loading={statusMutation.isPending}
                    onClick={() => progressMutation.mutate(0)}
                  >
                    Reopen
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Attachments</p>
                {canLead || isAssignee ? (
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} loading={uploadMutation.isPending}>
                    <Link2 className="mr-1 size-3.5" aria-hidden />
                    Attach file
                  </Button>
                ) : null}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
              {task.attachments.length > 0 ? (
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {task.attachments.map((attachment) => (
                    <li key={attachment.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <FileText className="size-4 shrink-0 text-slate-400" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-800">{attachment.fileName}</p>
                        <p className="text-xs text-slate-500">
                          {formatFileSize(attachment.fileSize)} · {attachment.uploadedByName ?? 'Unknown'}
                        </p>
                      </div>
                      <a
                        href={fileUrl(attachment.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100"
                        download
                      >
                        <Download className="size-4" aria-hidden />
                        <span className="hidden sm:inline">Open</span>
                      </a>
                      {canLead || attachment.uploadedBy === user?.id ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${attachment.fileName}`}
                          onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                        >
                          <Trash2 className="size-4 text-red-600" aria-hidden />
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-slate-400">No attachments yet.</p>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700">Comments</p>
              <ul className="mt-2 space-y-3">
                {task.comments.length === 0 ? (
                  <p className="text-sm text-slate-400">No comments yet.</p>
                ) : (
                  task.comments.map((item) => (
                    <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">{item.userName ?? 'Unknown'}</p>
                        <p className="text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.body}</p>
                    </li>
                  ))
                )}
              </ul>

              <form onSubmit={handleCommentSubmit} className="mt-3 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Add a comment…"
                  value={comment}
                  onChange={(event) => {
                    setComment(event.target.value);
                    setCommentError(null);
                  }}
                />
                <Button
                  type="submit"
                  disabled={commentMutation.isPending}
                  loading={commentMutation.isPending}
                  aria-label="Send comment"
                >
                  <Send className="size-4" aria-hidden />
                  <span className="sr-only">Send</span>
                </Button>
              </form>
              {commentError ? <p className="mt-1 text-sm text-red-600">{commentError}</p> : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}