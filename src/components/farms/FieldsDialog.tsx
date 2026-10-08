import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
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
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { ApiError } from '@/services/api';
import { farmsApi } from '@/services/farms';
import { useToastStore } from '@/store/toast.store';
import type { Farm, FarmField, FarmFieldDraft, FieldStatus, SizeUnit } from '@/types';
import { FIELD_STATUS_OPTIONS, SIZE_UNIT_OPTIONS, fieldStatusBadge, formatSize } from './labels';

interface FieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farm: Farm;
}

interface FieldFormDialogProps {
  isEditing: boolean;
  initial: FieldFormState;
  onSubmit: (draft: FarmFieldDraft) => Promise<void>;
  onCancel: () => void;
}

interface FieldFormState {
  name: string;
  size: string;
  sizeUnit: SizeUnit;
  crop: string;
  cropVariety: string;
  plantingDate: string;
  expectedHarvestDate: string;
  status: FieldStatus;
  notes: string;
}

const EMPTY_FIELD: FieldFormState = {
  name: '',
  size: '',
  sizeUnit: 'hectares',
  crop: '',
  cropVariety: '',
  plantingDate: '',
  expectedHarvestDate: '',
  status: 'active',
  notes: '',
};

function draftFromState(state: FieldFormState): FarmFieldDraft {
  return {
    name: state.name.trim(),
    size: state.size.trim() === '' ? null : Number(state.size),
    sizeUnit: state.sizeUnit,
    crop: state.crop.trim() || null,
    cropVariety: state.cropVariety.trim() || null,
    plantingDate: state.plantingDate || null,
    expectedHarvestDate: state.expectedHarvestDate || null,
    status: state.status,
    notes: state.notes.trim() || null,
  };
}

