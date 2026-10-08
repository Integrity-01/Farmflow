import type { BadgeProps } from '@/components/ui/Badge';
import type { FieldStatus, FarmStatus, SizeUnit } from '@/types';

export const FARM_STATUS_OPTIONS: { value: FarmStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

export const FIELD_STATUS_OPTIONS: { value: FieldStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'fallow', label: 'Fallow' },
  { value: 'harvested', label: 'Harvested' },
  { value: 'inactive', label: 'Inactive' },
];

export const SIZE_UNIT_OPTIONS: { value: SizeUnit; label: string }[] = [
  { value: 'hectares', label: 'Hectares' },
  { value: 'acres', label: 'Acres' },
];

type BadgeVariant = NonNullable<BadgeProps['variant']>;

export function farmStatusBadge(status: FarmStatus): { label: string; variant: BadgeVariant } {
  switch (status) {
    case 'active':
      return { label: 'Active', variant: 'success' };
    case 'inactive':
      return { label: 'Inactive', variant: 'warning' };
    case 'archived':
      return { label: 'Archived', variant: 'default' };
  }
}

export function fieldStatusBadge(status: FieldStatus): { label: string; variant: BadgeVariant } {
  switch (status) {
    case 'active':
      return { label: 'Active', variant: 'success' };
    case 'harvested':
      return { label: 'Harvested', variant: 'info' };
    case 'fallow':
      return { label: 'Fallow', variant: 'warning' };
    case 'inactive':
      return { label: 'Inactive', variant: 'default' };
  }
}

export function formatSize(size: string | null | undefined, unit: string): string {
  if (!size) return '—';
  const value = Number(size);
  const formatted = Number.isInteger(value)
    ? String(value)
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${formatted} ${unit}`;
}