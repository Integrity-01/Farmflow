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
import { Textarea } from '@/components/ui/Textarea';
import { ApiError } from '@/services/api';
import { financeApi } from '@/services/finance';
import { useToastStore } from '@/store/toast.store';
import type { Farm } from '@/types';
import type { BudgetInput, FarmBudget } from '@/types/finance';
import { today } from './labels';

interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget?: FarmBudget | null;
  farms: Farm[];
  onSaved?: () => void;
}

export function BudgetDialog({ open, onOpenChange, budget, farms, onSaved }: BudgetDialogProps) {
  const [farmId, setFarmId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFarmId(budget?.farmId ?? '');
    setPeriodStart(budget?.periodStart ?? '');
    setPeriodEnd(budget?.periodEnd ?? today());
    setAmount(budget ? String(budget.amount) : '');
    setNotes(budget?.notes ?? '');
    setError(null);
    setSaving(false);
  }, [open, budget]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!farmId) {
      setError('Choose a farm for this budget.');
      return;
    }
    if (!periodStart || !periodEnd) {
      setError('Choose the budget period.');
      return;
    }
    if (periodEnd < periodStart) {
      setError('The end date must be on or after the start date.');
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) {
      setError('Enter a valid budget amount.');
      return;
    }

    const input: BudgetInput = {
      farmId,
      periodStart,
      periodEnd,
      amount: value,
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      await financeApi.financial.upsertBudget(input);
      useToastStore.getState().add({ title: 'Budget saved' });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the budget.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{budget ? 'Update budget' : 'Set a farm budget'}</DialogTitle>
          <DialogDescription>
            Budgets are matched to expenses in the same period for variance and utilisation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <FormField id="budget-farm" label="Farm" required>
            <Select value={farmId} onValueChange={setFarmId}>
              <SelectTrigger id="budget-farm">
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

          <div className="grid grid-cols-2 gap-3">
            <FormField id="budget-start" label="Period start" required>
              <Input
                id="budget-start"
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
              />
            </FormField>
            <FormField id="budget-end" label="Period end" required>
              <Input
                id="budget-end"
                type="date"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
              />
            </FormField>
          </div>

          <FormField id="budget-amount" label="Budget amount" required>
            <Input
              id="budget-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </FormField>

          <FormField id="budget-notes" label="Notes">
            <Textarea
              id="budget-notes"
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save budget'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