function FieldFormDialog({ isEditing, initial, onSubmit, onCancel }: FieldFormDialogProps) {
  const [state, setState] = useState<FieldFormState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setState(initial);
    setError(null);
    setSaving(false);
  }, [initial]);

  const set = <K extends keyof FieldFormState>(key: K, value: FieldFormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (state.name.trim().length < 2) {
      setError('Please enter a field name.');
      return;
    }
    if (
      state.expectedHarvestDate &&
      state.plantingDate &&
      state.expectedHarvestDate < state.plantingDate
    ) {
      setError('The expected harvest date must be after the planting date.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit(draftFromState(state));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error ? (
        <Alert variant="danger">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormField id="field-name" label="Field name" required>
        <Input
          id="field-name"
          placeholder="e.g. North plot"
          value={state.name}
          onChange={(event) => set('name', event.target.value)}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField id="field-size" label="Size">
          <Input
            id="field-size"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            placeholder="0"
            value={state.size}
            onChange={(event) => set('size', event.target.value)}
          />
        </FormField>
        <FormField id="field-size-unit" label="Unit">
          <Select value={state.sizeUnit} onValueChange={(value) => set('sizeUnit', value as SizeUnit)}>
            <SelectTrigger id="field-size-unit">
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

      <div className="grid grid-cols-2 gap-3">
        <FormField id="field-crop" label="Crop">
          <Input
            id="field-crop"
            placeholder="e.g. Maize"
            value={state.crop}
            onChange={(event) => set('crop', event.target.value)}
          />
        </FormField>
        <FormField id="field-variety" label="Crop variety">
          <Input
            id="field-variety"
            placeholder="e.g. SWAM-1"
            value={state.cropVariety}
            onChange={(event) => set('cropVariety', event.target.value)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField id="field-planted" label="Planting date">
          <Input
            id="field-planted"
            type="date"
            value={state.plantingDate}
            onChange={(event) => set('plantingDate', event.target.value)}
          />
        </FormField>
        <FormField id="field-harvest" label="Expected harvest">
          <Input
            id="field-harvest"
            type="date"
            value={state.expectedHarvestDate}
            onChange={(event) => set('expectedHarvestDate', event.target.value)}
          />
        </FormField>
      </div>

      <FormField id="field-status" label="Status">
        <Select value={state.status} onValueChange={(value) => set('status', value as FieldStatus)}>
          <SelectTrigger id="field-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField id="field-notes" label="Notes">
        <Textarea
          id="field-notes"
          rows={2}
          placeholder="Soil type, drainage, anything useful…"
          value={state.notes}
          onChange={(event) => set('notes', event.target.value)}
        />
      </FormField>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {isEditing ? 'Save changes' : 'Add field'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function FieldsDialog({ open, onOpenChange, farm }: FieldsDialogProps) {
  const queryClient = useQueryClient();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<{ field: FarmField | null }>({ field: null });
  const [confirmDelete, setConfirmDelete] = useState<FarmField | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fieldsQuery = useQuery({
    queryKey: ['farm-fields', farm.id],
    queryFn: async () => (await farmsApi.get(farm.id)).fields,
    enabled: open,
    retry: 0,
  });

  useEffect(() => {
    if (fieldsQuery.error) {
      setLoadError(
        fieldsQuery.error instanceof ApiError
          ? fieldsQuery.error.message
          : 'Could not load fields.',
      );
    } else {
      setLoadError(null);
    }
  }, [fieldsQuery.error]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['farm-fields', farm.id] });
    await queryClient.invalidateQueries({ queryKey: ['farms'] });
  }

  async function handleSave(draft: FarmFieldDraft) {
    if (editing.field) {
      await farmsApi.updateField(editing.field.id, draft);
      useToastStore.getState().add({
        title: 'Field updated',
        description: `"${draft.name}" has been saved.`,
      });
    } else {
      await farmsApi.addField(farm.id, draft);
      useToastStore.getState().add({
        title: 'Field added',
        description: `"${draft.name}" was added to ${farm.name}.`,
      });
    }
    setOpenForm(false);
    setEditing({ field: null });
    await refresh();
  }

  const deleteMutation = useMutation({
    mutationFn: farmsApi.removeField,
    onSuccess: async () => {
      setConfirmDelete(null);
      await refresh();
      useToastStore.getState().add({
        title: 'Field deleted',
        description: 'The field was removed.',
      });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not delete field',
        description: err instanceof ApiError ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  function stateFor(field: FarmField | null): FieldFormState {
    if (!field) return EMPTY_FIELD;
    return {
      name: field.name,
      size: field.size ?? '',
      sizeUnit: field.sizeUnit,
      crop: field.crop ?? '',
      cropVariety: field.cropVariety ?? '',
      plantingDate: field.plantingDate ?? '',
      expectedHarvestDate: field.expectedHarvestDate ?? '',
      status: field.status,
      notes: field.notes ?? '',
    };
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Fields on {farm.name}</DialogTitle>
            <DialogDescription>
              Break the farm into fields so tasks can be pinned to a specific plot.
            </DialogDescription>
          </DialogHeader>

          {loadError ? (
            <Alert variant="danger">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="sm:justify-start">
            <Button onClick={() => { setEditing({ field: null }); setOpenForm(true); }}>
              <Plus className="size-4" aria-hidden />
              Add field
            </Button>
          </DialogFooter>

          <div className="-mx-6 -mb-2 overflow-y-auto border-t border-slate-100 px-6 py-2">
            {fieldsQuery.isLoading ? (
              <div className="space-y-3 py-4">
                {[0, 1, 2].map((item) => (
                  <Skeleton key={item} className="h-16 w-full" />
                ))}
              </div>
            ) : fieldsQuery.data && fieldsQuery.data.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {fieldsQuery.data.map((field) => {
                  const status = fieldStatusBadge(field.status);
                  return (
                    <li key={field.id} className="flex items-center gap-3 py-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                        <MapPin className="size-5" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{field.name}</p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {field.crop ?? 'No crop set'} · {formatSize(field.size, field.sizeUnit)}
                          {field.expectedHarvestDate ? ` · harvest ${field.expectedHarvestDate}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${field.name}`}
                          onClick={() => { setEditing({ field }); setOpenForm(true); }}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${field.name}`}
                          onClick={() => setConfirmDelete(field)}
                        >
                          <Trash2 className="size-4 text-red-600" aria-hidden />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={MapPin}
                title="No fields yet"
                description="Add your first field to start assigning tasks to specific plots."
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editing.field ? 'Edit field' : 'Add a field'}</DialogTitle>
            <DialogDescription>
              {editing.field
                ? `Update "${editing.field.name}".`
                : 'A field is a named plot within this farm.'}
            </DialogDescription>
          </DialogHeader>
          <FieldFormDialog
            isEditing={Boolean(editing.field)}
            initial={stateFor(editing.field)}
            onSubmit={handleSave}
            onCancel={() => {
              setOpenForm(false);
              setEditing({ field: null });
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this field?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.name}" will be removed from {farm.name}. Its tasks stay
              but are unlinked from the field.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
            >
              Delete field
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}