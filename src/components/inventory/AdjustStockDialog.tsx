import { useEffect, useState, type FormEvent } from 'react';
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
import { inventoryApi } from '@/services/inventory';
import { useToastStore } from '@/store/toast.store';
import type { InventoryItem } from '@/types';
import { formatQuantity } from './labels';

const DIRECTION_OPTIONS = [
  { value: 'received', label: 'Stock received' },
  { value: 'used', label: 'Stock used' },
];

interface AdjustStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input: InventoryItem | null;
}

export function AdjustStockDialog({ open, onOpenChange, input }: AdjustStockDialogProps) {
  const [direction, setDirection] = useState<'received' | 'used'>('received');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setDirection('received');
    setAmount('');
    setNote('');
  }, [open, input]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!input) return;
    setError(null);

    const value = Number(amount);
    if (amount.trim() === '' || !Number.isFinite(value) || value <= 0) {
      setError('Please enter a quantity greater than zero.');
      return;
    }

    const change = direction === 'received' ? value : -value;

    setSaving(true);
    try {
      await inventoryApi.adjust(input.id, { change, note: note.trim() || undefined });
      useToastStore.getState().add({
        title: direction === 'received' ? 'Stock received' : 'Stock used',
        description: `${formatQuantity(String(change), input.unit)} logged for "${input.name}".`,
      });
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
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {input
              ? `"${input.name}" — ${formatQuantity(input.quantity, input.unit)} on hand.`
              : 'Record stock coming in or going out.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <FormField id="adjust-direction" label="Direction">
            <Select value={direction} onValueChange={(value) => setDirection(value as 'received' | 'used')}>
              <SelectTrigger id="adjust-direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIRECTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField id="adjust-amount" label="Amount" required>
            <Input
              id="adjust-amount"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </FormField>

          <FormField id="adjust-note" label="Note" hint="What was this for?">
            <Input
              id="adjust-note"
              placeholder="e.g. Q3 restock, fertilized field A"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}