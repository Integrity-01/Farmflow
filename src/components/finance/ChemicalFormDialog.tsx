import { useEffect, useState, type FormEvent } from 'react';
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
import { financeApi } from '@/services/finance';
import { useToastStore } from '@/store/toast.store';
import type { Farm } from '@/types';
import type { ChemicalInput, ChemicalProduct } from '@/types/finance';
import { today } from './labels';

const UNITS = ['litre', 'ml', 'kg', 'g', 'sachet', 'bottle', 'pack', 'bag'];

interface ChemicalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ChemicalProduct | null;
  farms: Farm[];
  onSaved?: () => void;
}

export function ChemicalFormDialog({
  open,
  onOpenChange,
  product,
  farms,
  onSaved,
}: ChemicalFormDialogProps) {
  const isEdit = Boolean(product);
  const [farmId, setFarmId] = useState('');
  const [name, setName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [formulation, setFormulation] = useState('');
  const [intendedUse, setIntendedUse] = useState('');
  const [supplier, setSupplier] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [expiryDate, setExpiryDate] = useState('');
  const [quantityReceived, setQuantityReceived] = useState('0');
  const [unit, setUnit] = useState('litre');
  const [purchaseCost, setPurchaseCost] = useState('0');
  const [storageLocation, setStorageLocation] = useState('');
  const [minimumStock, setMinimumStock] = useState('0');
  const [safetyInstructions, setSafetyInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [recordExpense, setRecordExpense] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFarmId('');
    setName(product?.name ?? '');
    setActiveIngredient(product?.activeIngredient ?? '');
    setFormulation(product?.formulation ?? '');
    setIntendedUse(product?.intendedUse ?? '');
    setSupplier(product?.supplier ?? '');
    setBatchNumber(product?.batchNumber ?? '');
    setPurchaseDate(product?.purchaseDate ?? today());
    setExpiryDate(product?.expiryDate ?? '');
    setQuantityReceived(product?.quantityReceived ? String(product.quantityReceived) : '0');
    setUnit(product?.unit ?? 'litre');
    setPurchaseCost(product?.purchaseCost ? String(product.purchaseCost) : '0');
    setStorageLocation(product?.storageLocation ?? '');
    setMinimumStock(product ? String(product.minimumStock) : '0');
    setSafetyInstructions(product?.safetyInstructions ?? '');
    setNotes(product?.notes ?? '');
    setRecordExpense(true);
    setError(null);
    setSaving(false);
  }, [open, product]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError('Please enter the product name.');
      return;
    }
    const cost = Number(purchaseCost || 0);
    const received = Number(quantityReceived || 0);
    if (!isEdit && cost > 0 && received <= 0) {
      setError('Enter the quantity received for a purchased chemical.');
      return;
    }
    if (!isEdit && recordExpense && cost > 0 && !farmId) {
      setError('Choose the farm this purchase should be charged to.');
      return;
    }

    const input: ChemicalInput = {
      name: name.trim(),
      activeIngredient: activeIngredient.trim() || null,
      formulation: formulation.trim() || null,
      intendedUse: intendedUse.trim() || null,
      supplier: supplier.trim() || null,
      batchNumber: batchNumber.trim() || null,
      purchaseDate: purchaseDate || null,
      expiryDate: expiryDate || null,
      unit: unit.trim() || 'litre',
      purchaseCost: cost,
      storageLocation: storageLocation.trim() || null,
      minimumStock: Number(minimumStock || 0),
      safetyInstructions: safetyInstructions.trim() || null,
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await financeApi.chemicals.update(product!.id, input);
        useToastStore.getState().add({ title: 'Chemical updated' });
      } else {
        await financeApi.chemicals.create({
          ...input,
          farmId: farmId || null,
          quantityReceived: received,
          recordExpense: recordExpense && cost > 0,
        });
        useToastStore.getState().add({
          title: 'Chemical added',
          description: cost > 0 && recordExpense
            ? 'The purchase was recorded as an expense for approval.'
            : 'Opening stock has been recorded.',
        });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the chemical.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit chemical' : 'Add a chemical'}</DialogTitle>
          <DialogDescription>
            Each batch is tracked separately so usage and expiry stay accurate.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="chemical-name" label="Product name" required>
              <Input
                id="chemical-name"
                placeholder="e.g. Glyphosate 41% SL"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>
            <FormField id="chemical-batch" label="Batch / lot number">
              <Input
                id="chemical-batch"
                value={batchNumber}
                onChange={(event) => setBatchNumber(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField id="chemical-ingredient" label="Active ingredient">
              <Input
                id="chemical-ingredient"
                value={activeIngredient}
                onChange={(event) => setActiveIngredient(event.target.value)}
              />
            </FormField>
            <FormField id="chemical-formulation" label="Formulation">
              <Input
                id="chemical-formulation"
                placeholder="SL, EC, WP…"
                value={formulation}
                onChange={(event) => setFormulation(event.target.value)}
              />
            </FormField>
            <FormField id="chemical-use" label="Intended use">
              <Input
                id="chemical-use"
                placeholder="Herbicide, fungicide…"
                value={intendedUse}
                onChange={(event) => setIntendedUse(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="chemical-supplier" label="Supplier">
              <Input
                id="chemical-supplier"
                value={supplier}
                onChange={(event) => setSupplier(event.target.value)}
              />
            </FormField>
            <FormField id="chemical-storage" label="Storage location">
              <Input
                id="chemical-storage"
                value={storageLocation}
                onChange={(event) => setStorageLocation(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField id="chemical-purchased" label="Purchase date">
              <Input
                id="chemical-purchased"
                type="date"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
              />
            </FormField>
            <FormField id="chemical-expiry" label="Expiry date">
              <Input
                id="chemical-expiry"
                type="date"
                value={expiryDate}
                onChange={(event) => setExpiryDate(event.target.value)}
              />
            </FormField>
            <FormField id="chemical-unit" label="Stock unit" required>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger id="chemical-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="chemical-minimum" label="Minimum stock">
              <Input
                id="chemical-minimum"
                type="number"
                min={0}
                step="any"
                value={minimumStock}
                onChange={(event) => setMinimumStock(event.target.value)}
              />
            </FormField>
          </div>

          {!isEdit ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FormField id="chemical-received" label="Quantity received" hint="In the stock unit">
                  <Input
                    id="chemical-received"
                    type="number"
                    min={0}
                    step="any"
                    value={quantityReceived}
                    onChange={(event) => setQuantityReceived(event.target.value)}
                  />
                </FormField>
                <FormField id="chemical-cost" label="Purchase cost">
                  <Input
                    id="chemical-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    value={purchaseCost}
                    onChange={(event) => setPurchaseCost(event.target.value)}
                  />
                </FormField>
                <FormField id="chemical-farm" label="Charge purchase to farm" hint="Required to record an expense">
                  <Select value={farmId || 'none'} onValueChange={(value) => setFarmId(value === 'none' ? '' : value)}>
                    <SelectTrigger id="chemical-farm">
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
              </div>

              {Number(purchaseCost) > 0 ? (
                <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                  <Checkbox
                    checked={recordExpense}
                    onCheckedChange={(checked) => setRecordExpense(checked === true)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium text-slate-900">Record purchase as an expense</span>
                    <span className="block text-xs text-slate-500">
                      Keeps the purchase in the expense ledger for approvals and cost reports.
                    </span>
                  </span>
                </label>
              ) : null}
            </>
          ) : (
            <FormField id="chemical-cost" label="Purchase cost" hint="Stock levels change through movements only">
              <Input
                id="chemical-cost"
                type="number"
                min={0}
                step="0.01"
                value={purchaseCost}
                onChange={(event) => setPurchaseCost(event.target.value)}
              />
            </FormField>
          )}

          <FormField id="chemical-safety" label="Safety instructions">
            <Textarea
              id="chemical-safety"
              rows={2}
              maxLength={4000}
              placeholder="PPE, storage and handling notes"
              value={safetyInstructions}
              onChange={(event) => setSafetyInstructions(event.target.value)}
            />
          </FormField>

          <FormField id="chemical-notes" label="Notes">
            <Textarea
              id="chemical-notes"
              rows={2}
              maxLength={4000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add chemical'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
