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
import { farmsApi } from '@/services/farms';
import { useToastStore } from '@/store/toast.store';
import type { Farm, FarmDraft, FarmStatus, SizeUnit } from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { FARM_STATUS_OPTIONS, SIZE_UNIT_OPTIONS } from './labels';

const NO_MANAGER = 'none';

interface FarmFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farm?: Farm | null;
}

export function FarmFormDialog({ open, onOpenChange, farm }: FarmFormDialogProps) {
  const isEdit = Boolean(farm);
  const canManage = useAuthStore((state) => state.user?.role);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [size, setSize] = useState('');
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>('hectares');
  const [managerId, setManagerId] = useState(NO_MANAGER);
  const [status, setStatus] = useState<FarmStatus>('active');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setName(farm?.name ?? '');
    setLocation(farm?.location ?? '');
    setDescription(farm?.description ?? '');
    setLatitude(farm?.latitude ?? '');
    setLongitude(farm?.longitude ?? '');
    setSize(farm?.size ?? '');
    setSizeUnit(farm?.sizeUnit ?? 'hectares');
    setManagerId(farm?.managerId ?? NO_MANAGER);
    setStatus(farm?.status ?? 'active');
  }, [open, farm]);

  const managersQuery = useQuery({
    queryKey: ['farm-managers'],
    queryFn: farmsApi.managers,
    enabled: open && canManage === 'farm_manager',
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError('Please enter a farm name.');
      return;
    }

    const draft: FarmDraft = {
      name: name.trim(),
      location: location.trim() || null,
      description: description.trim() || null,
      latitude: latitude.trim() === '' ? null : Number(latitude),
      longitude: longitude.trim() === '' ? null : Number(longitude),
      size: size.trim() === '' ? null : Number(size),
      sizeUnit,
      managerId: managerId === NO_MANAGER ? null : managerId,
      status,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await farmsApi.update(farm!.id, draft);
        useToastStore.getState().add({
          title: 'Farm updated',
          description: `"${draft.name}" has been saved.`,
        });
      } else {
        await farmsApi.create(draft);
        useToastStore.getState().add({
          title: 'Farm added',
          description: `"${draft.name}" is ready for fields and tasks.`,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit farm' : 'Add a farm'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the details for this farm.'
              : 'Give your farm a name — you can add fields and tasks next.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <FormField id="farm-name" label="Farm name" required>
            <Input
              id="farm-name"
              placeholder="e.g. Green Valley Farm"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>

          <FormField id="farm-location" label="Location">
            <Input
              id="farm-location"
              placeholder="State, LGA or region"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="farm-latitude"
              label="Latitude"
              hint="Optional — powers weather forecasts"
            >
              <Input
                id="farm-latitude"
                type="number"
                min={-90}
                max={90}
                step="any"
                inputMode="decimal"
                placeholder="e.g. 9.06"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
              />
            </FormField>
            <FormField id="farm-longitude" label="Longitude">
              <Input
                id="farm-longitude"
                type="number"
                min={-180}
                max={180}
                step="any"
                inputMode="decimal"
                placeholder="e.g. 7.49"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="farm-size" label="Size">
              <Input
                id="farm-size"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                placeholder="0"
                value={size}
                onChange={(event) => setSize(event.target.value)}
              />
            </FormField>
            <FormField id="farm-size-unit" label="Unit">
              <Select value={sizeUnit} onValueChange={(value) => setSizeUnit(value as SizeUnit)}>
                <SelectTrigger id="farm-size-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIZE_UNIT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="farm-manager" label="Manager">
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger id="farm-manager">
                  <SelectValue placeholder="No manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MANAGER}>No manager</SelectItem>
                  {managersQuery.data?.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField id="farm-status" label="Status">
              <Select value={status} onValueChange={(value) => setStatus(value as FarmStatus)}>
                <SelectTrigger id="farm-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FARM_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField id="farm-description" label="Description" hint="Anything the team should know about this farm.">
            <Textarea
              id="farm-description"
              rows={3}
              placeholder="Crops grown, soil notes, access roads…"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {isEdit ? 'Save changes' : 'Create farm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}