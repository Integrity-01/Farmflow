import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { farmsApi } from '@/services/farms';
import { financeApi } from '@/services/finance';
import { useToastStore } from '@/store/toast.store';
import type { Farm } from '@/types';
import type { ChemicalProduct, ChemicalUsageInput } from '@/types/finance';
import { formatNumber, today } from './labels';

interface ChemicalUsageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ChemicalProduct[];
  farms: Farm[];
  initialProductId?: string;
  initialFarmId?: string;
  onSaved?: () => void;
}

const ALLOWED_UNITS: Record<string, string[]> = {
  litre: ['litre', 'ml'],
  ml: ['ml', 'litre'],
  kg: ['kg', 'g'],
  g: ['g', 'kg'],
};

export function ChemicalUsageDialog({
  open,
  onOpenChange,
  products,
  farms,
  initialProductId,
  initialFarmId,
  onSaved,
}: ChemicalUsageDialogProps) {
  const [productId, setProductId] = useState('');
  const [farmId, setFarmId] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [usageDate, setUsageDate] = useState(today());
  const [quantityUsed, setQuantityUsed] = useState('');
  const [unit, setUnit] = useState('');
  const [areaTreated, setAreaTreated] = useState('');
  const [areaUnit, setAreaUnit] = useState('hectares');
  const [applicationMethod, setApplicationMethod] = useState('');
  const [appliedBy, setAppliedBy] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [purpose, setPurpose] = useState('');
  const [weatherConditions, setWeatherConditions] = useState('');
  const [crop, setCrop] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => products.find((product) => product.id === productId) ?? null,
    [products, productId],
  );

  useEffect(() => {
    if (!open) return;
    const first = initialProductId ?? '';
    setProductId(first);
    setFarmId(initialFarmId ?? '');
    setFieldId('');
    setUsageDate(today());
    setQuantityUsed('');
    const product = products.find((item) => item.id === first);
    setUnit(product?.unit ?? 'litre');
    setAreaTreated('');
    setAreaUnit('hectares');
    setApplicationMethod('');
    setAppliedBy('');
    setSupervisor('');
    setPurpose('');
    setWeatherConditions('');
    setCrop('');
    setNotes('');
    setError(null);
    setSaving(false);
  }, [open, initialProductId, initialFarmId, products]);

  const farmQuery = useQuery({
    queryKey: ['finance-farm', farmId],
    queryFn: () => farmsApi.get(farmId),
    enabled: open && Boolean(farmId),
    retry: 0,
  });

  const unitOptions = selected ? ALLOWED_UNITS[selected.unit] ?? [selected.unit] : [unit || 'litre'];
  const quantity = Number(quantityUsed || 0);
  const factor =
    selected && unit !== selected.unit
      ? unit === 'ml' && selected.unit === 'litre'
        ? 0.001
        : unit === 'litre' && selected.unit === 'ml'
          ? 1000
          : unit === 'g' && selected.unit === 'kg'
            ? 0.001
            : unit === 'kg' && selected.unit === 'g'
              ? 1000
              : 1
      : 1;
  const deducted = quantity * factor;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!productId) {
      setError('Choose the chemical used.');
      return;
    }
    if (!farmId) {
      setError('Choose the farm where it was used.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Enter the quantity used.');
      return;
    }
    if (selected && deducted > selected.availableStock + 0.0001) {
      setError(`Only ${formatNumber(selected.availableStock)} ${selected.unit} is available.`);
      return;
    }

    const input: ChemicalUsageInput = {
      productId,
      farmId,
      fieldId: fieldId || null,
      usageDate,
      quantityUsed: quantity,
      unit,
      areaTreated: areaTreated.trim() === '' ? null : Number(areaTreated),
      areaUnit: areaTreated.trim() === '' ? null : areaUnit,
      applicationMethod: applicationMethod.trim() || null,
      appliedBy: appliedBy.trim() || null,
      supervisor: supervisor.trim() || null,
      purpose: purpose.trim() || null,
      weatherConditions: weatherConditions.trim() || null,
      crop: crop.trim() || null,
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      await financeApi.chemicals.recordUsage(input);
      useToastStore.getState().add({
        title: 'Chemical usage recorded',
        description: 'Stock has been deducted from the batch.',
      });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the usage.');
    } finally {
      setSaving(false);
    }
  }

  const fields = farmQuery.data?.fields ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record chemical usage</DialogTitle>
          <DialogDescription>
            Usage is deducted from the selected batch and linked to the farm for costing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <FormField
            id="usage-product"
            label="Chemical batch"
            required
            hint={selected ? `${formatNumber(selected.availableStock)} ${selected.unit} available` : undefined}
          >
            <Select
              value={productId}
              onValueChange={(value) => {
                setProductId(value);
                const product = products.find((item) => item.id === value);
                setUnit(product?.unit ?? 'litre');
              }}
            >
              <SelectTrigger id="usage-product">
                <SelectValue placeholder="Choose a chemical" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                    {product.batchNumber ? ` · ${product.batchNumber}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField id="usage-farm" label="Farm" required>
              <Select
                value={farmId}
                onValueChange={(value) => {
                  setFarmId(value);
                  setFieldId('');
                }}
              >
                <SelectTrigger id="usage-farm">
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
            <FormField id="usage-field" label="Field">
              <Select value={fieldId || 'none'} onValueChange={(value) => setFieldId(value === 'none' ? '' : value)}>
                <SelectTrigger id="usage-field" disabled={!farmId}>
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
            <FormField id="usage-date" label="Date used" required>
              <Input
                id="usage-date"
                type="date"
                value={usageDate}
                onChange={(event) => setUsageDate(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField id="usage-quantity" label="Quantity used" required>
              <Input
                id="usage-quantity"
                type="number"
                min={0}
                step="any"
                value={quantityUsed}
                onChange={(event) => setQuantityUsed(event.target.value)}
              />
            </FormField>
            <FormField id="usage-unit" label="Unit" required>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger id="usage-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="usage-area" label="Area treated">
              <Input
                id="usage-area"
                type="number"
                min={0}
                step="any"
                value={areaTreated}
                onChange={(event) => setAreaTreated(event.target.value)}
              />
            </FormField>
            <FormField id="usage-area-unit" label="Area unit">
              <Select value={areaUnit} onValueChange={setAreaUnit}>
                <SelectTrigger id="usage-area-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hectares">hectares</SelectItem>
                  <SelectItem value="acres">acres</SelectItem>
                  <SelectItem value="m2">m²</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {selected && quantity > 0 && unit !== selected.unit ? (
            <p className="text-xs text-slate-500">
              This will deduct {formatNumber(deducted, 3)} {selected.unit} from stock.
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="usage-crop" label="Crop">
              <Input id="usage-crop" value={crop} onChange={(event) => setCrop(event.target.value)} />
            </FormField>
            <FormField id="usage-method" label="Application method">
              <Input
                id="usage-method"
                placeholder="Spray, drench…"
                value={applicationMethod}
                onChange={(event) => setApplicationMethod(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="usage-applied-by" label="Applied by">
              <Input
                id="usage-applied-by"
                value={appliedBy}
                onChange={(event) => setAppliedBy(event.target.value)}
              />
            </FormField>
            <FormField id="usage-supervisor" label="Supervisor">
              <Input
                id="usage-supervisor"
                value={supervisor}
                onChange={(event) => setSupervisor(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="usage-purpose" label="Purpose">
              <Input
                id="usage-purpose"
                placeholder="e.g. Weed control on maize plot"
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
              />
            </FormField>
            <FormField id="usage-weather" label="Weather conditions">
              <Input
                id="usage-weather"
                value={weatherConditions}
                onChange={(event) => setWeatherConditions(event.target.value)}
              />
            </FormField>
          </div>

          <FormField id="usage-notes" label="Notes">
            <Textarea
              id="usage-notes"
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
              {saving ? 'Saving…' : 'Record usage'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
