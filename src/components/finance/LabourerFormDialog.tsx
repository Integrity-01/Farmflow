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
import type { ExternalLabourer, LabourerInput } from '@/types/finance';

interface LabourerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labourer?: ExternalLabourer | null;
  onSaved?: () => void;
}

export function LabourerFormDialog({
  open,
  onOpenChange,
  labourer,
  onSaved,
}: LabourerFormDialogProps) {
  const isEdit = Boolean(labourer);
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [labourType, setLabourType] = useState('');
  const [isContractor, setIsContractor] = useState(false);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(labourer?.name ?? '');
    setBusinessName(labourer?.businessName ?? '');
    setPhone(labourer?.phone ?? '');
    setEmail(labourer?.email ?? '');
    setLabourType(labourer?.labourType ?? '');
    setIsContractor(labourer?.isContractor ?? false);
    setStatus(labourer?.status ?? 'active');
    setNotes(labourer?.notes ?? '');
    setError(null);
    setSaving(false);
  }, [open, labourer]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError('Please enter the labourer name.');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }

    const input: LabourerInput = {
      name: name.trim(),
      businessName: businessName.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      labourType: labourType.trim() || null,
      isContractor,
      notes: notes.trim() || null,
      status,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await financeApi.labour.updateLabourer(labourer!.id, input);
        useToastStore.getState().add({ title: 'Labourer updated' });
      } else {
        await financeApi.labour.createLabourer(input);
        useToastStore.getState().add({ title: 'Labourer added' });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the labourer.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit labourer' : 'Add external labourer'}</DialogTitle>
          <DialogDescription>
            Keep contact details and contractor status for external workers.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="labourer-name" label="Name" required>
              <Input
                id="labourer-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>
            <FormField id="labourer-business" label="Business / group">
              <Input
                id="labourer-business"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="labourer-phone" label="Phone">
              <Input
                id="labourer-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </FormField>
            <FormField id="labourer-email" label="Email">
              <Input
                id="labourer-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="labourer-type" label="Labour type">
              <Input
                id="labourer-type"
                placeholder="e.g. Weeding crew"
                value={labourType}
                onChange={(event) => setLabourType(event.target.value)}
              />
            </FormField>
            <FormField id="labourer-status" label="Status">
              <Select value={status} onValueChange={(value) => setStatus(value as 'active' | 'inactive')}>
                <SelectTrigger id="labourer-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <Checkbox
              checked={isContractor}
              onCheckedChange={(checked) => setIsContractor(checked === true)}
            />
            This labourer is a contractor
          </label>

          <FormField id="labourer-notes" label="Notes">
            <Textarea
              id="labourer-notes"
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
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add labourer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
