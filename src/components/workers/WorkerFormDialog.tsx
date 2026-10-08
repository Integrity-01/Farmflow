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
import { ApiError } from '@/services/api';
import { farmsApi } from '@/services/farms';
import { workersApi } from '@/services/workers';
import { useToastStore } from '@/store/toast.store';
import type { FarmField, Worker, WorkerDraft, WorkerStatus } from '@/types';

const NO_SELECTION = 'none';

export const WORKER_STATUS_OPTIONS: { value: WorkerStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

interface WorkerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worker?: Worker | null;
}

export function WorkerFormDialog({ open, onOpenChange, worker }: WorkerFormDialogProps) {
  const isEdit = Boolean(worker);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');
  const [farmId, setFarmId] = useState(NO_SELECTION);
  const [fieldId, setFieldId] = useState(NO_SELECTION);
  const [skills, setSkills] = useState('');
  const [status, setStatus] = useState<WorkerStatus>('active');
  const [joinedAt, setJoinedAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setName(worker?.name ?? '');
    setPhone(worker?.phone ?? '');
    setEmail(worker?.email ?? '');
    setPosition(worker?.position ?? '');
    setFarmId(worker?.farmId ?? NO_SELECTION);
    setFieldId(worker?.fieldId ?? NO_SELECTION);
    setSkills((worker?.skills ?? []).join(', '));
    setStatus(worker?.status ?? 'active');
    setJoinedAt(worker?.joinedAt ?? new Date().toISOString().slice(0, 10));
  }, [open, worker]);

  const farmsQuery = useQuery({
    queryKey: ['farms', 'all'],
    queryFn: () => farmsApi.list({ pageSize: 100, status: 'active' }),
    enabled: open,
  });

  const fieldsQuery = useQuery({
    queryKey: ['farms', farmId, 'fields'],
    queryFn: async () => {
      if (farmId === NO_SELECTION) return [];
      const detail = await farmsApi.get(farmId);
      return detail.fields.filter((field: FarmField) => field.status === 'active');
    },
    enabled: open && farmId !== NO_SELECTION,
  });

  function handleFarmChange(value: string) {
    setFarmId(value);
    setFieldId(NO_SELECTION);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError('Please enter a worker name.');
      return;
    }

    const parsedSkills = skills
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean)
      .slice(0, 12);

    const draft: WorkerDraft = {
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      position: position.trim() || null,
      farmId: farmId === NO_SELECTION ? null : farmId,
      fieldId: fieldId === NO_SELECTION ? null : fieldId,
      skills: parsedSkills,
      status,
      joinedAt: joinedAt || null,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await workersApi.update(worker!.id, draft);
        useToastStore.getState().add({
          title: 'Worker updated',
          description: `"${draft.name}" has been saved.`,
        });
      } else {
        await workersApi.create(draft);
        useToastStore.getState().add({
          title: 'Worker added',
          description: `${draft.name} is now on the team.`,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit worker' : 'Add a worker'}</DialogTitle>
          <DialogDescription>
            Details for who is working on your farm — they can be assigned to tasks.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <FormField id="worker-name" label="Worker name" required>
            <Input
              id="worker-name"
              placeholder="e.g. Musa Ibrahim"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="worker-phone" label="Phone">
              <Input
                id="worker-phone"
                type="tel"
                inputMode="tel"
                placeholder="+234…"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </FormField>
            <FormField id="worker-email" label="Email">
              <Input
                id="worker-email"
                type="email"
                inputMode="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="worker-position" label="Role / position">
              <Input
                id="worker-position"
                placeholder="e.g. Harvest lead"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
              />
            </FormField>
            <FormField id="worker-status" label="Status">
              <Select value={status} onValueChange={(value) => setStatus(value as WorkerStatus)}>
                <SelectTrigger id="worker-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKER_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="worker-farm" label="Farm">
              <Select value={farmId} onValueChange={handleFarmChange}>
                <SelectTrigger id="worker-farm">
                  <SelectValue placeholder="No farm" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SELECTION}>No farm</SelectItem>
                  {farms.map((farm) => (
                    <SelectItem key={farm.id} value={farm.id}>
                      {farm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="worker-field" label="Field">
              <Select value={fieldId} onValueChange={setFieldId} disabled={farmId === NO_SELECTION}>
                <SelectTrigger id="worker-field">
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

          <FormField id="worker-joined" label="Joined on">
            <Input
              id="worker-joined"
              type="date"
              value={joinedAt}
              onChange={(event) => setJoinedAt(event.target.value)}
            />
          </FormField>

          <FormField id="worker-skills" label="Skills" hint="Separate skills with commas, e.g. planting, irrigation.">
            <Input
              id="worker-skills"
              placeholder="e.g. planting, irrigation, harvesting"
              value={skills}
              onChange={(event) => setSkills(event.target.value)}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {isEdit ? 'Save changes' : 'Add worker'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}