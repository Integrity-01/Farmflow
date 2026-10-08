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
import { inventoryApi } from '@/services/inventory';
import { useToastStore } from '@/store/toast.store';
import type { InputDraft, InputType, InventoryItem } from '@/types';
import { INPUT_TYPE_OPTIONS } from './labels';

interface InventoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input?: InventoryItem | null;
}

export function InventoryFormDialog({ open, onOpenChange, input }: InventoryFormDialogProps) {
  const isEdit = Boolean(input);

  const [farmId, setFarmId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<InputType>('other');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setFarmId(input?.farmId ?? '');
    setName(input?.name ?? '');
    setType(input?.type ?? 'other');
    setUnit(input?.unit ?? '');
    setQuantity(input?.quantity ?? '');
    setLowStockThreshold(input?.lowStockThreshold ?? '');
    setUnitCost(input?.unitCost ?? '');
    setSupplier(input?.supplier ?? '');
    setNotes(input?.notes ?? '');
  }, [open, input]);

  const farmsQuery = useQuery({
    queryKey: ['inventory-farms'],
    queryFn: () => farmsApi.list({ pageSize: 100 }),
    enabled: open,
    retry: 0,
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!farmId) {
      setError('Please choose a farm for this input.');
      return;
    }
    if (name.trim().length < 2) {
      setError('Please enter an input name.');
      return;
    }
    if (unit.trim().length < 1) {
      setError('Please choose a unit (e.g. kg, litres, bags).');
      return;
    }

    const draft: InputDraft = {
      farmId,
      name: name.trim(),
      type,
      unit: unit.trim(),
      quantity: quantity.trim() === '' ? 0 : Number(quantity),
      lowStockThreshold: lowStockThreshold.trim() === '' ? 0 : Number(lowStockThreshold),
      unitCost: unitCost.trim() === '' ? null : Number(unitCost),
      supplier: supplier.trim() || null,
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await inventoryApi.update(input!.id, draft);
        useToastStore.getState().add({
          title: 'Input updated',
          description: `"${draft.name}" has been saved.`,
        });
      } else {
        await inventoryApi.create(draft);
        useToastStore.getState().add({
          title: 'Input added',
          description: `"${draft.name}" is on the stock list.`,
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
          <DialogTitle>{isEdit ? 'Edit input' : 'Add an input'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the details for this stock item.'
              : 'Track seeds, fertilizer, fuel and other farm inputs per farm.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <FormField id="input-farm" label="Farm" required>
            <Select value={farmId} onValueChange={setFarmId}>
              <SelectTrigger id="input-farm">
                <SelectValue placeholder="Choose a farm" />
              </SelectTrigger>
              <SelectContent>
                {farmsQuery.data?.items.map((farm) => (
                  <SelectItem key={farm.id} value={farm.id}>
                    {farm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="input-name" label="Name" required>
              <Input
                id="input-name"
                placeholder="e.g. NPK 20-10-10"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>
            <FormField id="input-type" label="Type">
              <Select value={type} onValueChange={(value) => setType(value as InputType)}>
                <SelectTrigger id="input-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INPUT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="input-unit" label="Unit" required hint="kg, litres, bags…">
              <Input
                id="input-unit"
                placeholder="e.g. kg"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
              />
            </FormField>
            <FormField id="input-quantity" label="Quantity" hint="Initial stock on hand">
              <Input
                id="input-quantity"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                placeholder="0"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="input-threshold" label="Low stock alert" hint="Alert when at or below">
              <Input
                id="input-threshold"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                placeholder="0"
                value={lowStockThreshold}
                onChange={(event) => setLowStockThreshold(event.target.value)}
              />
            </FormField>
            <FormField id="input-cost" label="Unit cost (₦)">
              <Input
                id="input-cost"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                placeholder="0"
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
              />
            </FormField>
          </div>

          <FormField id="input-supplier" label="Supplier">
            <Input
              id="input-supplier"
              placeholder="Where you buy this input"
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
            />
          </FormField>

          <FormField id="input-notes" label="Notes" hint="Anything the team should know.">
            <Textarea
              id="input-notes"
              rows={3}
              placeholder="Application rates, batch numbers…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {isEdit ? 'Save changes' : 'Add input'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}