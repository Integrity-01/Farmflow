import { daysInclusive } from './dates.js';
import { num, round2, round3 } from './numbers.js';

export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export function paymentStatusFor(amount: number, paid: number): PaymentStatus {
  if (amount > 0 && paid >= amount - 0.005) return 'paid';
  if (paid > 0) return 'partially_paid';
  return 'unpaid';
}

/** Returns the next stock level, or null when the movement would go negative. */
export function nextStockBalance(current: number, change: number): number | null {
  const next = round3(current + change);
  return next < 0 ? null : next;
}

export function unitCostFromPurchase(received: number, cost: number): number {
  if (received <= 0) return 0;
  return round2(cost / received);
}

export interface AgreedTotalInput {
  agreedTotal?: number | null;
  agreedRate?: number | null;
  pricingMethod?: 'daily' | 'fixed' | 'per_area' | 'per_unit' | 'other';
  workerCount?: number | null;
  quantityCompleted?: number | null;
  startDate?: string | null;
  completionDate?: string | null;
}

/**
 * Calculates an external-labour engagement total. Daily work multiplies the
 * rate by workers and inclusive days; area/unit work multiplies by the completed
 * quantity. Any explicitly supplied total always wins.
 */
export function computeAgreedTotal(input: AgreedTotalInput): number {
  if (input.agreedTotal !== undefined && input.agreedTotal !== null) {
    return round2(input.agreedTotal);
  }
  const rate = num(input.agreedRate);
  if (input.pricingMethod === 'daily') {
    const workers = input.workerCount ?? 1;
    const days =
      input.startDate && input.completionDate
        ? daysInclusive(input.startDate, input.completionDate)
        : 1;
    return round2(rate * workers * days);
  }
  if (input.pricingMethod === 'per_area' || input.pricingMethod === 'per_unit') {
    return round2(rate * num(input.quantityCompleted));
  }
  return round2(rate);
}
