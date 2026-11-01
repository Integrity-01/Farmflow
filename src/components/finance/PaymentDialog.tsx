import { useEffect, useState, type FormEvent } from 'react';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
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
import { ApiError } from '@/services/api';
import type { PaymentInput } from '@/types/finance';
import { formatMoney, paymentMethodOptions, today } from './labels';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  outstanding: number;
  onSubmit: (input: PaymentInput) => Promise<void>;
}

export function PaymentDialog({
  open,
  onOpenChange,
  title,
  description,
  outstanding,
  onSubmit,
}: PaymentDialogProps) {
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(today());
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(outstanding > 0 ? String(outstanding) : '');
    setPaidOn(today());
    setMethod('Cash');
    setReference('');
    setNotes('');
    setError(null);
    setSaving(false);
  }, [open, outstanding]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (value > outstanding + 0.005) {
      setError(`The amount cannot exceed the outstanding balance of ${formatMoney(outstanding)}.`);
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        amount: value,
        paidOn,
        method: method.trim() || null,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the payment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? `Outstanding balance: ${formatMoney(outstanding)}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <FormField id="payment-amount" label="Amount" required>
              <Input
                id="payment-amount"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </FormField>
            <FormField id="payment-date" label="Paid on" required>
              <Input
                id="payment-date"
                type="date"
                value={paidOn}
                onChange={(event) => setPaidOn(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="payment-method" label="Method">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethodOptions().map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="payment-reference" label="Reference">
              <Input
                id="payment-reference"
                placeholder="Receipt or transfer ref"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </FormField>
          </div>

          <FormField id="payment-notes" label="Notes">
            <Input
              id="payment-notes"
              placeholder="Optional"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Record payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
