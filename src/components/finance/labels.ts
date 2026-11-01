import type { BadgeProps } from '@/components/ui/Badge';
import type {
  ApprovalStatus,
  ChemicalStockStatus,
  FinanceModule,
  PaymentStatus,
} from '@/types/finance';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

export function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return amount.toLocaleString(undefined, {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  });
}

export function formatNumber(value: number | string | null | undefined, digits = 2): string {
  const amount = Number(value ?? 0);
  return amount.toLocaleString(undefined, {
    maximumFractionDigits: Number.isInteger(amount) ? 0 : digits,
  });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  draft: 'Draft',
  submitted: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export function approvalBadge(status: ApprovalStatus | string): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'approved':
      return { label: 'Approved', variant: 'success' };
    case 'submitted':
      return { label: 'Pending approval', variant: 'warning' };
    case 'rejected':
      return { label: 'Rejected', variant: 'danger' };
    case 'cancelled':
      return { label: 'Cancelled', variant: 'outline' };
    default:
      return { label: 'Draft', variant: 'default' };
  }
}

export function paymentBadge(status: PaymentStatus | string): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'paid':
      return { label: 'Paid', variant: 'success' };
    case 'partially_paid':
      return { label: 'Part paid', variant: 'warning' };
    default:
      return { label: 'Unpaid', variant: 'warning' };
  }
}

export function chemicalStockBadge(status: ChemicalStockStatus): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'in_stock':
      return { label: 'In stock', variant: 'success' };
    case 'low':
      return { label: 'Low stock', variant: 'warning' };
    default:
      return { label: 'Out of stock', variant: 'danger' };
  }
}

export function moduleLabel(module: FinanceModule | string): string {
  switch (module) {
    case 'chemical':
      return 'Chemical';
    case 'labour':
      return 'Labour';
    default:
      return 'Other';
  }
}

export function pricingLabel(method: string): string {
  switch (method) {
    case 'daily':
      return 'Per day';
    case 'per_area':
      return 'Per area';
    case 'per_unit':
      return 'Per unit';
    case 'fixed':
      return 'Fixed price';
    default:
      return 'Other';
  }
}

export function paymentMethodOptions(): string[] {
  return ['Cash', 'Bank transfer', 'Mobile money', 'Cheque', 'Card'];
}

export function movementTypeLabel(type: string): string {
  switch (type) {
    case 'purchase':
      return 'Purchase';
    case 'usage':
      return 'Usage';
    case 'usage_cancel':
      return 'Usage reversed';
    case 'transfer':
      return 'Transfer';
    case 'issue':
      return 'Issued';
    case 'return':
      return 'Returned';
    case 'adjustment':
      return 'Adjustment';
    case 'expired':
      return 'Expired';
    case 'damaged':
      return 'Damaged';
    default:
      return type;
  }
}
