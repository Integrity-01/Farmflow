import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlarmClock,
  Bell,
  BellOff,
  CheckCheck,
  ClipboardCheck,
  MessageSquare,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination, pageRange } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError } from '@/services/api';
import { notificationsApi } from '@/services/notifications';
import { useToastStore } from '@/store/toast.store';
import type { NotificationItem, NotificationType } from '@/types';

const PAGE_SIZE = 20;

function typeIcon(type: NotificationType) {
  switch (type) {
    case 'task_assigned':
      return UserPlus;
    case 'task_overdue':
      return AlarmClock;
    case 'task_due_soon':
      return Bell;
    case 'task_completed':
      return ClipboardCheck;
    case 'task_comment':
      return MessageSquare;
    default:
      return Sparkles;
  }
}

function formatSent(iso: string): string {
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

export function Notifications() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const listQuery = useQuery({
    queryKey: ['notifications', { unreadOnly, page }],
    queryFn: () =>
      notificationsApi.list({
        unreadOnly: unreadOnly || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    retry: 0,
  });

  const listError =
    listQuery.error instanceof ApiError
      ? listQuery.error.message
      : listQuery.error
        ? 'Could not load your notifications.'
        : null;

  const readMutation = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: () => undefined,
  });

  const readAllMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      useToastStore.getState().add({ title: 'All caught up', description: 'Marked everything as read.' });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not update notifications',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  function handleOpen(item: NotificationItem) {
    if (!item.isRead) {
      readMutation.mutate(item.id);
    }
    if (item.taskId) {
      navigate(`/tasks?task=${item.taskId}`);
    }
  }

  const pageCount = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Notifications</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {listQuery.data && !listQuery.isFetching
              ? `${listQuery.data.total} notification${listQuery.data.total === 1 ? '' : 's'}`
              : 'Updates from your team'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={unreadOnly ? 'outline' : 'ghost'}
            size="sm"
            onClick={() => {
              setUnreadOnly(!unreadOnly);
              setPage(1);
            }}
          >
            {unreadOnly ? <Bell className="size-4" aria-hidden /> : <BellOff className="size-4" aria-hidden />}
            {unreadOnly ? 'All' : 'Unread only'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={readAllMutation.isPending}
            onClick={() => readAllMutation.mutate()}
          >
            <CheckCheck className="size-4" aria-hidden />
            Mark all read
          </Button>
        </div>
      </div>

      {listError ? (
        <Alert variant="danger">
          <AlertTitle>Could not load notifications</AlertTitle>
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
          <ul className="space-y-2">
            {listQuery.data.items.map((item) => {
              const Icon = typeIcon(item.type);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleOpen(item)}
                    className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors hover:bg-slate-50 ${
                      item.isRead ? 'border-slate-200 bg-white' : 'border-emerald-200 bg-emerald-50/50'
                    }`}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 ring-1 ring-slate-200">
                      <Icon className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-slate-900">{item.title}</p>
                        <span className="shrink-0 text-xs text-slate-400">{formatSent(item.sentAt)}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-600">{item.message}</p>
                    </div>
                    {!item.isRead ? (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-slate-500">
              {pageRange(listQuery.data.total, page, PAGE_SIZE, 'notifications')}
            </p>
            <Pagination page={page} pageCount={pageCount} onPageChange={(next) => { setPage(next); window.scrollTo({ top: 0 }); }} />
          </div>
        </>
      ) : (
        <EmptyState
          icon={Bell}
          title={unreadOnly ? 'Nothing unread' : 'No notifications yet'}
          description={
            unreadOnly
              ? 'You are all caught up. Switch to "All" to browse older items.'
              : 'Assignment, deadline and comment updates will appear here.'
          }
        />
      )}
    </div>
  );
}