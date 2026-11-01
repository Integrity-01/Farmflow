import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ApiError } from '@/services/api';
import { farmsApi } from '@/services/farms';
import { financeApi } from '@/services/finance';
import { useToastStore } from '@/store/toast.store';
import type { Farm } from '@/types';
import type {
  ChemicalMovementInput,
  ChemicalMovementType,
  ChemicalProduct,
} from '@/types/finance';

const MOVEMENT_TYPES: Array<{ value: ChemicalMovementType; label: string }> = [
  { value: 'purchase', label: 'Purchase (add stock)' },
  { value: 'issue', label: 'Issue to farm / store' },
  { value: 'return', label: 'Return to store' },
  { value: 'adjustment', label: 'Adjustment (increase or decrease)' },
  { value: 'expired', label: 'Expired (remove stock)' },
  { value: 'damaged', label: 'Damaged (remove stock)' },
];

interface ChemicalMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ChemicalProduct | null;
  farms: Farm[];
  onSaved?: () => void;
}

export function ChemicalMovementDialog({
  open,
  onOpenChange,
  product,
  farms,
  onSaved,
}: ChemicalMovementDialogProps) {
  const [type, setType] = useState<ChemicalMovementType>('purchase');
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [farmId, setFarmId] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [recordExpense, setRecordExpense] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType('purchase');
    setDirection('increase');
    setQuantity('');
    setUnitCost(product ? String(product.unitCost) : '');
    setFarmId('');
    setFieldId('');
    setStorageLocation(product?.storageLocation ?? '');
    setReference('');
    setNote('');
    setRecordExpense(true);
    setError(null);
    setSaving(false);
  }, [open, product]);

  const farmQuery = useQuery({
    queryKey: ['finance-farm', farmId],
    queryFn: () => farmsApi.get(farmId),
    enabled: open && Boolean(farmId),
    retry: 0,
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const value = Number(quantity);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a quantity greater than zero.');
      return;
    }

    const input: ChemicalMovementInput = {
      type,
      direction: type === 'adjustment' ? direction : undefined,
      quantity: value,
      unitCost: unitCost.trim() === '' ? null : Number(unitCost),
      farmId: farmId || null,
      fieldId: fieldId || null,
      storageLocation: storageLocation.trim() || null,
      reference: reference.trim() || null,
      note: note.trim() || null,
      recordExpense: type === 'purchase' && recordExpense && Boolean(farmId) && Number(unitCost) > 0,
    };

    setSaving(true);
    try {
      await financeApi.chemicals.addMovement(product!.id, input);
      useToastStore.getState().add({
        title: 'Stock movement recorded',
        description: `${product!.name} stock has been updated.`,
      });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the movement.');
    } finally {
      setSaving(false);
    }
  }

  const fields = farmQuery.data?.fields ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {product
              ? `${product.name} · ${product.availableStock} ${product.unit} available`
              : 'Record a stock movement.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className={type === 'adjustment' ? 'grid grid-cols-2 gap-3' : ''}>
            <FormField id="movement-type" label="Movement" required>
              <Select value={type} onValueChange={(value) => setType(value as ChemicalMovementType)}>
                <SelectTrigger id="movement-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOVEMENT_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {type === 'adjustment' ? (
              <FormField id="movement-direction" label="Direction" required>
                <Select value={direction} onValueChange={(value) => setDirection(value as 'increase' | 'decrease')}>
                  <SelectTrigger id="movement-direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">Increase stock</SelectItem>
                    <SelectItem value="decrease">Decrease stock</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="movement-quantity" label={`Quantity (${product?.unit ?? 'unit'})`} required>
              <Input
                id="movement-quantity"
                type="number"
                min={0}
                step="any"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </FormField>
            <FormField id="movement-cost" label="Unit cost">
              <Input
                id="movement-cost"
                type="number"
                min={0}
                step="0.01"
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="movement-farm" label="Farm">
              <Select
                value={farmId || 'none'}
                onValueChange={(value) => {
                  setFarmId(value === 'none' ? '' : value);
                  setFieldId('');
                }}
              >
                <SelectTrigger id="movement-farm">
                  <SelectValue placeholder="No farm" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No farm</SelectItem>
                  {farms.map((farm) => (
                    <SelectItem key={farm.id} value={farm.id}>
                      {farm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="movement-field" label="Field">
              <Select value={fieldId || 'none'} onValueChange={(value) => setFieldId(value === 'none' ? '' : value)}>
                <SelectTrigger id="movement-field" disabled={!farmId}>
                  <SelectValue placeholder="No field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No field</SelectItem>
                  {fields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="movement-storage" label="Storage location">
              <Input
                id="movement-storage"
                value={storageLocation}
                onChange={(event) => setStorageLocation(event.target.value)}
              />
            </FormField>
            <FormField id="movement-reference" label="Reference">
              <Input
                id="movement-reference"
                placeholder="Invoice, issue note…"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </FormField>
          </div>

          <FormField id="movement-note" label="Note">
            <Textarea
              id="movement-note"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </FormField>

          {type === 'purchase' && Number(unitCost) > 0 && farmId ? (
            <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
              <Checkbox
                checked={recordExpense}
                onCheckedChange={(checked) => setRecordExpense(checked === true)}
                className="mt-0.5"
              />
              <span className="font-medium text-slate-900">Record this purchase as an expense</span>
            </label>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Record movement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
