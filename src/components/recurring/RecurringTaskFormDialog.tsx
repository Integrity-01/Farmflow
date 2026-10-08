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
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { ApiError } from '@/services/api';
import { farmsApi } from '@/services/farms';
import { recurringTasksApi } from '@/services/recurringTasks';
import { tasksApi } from '@/services/tasks';
import { workersApi } from '@/services/workers';
import { useToastStore } from '@/store/toast.store';
import { cn } from '@/utils/cn';
import type { RecurringFrequency, RecurringTask, RecurringTaskDraft, TaskPriority } from '@/types';

const NO_SELECTION = 'none';

const RECURRING_FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function minutesToTime(minutes: number): string {
  const m = Math.max(0, Math.min(1439, minutes));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function timeToMinutes(value: string): number {
  if (!value) return 420;
  const [h, m] = value.split(':').map(Number);
  return (Number.isFinite(h) ? h : 7) * 60 + (Number.isFinite(m) ? m : 0);
}

interface RecurringTaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: RecurringTask | null;
}

export function RecurringTaskFormDialog({ open, onOpenChange, rule }: RecurringTaskFormDialogProps) {
  const isEdit = Boolean(rule);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [farmId, setFarmId] = useState(NO_SELECTION);
  const [fieldId, setFieldId] = useState(NO_SELECTION);
  const [categoryId, setCategoryId] = useState(NO_SELECTION);
  const [assignedTo, setAssignedTo] = useState(NO_SELECTION);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [frequency, setFrequency] = useState<RecurringFrequency>('weekly');
  const [intervalCount, setIntervalCount] = useState('1');
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [startTime, setStartTime] = useState('07:00');
  const [duration, setDuration] = useState('');
  const [reminder, setReminder] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setTitle(rule?.title ?? '');
    setDescription(rule?.description ?? '');
    setFarmId(rule?.farmId ?? NO_SELECTION);
    setFieldId(rule?.fieldId ?? NO_SELECTION);
    setCategoryId(rule?.categoryId ?? NO_SELECTION);
    setAssignedTo(rule?.assignedTo ?? NO_SELECTION);
    setPriority(rule?.priority ?? 'medium');
    setFrequency(rule?.frequency ?? 'weekly');
    setIntervalCount(rule?.intervalCount ? String(rule.intervalCount) : '1');
    setWeekdays(rule?.weekdays && rule.weekdays.length > 0 ? rule.weekdays : [1, 3, 5]);
    setDayOfMonth(rule?.dayOfMonth ? String(rule.dayOfMonth) : '1');
    setStartTime(minutesToTime(rule?.startTimeMinutes ?? 420));
    setDuration(rule?.estimatedDurationMinutes ? String(rule.estimatedDurationMinutes) : '');
    setReminder(rule?.reminderOffsetMinutes ? String(rule.reminderOffsetMinutes) : '');
    setStartDate(rule?.startDate ?? '');
    setEndDate(rule?.endDate ?? '');
    setActive(rule?.active ?? true);
  }, [open, rule]);

  const farmsQuery = useQuery({
    queryKey: ['farms', 'recurring-form'],
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
    queryKey: ['workers', 'recurring-form', farmId],
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

  function toggleWeekday(day: number) {
    setWeekdays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const today = new Date().toISOString().slice(0, 10);
    if (title.trim().length < 2) {
      setError('Please enter a title for the recurring task.');
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
    if (frequency === 'weekly' && weekdays.length === 0) {
      setError('Pick at least one day of the week.');
      return;
    }
    if (!startDate) {
      setError('Please choose a start date.');
      return;
    }
    if (startDate < today) {
      setError('The start date cannot be in the past.');
      return;
    }
    if (endDate && endDate < startDate) {
      setError('The end date must be on or after the start date.');
      return;
    }

    const draft: RecurringTaskDraft = {
      title: title.trim(),
      description: description.trim() || null,
      farmId,
      fieldId: fieldId === NO_SELECTION ? null : fieldId,
      categoryId,
      assignedTo: assignedTo === NO_SELECTION ? null : assignedTo,
      priority,
      frequency,
      intervalCount: Math.max(1, Number(intervalCount) || 1),
      weekdays: frequency === 'weekly' ? weekdays : [],
      dayOfMonth: frequency === 'monthly' ? Number(dayOfMonth) : null,
      startTimeMinutes: timeToMinutes(startTime),
      estimatedDurationMinutes: duration === '' ? null : Number(duration),
      reminderOffsetMinutes: reminder === '' ? null : Number(reminder),
      startDate,
      endDate: endDate || null,
      active,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await recurringTasksApi.update(rule!.id, draft);
        useToastStore.getState().add({
          title: 'Recurring task updated',
          description: '"' + draft.title + '" has been saved.',
        });
      } else {
        await recurringTasksApi.create(draft);
        useToastStore.getState().add({
          title: 'Recurring task created',
          description: 'Next occurrence will be generated on schedule.',
        });
      }
      onOpenChange(false);
    } catch (err) {
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
          <DialogTitle>{isEdit ? 'Edit recurring task' : 'Create a recurring task'}</DialogTitle>
          <DialogDescription>
            Tasks will be generated automatically on the schedule you set here.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <FormField id="recurring-title" label="Title" required>
            <Input
              id="recurring-title"
              placeholder="e.g. Inspect irrigation lines"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>

          <FormField id="recurring-description" label="Description">
            <Textarea
              id="recurring-description"
              rows={3}
              placeholder="What should each generated task cover?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="recurring-farm" label="Farm" required>
              <Select value={farmId} onValueChange={handleFarmChange}>
                <SelectTrigger id="recurring-farm">
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
            <FormField id="recurring-field" label="Field">
              <Select value={fieldId} onValueChange={setFieldId} disabled={farmId === NO_SELECTION}>
                <SelectTrigger id="recurring-field">
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
            <FormField id="recurring-category" label="Category" required>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="recurring-category">
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
            <FormField id="recurring-priority" label="Priority">
              <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
                <SelectTrigger id="recurring-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['low', 'medium', 'high', 'critical'] as const).map((value) => (
                    <SelectItem key={value} value={value}>
                      {value[0].toUpperCase() + value.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField id="recurring-assignee" label="Assign to" hint="Active workers on the chosen farm.">
            <Select value={assignedTo} onValueChange={setAssignedTo} disabled={farmId === NO_SELECTION}>
              <SelectTrigger id="recurring-assignee">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField id="recurring-frequency" label="Frequency" required>
              <Select value={frequency} onValueChange={(value) => setFrequency(value as RecurringFrequency)}>
                <SelectTrigger id="recurring-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRING_FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="recurring-interval" label="Every">
              <Input
                id="recurring-interval"
                type="number"
                min={1}
                max={99}
                inputMode="numeric"
                value={intervalCount}
                onChange={(event) => setIntervalCount(event.target.value)}
              />
            </FormField>
            <FormField id="recurring-time" label="Time of day">
              <Input
                id="recurring-time"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </FormField>
          </div>

          {frequency === 'weekly' ? (
            <FormField
              id="recurring-weekdays"
              label="Days of the week"
              hint={weekdays.length === 0 ? 'Pick at least one day.' : undefined}
            >
              <div className="flex flex-wrap gap-2" role="group" aria-label="Days of the week">
                {WEEKDAY_LABELS.map((label, day) => (
                  <button
                    key={day}
                    type="button"
                    className={cn(
                      'h-9 w-11 rounded-full border text-xs font-semibold transition-colors',
                      weekdays.includes(day)
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
                    )}
                    aria-pressed={weekdays.includes(day)}
                    onClick={() => toggleWeekday(day)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </FormField>
          ) : null}

          {frequency === 'monthly' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField id="recurring-day-of-month" label="Day of month" required>
                <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                  <SelectTrigger id="recurring-day-of-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="recurring-start-date" label="Start date" required>
              <Input
                id="recurring-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </FormField>
            <FormField id="recurring-end-date" label="End date" hint="Leave empty to run indefinitely.">
              <Input
                id="recurring-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="recurring-duration" label="Est. duration (min)">
              <Input
                id="recurring-duration"
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="e.g. 60"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </FormField>
            <FormField id="recurring-reminder" label="Remind before (min)" hint="Optional.">
              <Input
                id="recurring-reminder"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="e.g. 60"
                value={reminder}
                onChange={(event) => setReminder(event.target.value)}
              />
            </FormField>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Schedule active</p>
              <p className="text-xs text-slate-500">New instances are generated only while active.</p>
            </div>
            <Switch
              checked={active}
              onCheckedChange={setActive}
              aria-label="Schedule active"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {isEdit ? 'Save changes' : 'Create recurring task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}