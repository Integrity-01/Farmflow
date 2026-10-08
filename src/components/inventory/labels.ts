import type { BadgeProps } from '@/components/ui/Badge';
import type { InputStock, InputType } from '@/types';

export const INPUT_TYPE_OPTIONS: { value: InputType; label: string }[] = [
  { value: 'seed', label: 'Seed' },
  { value: 'fertilizer', label: 'Fertilizer' },
  { value: 'pesticide', label: 'Pesticide' },
  { value: 'herbicide', label: 'Herbicide' },
  { value: 'fungicide', label: 'Fungicide' },
  { value: 'feed', label: 'Feed' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'tools', label: 'Tools' },
  { value: 'other', label: 'Other' },
];

export const STOCK_OPTIONS: { value: 'all' | InputStock; label: string }[] = [
  { value: 'all', label: 'All stock' },
  { value: 'in_stock', label: 'In stock' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
];

type BadgeVariant = NonNullable<BadgeProps['variant']>;

export function stockBadge(stock: InputStock): { label: string; variant: BadgeVariant } {
  switch (stock) {
    case 'in_stock':
      return { label: 'In stock', variant: 'success' };
    case 'low':
      return { label: 'Low stock', variant: 'warning' };
    case 'out':
      return { label: 'Out of stock', variant: 'danger' };
  }
}

export function formatQuantity(quantity: string | undefined, unit: string): string {
  const value = Number(quantity ?? 0);
  const formatted =
    Number.isInteger(value) ? String(value) : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${formatted} ${unit}`;
}

export function formatCost(unitCost: string | null | undefined): string {
  if (!unitCost) return '—';
  const value = Number(unitCost);
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}