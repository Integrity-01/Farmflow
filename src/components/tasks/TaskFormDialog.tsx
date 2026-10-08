import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ApiError } from '@/services/api';
import { isQueuedError } from '@/pwa/syncQueue';
import { farmsApi } from '@/services/farms';
import { tasksApi } from '@/services/tasks';
import { workersApi } from '@/services/workers';
import { useToastStore } from '@/store/toast.store';
import type { Task, TaskDraft, TaskPriority, TaskStatus } from '@/types';

const NO_SELECTION = 'none';

export const TASK_PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'finished', label: 'Finished' },
];

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIso(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaultFarmId?: string;
  defaultTitle?: string;
  defaultPriority?: TaskPriority;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaultFarmId,
  defaultTitle,
  defaultPriority,
}: TaskFormDialogProps) {
  const isEdit = Boolean(task);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [farmId, setFarmId] = useState(NO_SELECTION);
  const [fieldId, setFieldId] = useState(NO_SELECTION);
  const [categoryId, setCategoryId] = useState(NO_SELECTION);
  const [assignedTo, setAssignedTo] = useState(NO_SELECTION);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [startAt, setStartAt] = useState('');
  const [deadlineAt, setDeadlineAt] = useState('');
  const [duration, setDuration] = useState('');
  const [reminder, setReminder] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setTitle(task?.title ?? defaultTitle ?? '');
    setDescription(task?.description ?? '');
    setFarmId(task?.farmId ?? defaultFarmId ?? NO_SELECTION);
    setFieldId(task?.fieldId ?? NO_SELECTION);
    setCategoryId(task?.categoryId ?? NO_SELECTION);
    setAssignedTo(task?.assignedTo ?? NO_SELECTION);
    setPriority(task?.priority ?? defaultPriority ?? 'medium');
    setStatus(task?.status ?? 'todo');
    setStartAt(toLocalInput(task?.startAt));
    setDeadlineAt(toLocalInput(task?.deadlineAt));
    setDuration(task?.estimatedDurationMinutes ? String(task.estimatedDurationMinutes) : '');
    setReminder(task?.reminderOffsetMinutes ? String(task.reminderOffsetMinutes) : '');
  }, [open, task, defaultFarmId, defaultTitle, defaultPriority]);

  const farmsQuery = useQuery({
    queryKey: ['farms', 'task-form'],
    queryFn: () => farmsApi.list({ pageSize: 100 }),
    enabled: open,
  });

  const fieldsQuery = useQuery({
    queryKey: ['farms', farmId, 'fields'],
    queryFn: async () => {
      if (farmId === NO_SELECTION) return [];
      const detail = await farmsApi.get(farmId);
      return detail.fields;
    },
    enabled: open && farmId !== NO_SELECTION,
  });

  const workersQuery = useQuery({
    queryKey: ['workers', 'task-form', farmId],
    queryFn: async () => {
      if (farmId === NO_SELECTION) return { items: [] };
      return workersApi.list({ farmId, status: 'active', pageSize: 100 });
    },
    enabled: open && farmId !== NO_SELECTION,
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: tasksApi.categories,
    enabled: open,
  });

  function handleFarmChange(value: string) {
    setFarmId(value);
    setFieldId(NO_SELECTION);
    setAssignedTo(NO_SELECTION);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (title.trim().length < 2) {
      setError('Please enter a task title.');
      return;
    }
    if (farmId === NO_SELECTION) {
      setError('Please choose a farm.');
      return;
    }
    if (categoryId === NO_SELECTION) {
      setError('Please choose a category.');
      return;
    }
    if (deadlineAt && startAt && new Date(deadlineAt) < new Date(startAt)) {
      setError('The deadline must be after the start time.');
      return;
    }

    const draft: TaskDraft = {
      title: title.trim(),
      description: description.trim() || null,
      farmId,
      fieldId: fieldId === NO_SELECTION ? null : fieldId,
      categoryId,
      assignedTo: assignedTo === NO_SELECTION ? null : assignedTo,
      priority,
      status: isEdit ? undefined : status,
      startAt: toIso(startAt),
      deadlineAt: toIso(deadlineAt),
      estimatedDurationMinutes: duration === '' ? null : Number(duration),
      reminderOffsetMinutes: reminder === '' ? null : Number(reminder),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await tasksApi.update(task!.id, draft);
        useToastStore.getState().add({
          title: 'Task updated',
          description: '"' + draft.title + '" has been saved.',
        });
      } else {
        await tasksApi.create(draft);
        useToastStore.getState().add({
          title: 'Task created',
          description: '"' + draft.title + '" is ready to work on.',
        });
      }
      onOpenChange(false);
    } catch (err) {
      if (isQueuedError(err)) {
        onOpenChange(false);
        useToastStore.getState().add({
          title: 'Change saved offline',
          description: "It will upload automatically when you're back online.",
          variant: 'info',
        });
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const farms = farmsQuery.data?.items ?? [];
  const fields = fieldsQuery.data ?? [];
  const workers = workersQuery.data?.items ?? [];
  const categories = categoriesQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit task' : 'Create a task'}</DialogTitle>
          <DialogDescription>
            Describe the work, where it happens and who does it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <FormField id="task-title" label="Task title" required>
            <Input
              id="task-title"
              placeholder="e.g. Spray tomatoes for blight"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>

          <FormField id="task-description" label="Description">
            <Textarea
              id="task-description"
              rows={3}
              placeholder="What needs to be done, and how will you know it's done?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="task-farm" label="Farm" required>
              <Select value={farmId} onValueChange={handleFarmChange}>
                <SelectTrigger id="task-farm">
                  <SelectValue placeholder="Choose a farm" />
                </SelectTrigger>
                <SelectContent>
                  {farms.map((farm) => (
                    <SelectItem key={farm.id} value={farm.id}>
                      {farm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="task-field" label="Field">
              <Select value={fieldId} onValueChange={setFieldId} disabled={farmId === NO_SELECTION}>
                <SelectTrigger id="task-field">
                  <SelectValue placeholder={farmId === NO_SELECTION ? 'Choose a farm first' : 'No field'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SELECTION}>No field</SelectItem>
                  {fields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="task-category" label="Category" required>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="task-category">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="task-priority" label="Priority">
              <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField id="task-assignee" label="Assign to" hint="Active workers on the chosen farm.">
            <Select value={assignedTo} onValueChange={setAssignedTo} disabled={farmId === NO_SELECTION}>
              <SelectTrigger id="task-assignee">
                <SelectValue placeholder={farmId === NO_SELECTION ? 'Choose a farm first' : 'Unassigned'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SELECTION}>Unassigned</SelectItem>
                {workers.map((worker) => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.name}
                    {worker.position ? ` — ${worker.position}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="task-start" label="Start">
              <Input
                id="task-start"
                type="datetime-local"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
              />
            </FormField>
            <FormField id="task-deadline" label="Deadline">
              <Input
                id="task-deadline"
                type="datetime-local"
                value={deadlineAt}
                onChange={(event) => setDeadlineAt(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="task-duration" label="Est. duration (min)">
              <Input
                id="task-duration"
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="e.g. 120"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </FormField>
            <FormField id="task-reminder" label="Remind before (min)" hint="Optional.">
              <Input
                id="task-reminder"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="e.g. 60"
                value={reminder}
                onChange={(event) => setReminder(event.target.value)}
              />
            </FormField>
          </div>

          {!isEdit ? (
            <FormField id="task-status" label="Status">
              <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
                <SelectTrigger id="task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {isEdit ? 'Save changes' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}