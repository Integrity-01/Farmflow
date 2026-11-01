import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAgreedTotal,
  nextStockBalance,
  paymentStatusFor,
  unitCostFromPurchase,
} from '../src/utils/finance-calc.js';
import { convertQuantity } from '../src/utils/units.js';

test('paymentStatusFor separates unpaid, partial and paid states', () => {
  assert.equal(paymentStatusFor(1000, 0), 'unpaid');
  assert.equal(paymentStatusFor(1000, 250), 'partially_paid');
  assert.equal(paymentStatusFor(1000, 1000), 'paid');
  assert.equal(paymentStatusFor(1000, 1000.004), 'paid');
});

test('nextStockBalance rejects movements below zero', () => {
  assert.equal(nextStockBalance(10, 5), 15);
  assert.equal(nextStockBalance(10, -10), 0);
  assert.equal(nextStockBalance(10, -10.5), null);
  assert.equal(nextStockBalance(0.1, 0.2), 0.3);
});

test('unitCostFromPurchase handles zero and fractional stock', () => {
  assert.equal(unitCostFromPurchase(0, 500), 0);
  assert.equal(unitCostFromPurchase(4, 1000), 250);
  assert.equal(unitCostFromPurchase(3, 100), 33.33);
});

test('computeAgreedTotal uses inclusive days for daily labour', () => {
  const total = computeAgreedTotal({
    pricingMethod: 'daily',
    agreedRate: 1000,
    workerCount: 3,
    startDate: '2026-01-01',
    completionDate: '2026-01-05',
  });
  assert.equal(total, 15000);
});

test('computeAgreedTotal multiplies area/unit rates by quantity', () => {
  assert.equal(
    computeAgreedTotal({
      pricingMethod: 'per_area',
      agreedRate: 2500,
      quantityCompleted: 2.5,
    }),
    6250,
  );
  assert.equal(
    computeAgreedTotal({
      pricingMethod: 'per_unit',
      agreedRate: 120,
      quantityCompleted: 30,
    }),
    3600,
  );
});

test('computeAgreedTotal prefers an explicit agreed total', () => {
  assert.equal(
    computeAgreedTotal({
      agreedTotal: 8000,
      pricingMethod: 'daily',
      agreedRate: 1000,
      workerCount: 10,
      startDate: '2026-01-01',
      completionDate: '2026-01-10',
    }),
    8000,
  );
});

test('convertQuantity converts compatible volume and mass units', () => {
  assert.equal(convertQuantity(1, 'litre', 'ml'), 1000);
  assert.equal(convertQuantity(1000, 'g', 'kg'), 1);
  assert.equal(convertQuantity(2, 'kg', 'g'), 2000);
  assert.equal(convertQuantity(5, 'litres', 'litre'), 5);
});

test('convertQuantity refuses incompatible or unknown units', () => {
  assert.equal(convertQuantity(1, 'litre', 'kg'), null);
  assert.equal(convertQuantity(1, 'sachet', 'litre'), null);
  assert.equal(convertQuantity(1, 'litre', 'sachet'), null);
});
