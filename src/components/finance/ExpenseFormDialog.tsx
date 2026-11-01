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
import type { ExpenseCategory, ExpenseInput, ExpenseRecord } from '@/types/finance';
import { formatMoney, today } from './labels';

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseRecord | null;
  categories: ExpenseCategory[];
  farms: Farm[];
  onSaved?: () => void;
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  categories,
  farms,
  onSaved,
}: ExpenseFormDialogProps) {
  const isEdit = Boolean(expense);
  const [farmId, setFarmId] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [expenseDate, setExpenseDate] = useState(today());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submit, setSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFarmId(expense?.farmId ?? '');
    setFieldId(expense?.fieldId ?? '');
    setCategoryId(expense?.categoryId ?? '');
    setExpenseDate(expense?.expenseDate ?? today());
    setDescription(expense?.description ?? '');
    setAmount(expense?.amount !== undefined ? String(expense.amount) : '');
    setQuantity(expense?.quantity !== null && expense?.quantity !== undefined ? String(expense.quantity) : '');
    setUnit(expense?.unit ?? '');
    setUnitPrice(
      expense?.unitPrice !== null && expense?.unitPrice !== undefined
        ? String(expense.unitPrice)
        : '',
    );
    setSupplier(expense?.supplier ?? '');
    setPaymentMethod(expense?.paymentMethod ?? '');
    setPaymentReference(expense?.paymentReference ?? '');
    setNotes(expense?.notes ?? '');
    setSubmit(false);
    setError(null);
    setSaving(false);
  }, [open, expense]);

  const farmQuery = useQuery({
    queryKey: ['finance-farm', farmId],
    queryFn: () => farmsApi.get(farmId),
    enabled: open && Boolean(farmId),
    retry: 0,
  });

  const computedAmount =
    amount.trim() !== ''
      ? Number(amount)
      : quantity.trim() !== '' && unitPrice.trim() !== ''
        ? Number(quantity) * Number(unitPrice)
        : 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!farmId) {
      setError('Please choose the farm this expense belongs to.');
      return;
    }
    if (!categoryId) {
      setError('Please choose a category.');
      return;
    }
    if (description.trim().length < 2) {
      setError('Please describe the expense.');
      return;
    }
    if (!Number.isFinite(computedAmount) || computedAmount <= 0) {
      setError('Enter an amount, or a quantity and unit price.');
      return;
    }

    const input: ExpenseInput = {
      farmId,
      fieldId: fieldId || null,
      categoryId,
      expenseDate,
      description: description.trim(),
      quantity: quantity.trim() === '' ? null : Number(quantity),
      unit: unit.trim() || null,
      unitPrice: unitPrice.trim() === '' ? null : Number(unitPrice),
      amount: Math.round(computedAmount * 100) / 100,
      supplier: supplier.trim() || null,
      paymentMethod: paymentMethod.trim() || null,
      paymentReference: paymentReference.trim() || null,
      notes: notes.trim() || null,
      submit,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await financeApi.expenses.update(expense!.id, input);
        useToastStore.getState().add({
          title: 'Expense updated',
          description: submit ? 'The expense was sent for approval.' : 'Your changes were saved.',
        });
      } else {
        await financeApi.expenses.create(input);
        useToastStore.getState().add({
          title: submit ? 'Expense submitted' : 'Expense saved',
          description: submit
            ? 'It is now waiting for approval.'
            : 'It is saved as a draft until you submit it.',
        });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the expense.');
    } finally {
      setSaving(false);
    }
  }

  const fields = farmQuery.data?.fields ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit expense' : 'Record an expense'}</DialogTitle>
          <DialogDescription>
            Tag the cost to a farm, field and category so reports stay accurate.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="expense-farm" label="Farm" required>
              <Select
                value={farmId}
                onValueChange={(value) => {
                  setFarmId(value);
                  setFieldId('');
                }}
              >
                <SelectTrigger id="expense-farm">
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
            <FormField id="expense-field" label="Field" hint="Optional">
              <Select value={fieldId || 'none'} onValueChange={(value) => setFieldId(value === 'none' ? '' : value)}>
                <SelectTrigger id="expense-field" disabled={!farmId}>
                  <SelectValue placeholder="No specific field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific field</SelectItem>
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
            <FormField id="expense-category" label="Category" required>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="expense-category">
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
            <FormField id="expense-date" label="Date" required>
              <Input
                id="expense-date"
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
              />
            </FormField>
          </div>

          <FormField id="expense-description" label="Description" required>
            <Input
              id="expense-description"
              placeholder="e.g. Diesel for irrigation pump"
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField id="expense-quantity" label="Quantity" hint="Optional">
              <Input
                id="expense-quantity"
                type="number"
                min={0}
                step="any"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </FormField>
            <FormField id="expense-unit" label="Unit">
              <Input
                id="expense-unit"
                placeholder="litres, bags…"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
              />
            </FormField>
            <FormField id="expense-unit-price" label="Unit price">
              <Input
                id="expense-unit-price"
                type="number"
                min={0}
                step="0.01"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
              />
            </FormField>
            <FormField id="expense-amount" label="Amount" hint={formatMoney(computedAmount)}>
              <Input
                id="expense-amount"
                type="number"
                min={0}
                step="0.01"
                placeholder="Auto from quantity"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="expense-supplier" label="Supplier / payee">
              <Input
                id="expense-supplier"
                value={supplier}
                onChange={(event) => setSupplier(event.target.value)}
              />
            </FormField>
            <FormField id="expense-payment-method" label="Payment method">
              <Input
                id="expense-payment-method"
                placeholder="Cash, transfer…"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              />
            </FormField>
          </div>

          <FormField id="expense-reference" label="Payment reference">
            <Input
              id="expense-reference"
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
            />
          </FormField>

          <FormField id="expense-notes" label="Notes">
            <Textarea
              id="expense-notes"
              rows={2}
              maxLength={4000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>

          <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
            <Checkbox
              checked={submit}
              onCheckedChange={(checked) => setSubmit(checked === true)}
              className="mt-0.5"
            />
            <span>
              <span className="block font-medium text-slate-900">Send for approval now</span>
              <span className="block text-xs text-slate-500">
                Leave unticked to keep this as a draft. Approved expenses count towards reports.
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : submit ? 'Record & submit' : 'Save draft'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
