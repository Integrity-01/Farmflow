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
  EngagementInput,
  ExternalLabourer,
  LabourEngagement,
} from '@/types/finance';
import { formatMoney, today } from './labels';

const PRICING_OPTIONS = [
  { value: 'fixed', label: 'Fixed price' },
  { value: 'daily', label: 'Per day' },
  { value: 'per_area', label: 'Per area' },
  { value: 'per_unit', label: 'Per unit' },
  { value: 'other', label: 'Other' },
] as const;

type PricingMethod = (typeof PRICING_OPTIONS)[number]['value'];

interface EngagementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagement?: LabourEngagement | null;
  labourers: ExternalLabourer[];
  farms: Farm[];
  onSaved?: () => void;
}

export function EngagementFormDialog({
  open,
  onOpenChange,
  engagement,
  labourers,
  farms,
  onSaved,
}: EngagementFormDialogProps) {
  const isEdit = Boolean(engagement);
  const [labourerId, setLabourerId] = useState('');
  const [farmId, setFarmId] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [workType, setWorkType] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [completionDate, setCompletionDate] = useState('');
  const [workerCount, setWorkerCount] = useState('1');
  const [quantityCompleted, setQuantityCompleted] = useState('');
  const [unitOfWork, setUnitOfWork] = useState('');
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>('fixed');
  const [agreedRate, setAgreedRate] = useState('');
  const [agreedTotal, setAgreedTotal] = useState('');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submit, setSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabourerId(engagement?.labourerId ?? '');
    setFarmId(engagement?.farmId ?? '');
    setFieldId(engagement?.fieldId ?? '');
    setWorkType(engagement?.workType ?? '');
    setDescription(engagement?.description ?? '');
    setStartDate(engagement?.startDate ?? today());
    setCompletionDate(engagement?.completionDate ?? '');
    setWorkerCount(engagement?.workerCount ? String(engagement.workerCount) : '1');
    setQuantityCompleted(
      engagement?.quantityCompleted ? String(engagement.quantityCompleted) : '',
    );
    setUnitOfWork(engagement?.unitOfWork ?? '');
    setPricingMethod(engagement?.pricingMethod ?? 'fixed');
    setAgreedRate(engagement?.agreedRate ? String(engagement.agreedRate) : '');
    setAgreedTotal(engagement ? String(engagement.agreedTotal) : '');
    setInvoiceUrl(engagement?.invoiceUrl ?? '');
    setNotes(engagement?.notes ?? '');
    setSubmit(false);
    setError(null);
    setSaving(false);
  }, [open, engagement]);

  const farmQuery = useQuery({
    queryKey: ['finance-farm', farmId],
    queryFn: () => farmsApi.get(farmId),
    enabled: open && Boolean(farmId),
    retry: 0,
  });

  const rate = Number(agreedRate || 0);
  const workers = Number(workerCount || 1);
  const quantity = Number(quantityCompleted || 0);
  const days =
    startDate && completionDate
      ? Math.max(
          1,
          Math.round(
            (new Date(`${completionDate}T00:00:00`).getTime() -
              new Date(`${startDate}T00:00:00`).getTime()) /
              86_400_000,
          ) + 1,
        )
      : 1;
  const suggested =
    pricingMethod === 'daily'
      ? rate * workers * days
      : pricingMethod === 'per_area' || pricingMethod === 'per_unit'
        ? rate * quantity
        : rate;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!labourerId) {
      setError('Choose the labourer or contractor.');
      return;
    }
    if (!farmId) {
      setError('Choose the farm this work belongs to.');
      return;
    }
    if (workType.trim().length < 2) {
      setError('Describe the type of work.');
      return;
    }
    if (rate <= 0 && agreedTotal.trim() === '') {
      setError('Enter the agreed total or a rate.');
      return;
    }

    const input: EngagementInput = {
      labourerId,
      farmId,
      fieldId: fieldId || null,
      workType: workType.trim(),
      description: description.trim() || null,
      startDate: startDate || null,
      completionDate: completionDate || null,
      workerCount: Number.isFinite(workers) && workers > 0 ? workers : null,
      quantityCompleted: quantityCompleted.trim() === '' ? null : quantity,
      unitOfWork: unitOfWork.trim() || null,
      pricingMethod,
      agreedRate: rate > 0 ? rate : null,
      agreedTotal: agreedTotal.trim() === '' ? undefined : Number(agreedTotal),
      invoiceUrl: invoiceUrl.trim() || null,
      notes: notes.trim() || null,
      submit,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await financeApi.labour.updateEngagement(engagement!.id, input);
        useToastStore.getState().add({
          title: 'Engagement updated',
          description: submit ? 'It was sent for approval.' : 'Your changes were saved.',
        });
      } else {
        await financeApi.labour.createEngagement(input);
        useToastStore.getState().add({
          title: submit ? 'Engagement submitted' : 'Engagement saved',
          description: submit ? 'It is now waiting for approval.' : 'It is saved as a draft.',
        });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the engagement.');
    } finally {
      setSaving(false);
    }
  }

  const fields = farmQuery.data?.fields ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit labour engagement' : 'Record labour engagement'}</DialogTitle>
          <DialogDescription>
            Track agreed work and pay separately — approval does not mean payment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="engagement-labourer" label="Labourer / contractor" required>
              <Select value={labourerId} onValueChange={setLabourerId}>
                <SelectTrigger id="engagement-labourer">
                  <SelectValue placeholder="Choose a labourer" />
                </SelectTrigger>
                <SelectContent>
                  {labourers.map((labourer) => (
                    <SelectItem key={labourer.id} value={labourer.id}>
                      {labourer.name}
                      {labourer.businessName ? ` · ${labourer.businessName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="engagement-work-type" label="Work type" required>
              <Input
                id="engagement-work-type"
                placeholder="e.g. Weeding, harvesting"
                value={workType}
                onChange={(event) => setWorkType(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="engagement-farm" label="Farm" required>
              <Select
                value={farmId}
                onValueChange={(value) => {
                  setFarmId(value);
                  setFieldId('');
                }}
              >
                <SelectTrigger id="engagement-farm">
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
            <FormField id="engagement-field" label="Field">
              <Select value={fieldId || 'none'} onValueChange={(value) => setFieldId(value === 'none' ? '' : value)}>
                <SelectTrigger id="engagement-field" disabled={!farmId}>
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

          <FormField id="engagement-description" label="Description">
            <Textarea
              id="engagement-description"
              rows={2}
              maxLength={4000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField id="engagement-start" label="Start date">
              <Input
                id="engagement-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </FormField>
            <FormField id="engagement-completion" label="Completion date">
              <Input
                id="engagement-completion"
                type="date"
                value={completionDate}
                onChange={(event) => setCompletionDate(event.target.value)}
              />
            </FormField>
            <FormField id="engagement-workers" label="Workers">
              <Input
                id="engagement-workers"
                type="number"
                min={1}
                step={1}
                value={workerCount}
                onChange={(event) => setWorkerCount(event.target.value)}
              />
            </FormField>
            <FormField id="engagement-pricing" label="Pricing method">
              <Select
                value={pricingMethod}
                onValueChange={(value) => setPricingMethod(value as PricingMethod)}
              >
                <SelectTrigger id="engagement-pricing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField id="engagement-rate" label="Agreed rate">
              <Input
                id="engagement-rate"
                type="number"
                min={0}
                step="0.01"
                value={agreedRate}
                onChange={(event) => setAgreedRate(event.target.value)}
              />
            </FormField>
            <FormField id="engagement-quantity" label="Quantity done">
              <Input
                id="engagement-quantity"
                type="number"
                min={0}
                step="any"
                value={quantityCompleted}
                onChange={(event) => setQuantityCompleted(event.target.value)}
              />
            </FormField>
            <FormField id="engagement-unit" label="Unit of work">
              <Input
                id="engagement-unit"
                placeholder="acres, bags…"
                value={unitOfWork}
                onChange={(event) => setUnitOfWork(event.target.value)}
              />
            </FormField>
            <FormField
              id="engagement-total"
              label="Agreed total"
              hint={suggested > 0 ? `Suggested ${formatMoney(suggested)}` : undefined}
            >
              <Input
                id="engagement-total"
                type="number"
                min={0}
                step="0.01"
                placeholder={suggested > 0 ? String(suggested) : 'Optional'}
                value={agreedTotal}
                onChange={(event) => setAgreedTotal(event.target.value)}
              />
            </FormField>
          </div>

          <FormField id="engagement-invoice" label="Invoice / agreement link">
            <Input
              id="engagement-invoice"
              placeholder="https://…"
              value={invoiceUrl}
              onChange={(event) => setInvoiceUrl(event.target.value)}
            />
          </FormField>

          <FormField id="engagement-notes" label="Notes">
            <Textarea
              id="engagement-notes"
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
                Approved engagements can receive payments and appear in cost reports.
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
