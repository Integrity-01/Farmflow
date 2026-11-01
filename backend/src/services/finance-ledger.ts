import type { QueryResult } from '../database/pool.js';
import { uid } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';

export type LedgerDb = {
  query: <R = any>(sql: string, params?: unknown[]) => Promise<QueryResult<R>>;
};

export interface LinkedExpenseInput {
  organizationId: string;
  farmId: string;
  fieldId?: string | null;
  taskId?: string | null;
  categoryCode: 'chemical_purchase' | 'labour_payment';
  expenseDate: string;
  description: string;
  amount: number;
  amountPaid?: number;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  supplier?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  recordedBy: string;
  approvedBy?: string | null;
  approved: boolean;
  notes?: string | null;
}

/**
 * Creates an expense in the central ledger for a chemical purchase or an
 * external-labour payment. Chemical and labour modules never add their costs to
 * financial totals directly, which is what keeps reports from double counting.
 */
export async function createLinkedExpense(
  db: LedgerDb,
  input: LinkedExpenseInput,
): Promise<string> {
  const category = await db.query<{ id: string }>(
    `SELECT id FROM expense_categories
     WHERE code = ? AND organization_id IS NULL AND is_active = 1
     LIMIT 1`,
    [input.categoryCode],
  );
  const categoryId = category.rows[0]?.id;
  if (!categoryId) {
    throw new AppError(
      500,
      'The linked expense category is not configured.',
      'CONFIGURATION_ERROR',
    );
  }

  const id = uid();
  const approved = input.approved;
  const paid = approved ? (input.amountPaid ?? input.amount) : 0;
  await db.query(
    `INSERT INTO expenses
       (id, organization_id, farm_id, field_id, task_id, category_id, expense_date,
        description, quantity, unit, unit_price, amount, supplier, payment_method,
        payment_reference, approval_status, amount_paid, recorded_by, submitted_by,
        submitted_at, approved_by, approved_at, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.organizationId,
      input.farmId,
      input.fieldId ?? null,
      input.taskId ?? null,
      categoryId,
      input.expenseDate,
      input.description,
      input.quantity ?? null,
      input.unit ?? null,
      input.unitPrice ?? null,
      input.amount,
      input.supplier ?? null,
      input.paymentMethod ?? null,
      input.paymentReference ?? null,
      approved ? 'approved' : 'submitted',
      paid,
      input.recordedBy,
      input.recordedBy,
      new Date(),
      approved ? (input.approvedBy ?? input.recordedBy) : null,
      approved ? new Date() : null,
      input.notes ?? null,
    ],
  );
  return id;
}
