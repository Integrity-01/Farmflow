import { pool, uid } from '../database/pool.js';
import type { AuthUser } from '../types/auth.js';
import { roleAtLeast } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';
import { formatDateOnly, formatDateTime } from '../utils/dates.js';
import { paymentStatusFor, type PaymentStatus } from '../utils/finance-calc.js';
import { num, round2 } from '../utils/numbers.js';
import { recordAudit } from './audit.service.js';
import {
  assertFarmAccess,
  assertFieldAccess,
  assertTaskAccess,
  farmScope,
  requireOrgContext,
} from './finance-access.js';
import type {
  CreateExpenseInput,
  ListExpensesQuery,
  RecordExpensePaymentInput,
  UpdateExpenseInput,
} from '../validations/finance.schema.js';

export type ApprovalStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled';
export type { PaymentStatus };

interface ExpenseRow {
  id: string;
  organization_id: string;
  farm_id: string;
  farm_name: string;
  field_id: string | null;
  field_name: string | null;
  task_id: string | null;
  category_id: string;
  category_name: string;
  category_module: 'chemical' | 'labour' | 'other';
  expense_date: string | Date;
  description: string;
  quantity: string | number | null;
  unit: string | null;
  unit_price: string | number | null;
  amount: string | number;
  supplier: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  approval_status: ApprovalStatus;
  amount_paid: string | number;
  recorded_by: string | null;
  recorded_by_name: string | null;
  submitted_by: string | null;
  submitted_at: string | Date | null;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | Date | null;
  rejected_by: string | null;
  rejected_at: string | Date | null;
  rejection_reason: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface ExpenseRecord {
  id: string;
  farmId: string;
  farmName: string;
  fieldId: string | null;
  fieldName: string | null;
  taskId: string | null;
  categoryId: string;
  categoryName: string;
  categoryModule: 'chemical' | 'labour' | 'other';
  expenseDate: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  amount: number;
  amountPaid: number;
  outstanding: number;
  paymentStatus: PaymentStatus;
  approvalStatus: ApprovalStatus;
  supplier: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  receiptUrl: string | null;
  notes: string | null;
  recordedBy: string | null;
  recordedByName: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const EXPENSE_SELECT = `
  SELECT e.*, c.name AS category_name, c.module AS category_module,
         f.name AS farm_name, fl.name AS field_name,
         ur.name AS recorded_by_name, ua.name AS approved_by_name
  FROM expenses e
  JOIN farms f ON f.id = e.farm_id
  JOIN expense_categories c ON c.id = e.category_id
  LEFT JOIN fields fl ON fl.id = e.field_id
  LEFT JOIN users ur ON ur.id = e.recorded_by
  LEFT JOIN users ua ON ua.id = e.approved_by
`;

function mapExpense(row: ExpenseRow): ExpenseRecord {
  const amount = num(row.amount);
  const paid = num(row.amount_paid);
  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farm_name,
    fieldId: row.field_id,
    fieldName: row.field_name,
    taskId: row.task_id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryModule: row.category_module,
    expenseDate: formatDateOnly(row.expense_date),
    description: row.description,
    quantity: row.quantity === null ? null : num(row.quantity),
    unit: row.unit,
    unitPrice: row.unit_price === null ? null : num(row.unit_price),
    amount,
    amountPaid: paid,
    outstanding: round2(Math.max(amount - paid, 0)),
    paymentStatus: paymentStatusFor(amount, paid),
    approvalStatus: row.approval_status,
    supplier: row.supplier,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    receiptUrl: row.receipt_url,
    notes: row.notes,
    recordedBy: row.recorded_by,
    recordedByName: row.recorded_by_name,
    submittedAt: formatDateTime(row.submitted_at),
    approvedBy: row.approved_by,
    approvedByName: row.approved_by_name,
    approvedAt: formatDateTime(row.approved_at),
    rejectedAt: formatDateTime(row.rejected_at),
    rejectionReason: row.rejection_reason,
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
  };
}

async function assertCategory(organizationId: string, categoryId: string) {
  const result = await pool.query<{ id: string; module: string }>(
    `SELECT id, module FROM expense_categories
     WHERE id = ? AND is_active = 1
       AND (organization_id IS NULL OR organization_id = ?)`,
    [categoryId, organizationId],
  );
  const category = result.rows[0];
  if (!category) {
    throw new AppError(400, 'Please choose a valid expense category.', 'INVALID_REFERENCE');
  }
  return category;
}

async function fetchExpense(actor: AuthUser, id: string): Promise<ExpenseRow> {
  const organizationId = requireOrgContext(actor).organizationId;
  const scope = farmScope(actor, 'f');
  const result = await pool.query<ExpenseRow>(
    `${EXPENSE_SELECT}
     WHERE e.id = ? AND e.organization_id = ? AND ${scope.clause}`,
    [id, organizationId, ...scope.params],
  );
  const row = result.rows[0];
  if (!row) throw new AppError(404, 'Expense not found.', 'NOT_FOUND');
  return row;
}

function ensureCanEdit(actor: AuthUser, row: ExpenseRow) {
  const { role } = requireOrgContext(actor);
  if (row.recorded_by !== actor.id && !roleAtLeast(role, 'supervisor')) {
    throw new AppError(403, 'You can only edit expenses you recorded.', 'FORBIDDEN');
  }
}

export const expenseService = {
  async list(actor: AuthUser, query: ListExpensesQuery) {
    const organizationId = requireOrgContext(actor).organizationId;
    const { clause, params } = farmScope(actor, 'f');
    const conditions: string[] = [clause, 'e.organization_id = ?'];
    const values: unknown[] = [...params, organizationId];

    if (query.farmId) {
      conditions.push('e.farm_id = ?');
      values.push(query.farmId);
    }
    if (query.fieldId) {
      conditions.push('e.field_id = ?');
      values.push(query.fieldId);
    }
    if (query.taskId) {
      conditions.push('e.task_id = ?');
      values.push(query.taskId);
    }
    if (query.categoryId) {
      conditions.push('e.category_id = ?');
      values.push(query.categoryId);
    }
    if (query.approvalStatus) {
      conditions.push('e.approval_status = ?');
      values.push(query.approvalStatus);
    }
    if (query.module) {
      conditions.push('c.module = ?');
      values.push(query.module);
    }
    if (query.paymentStatus === 'paid') {
      conditions.push('e.amount_paid >= e.amount');
    } else if (query.paymentStatus === 'partially_paid') {
      conditions.push('e.amount_paid > 0 AND e.amount_paid < e.amount');
    } else if (query.paymentStatus === 'unpaid') {
      conditions.push('e.amount_paid <= 0');
    }
    if (query.search) {
      const like = `%${query.search}%`;
      conditions.push(
        '(e.description LIKE ? OR e.supplier LIKE ? OR c.name LIKE ? OR e.payment_reference LIKE ?)',
      );
      values.push(like, like, like, like);
    }
    if (query.dateFrom) {
      conditions.push('e.expense_date >= ?');
      values.push(query.dateFrom);
    }
    if (query.dateTo) {
      conditions.push('e.expense_date <= ?');
      values.push(query.dateTo);
    }

    const where = conditions.join(' AND ');
    const [rows, count] = await Promise.all([
      pool.query<ExpenseRow>(
        `${EXPENSE_SELECT} WHERE ${where}
         ORDER BY e.expense_date DESC, e.created_at DESC
         LIMIT ? OFFSET ?`,
        [...values, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      pool.query<{ total: string | number }>(
        `SELECT COUNT(*) AS total
         FROM expenses e
         JOIN farms f ON f.id = e.farm_id
         JOIN expense_categories c ON c.id = e.category_id
         WHERE ${where}`,
        values,
      ),
    ]);

    return {
      items: rows.rows.map(mapExpense),
      total: Number(count.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  async getById(actor: AuthUser, id: string): Promise<ExpenseRecord> {
    return mapExpense(await fetchExpense(actor, id));
  },

  async create(actor: AuthUser, input: CreateExpenseInput): Promise<ExpenseRecord> {
    const { organizationId } = requireOrgContext(actor);
    await assertFarmAccess(actor, input.farmId);
    await assertCategory(organizationId, input.categoryId);
    if (input.fieldId) await assertFieldAccess(actor, input.farmId, input.fieldId);
    if (input.taskId) await assertTaskAccess(actor, input.taskId, input.farmId);

    const amount =
      input.amount ?? round2(num(input.quantity) * num(input.unitPrice));
    if (!(amount > 0)) {
      throw new AppError(400, 'Enter an amount greater than zero.', 'VALIDATION_ERROR');
    }

    const id = uid();
    const submitted = Boolean(input.submit);
    await pool.query(
      `INSERT INTO expenses
         (id, organization_id, farm_id, field_id, task_id, category_id, expense_date,
          description, quantity, unit, unit_price, amount, supplier, payment_method,
          payment_reference, approval_status, recorded_by, submitted_by, submitted_at,
          receipt_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        organizationId,
        input.farmId,
        input.fieldId ?? null,
        input.taskId ?? null,
        input.categoryId,
        input.expenseDate,
        input.description,
        input.quantity ?? null,
        input.unit ?? null,
        input.unitPrice ?? null,
        amount,
        input.supplier ?? null,
        input.paymentMethod ?? null,
        input.paymentReference ?? null,
        submitted ? 'submitted' : 'draft',
        actor.id,
        submitted ? actor.id : null,
        submitted ? new Date() : null,
        input.receiptUrl ?? null,
        input.notes ?? null,
      ],
    );

    await recordAudit({
      actorUserId: actor.id,
      organizationId,
      action: submitted ? 'expense.submitted' : 'expense.created',
      targetType: 'expense',
      targetId: id,
      metadata: { farmId: input.farmId, categoryId: input.categoryId, amount },
    });

    return this.getById(actor, id);
  },

  async update(actor: AuthUser, id: string, input: UpdateExpenseInput): Promise<ExpenseRecord> {
    const row = await fetchExpense(actor, id);
    ensureCanEdit(actor, row);
    if (row.approval_status !== 'draft' && row.approval_status !== 'rejected') {
      throw new AppError(
        409,
        'Only draft or rejected expenses can be edited.',
        'INVALID_STATE',
      );
    }

    const farmId = input.farmId ?? row.farm_id;
    if (input.farmId && input.farmId !== row.farm_id) {
      await assertFarmAccess(actor, input.farmId);
    }
    const fieldId = input.fieldId === undefined ? row.field_id : input.fieldId;
    const taskId = input.taskId === undefined ? row.task_id : input.taskId;
    if (fieldId) await assertFieldAccess(actor, farmId, fieldId);
    if (taskId) await assertTaskAccess(actor, taskId, farmId);
    if (input.categoryId) {
      await assertCategory(row.organization_id, input.categoryId);
    }

    const quantity =
      input.quantity === undefined ? (row.quantity === null ? null : num(row.quantity)) : input.quantity;
    const unitPrice =
      input.unitPrice === undefined
        ? row.unit_price === null
          ? null
          : num(row.unit_price)
        : input.unitPrice;
    const amount =
      input.amount ??
      (input.quantity !== undefined || input.unitPrice !== undefined
        ? round2(num(quantity) * num(unitPrice))
        : num(row.amount));
    if (!(amount > 0)) {
      throw new AppError(400, 'Enter an amount greater than zero.', 'VALIDATION_ERROR');
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    const assign = (column: string, value: unknown) => {
      sets.push(`${column} = ?`);
      values.push(value);
    };

    if (input.farmId !== undefined) assign('farm_id', input.farmId);
    if (input.fieldId !== undefined) assign('field_id', input.fieldId ?? null);
    if (input.taskId !== undefined) assign('task_id', input.taskId ?? null);
    if (input.categoryId !== undefined) assign('category_id', input.categoryId);
    if (input.expenseDate !== undefined) assign('expense_date', input.expenseDate);
    if (input.description !== undefined) assign('description', input.description);
    if (input.quantity !== undefined) assign('quantity', input.quantity ?? null);
    if (input.unit !== undefined) assign('unit', input.unit ?? null);
    if (input.unitPrice !== undefined) assign('unit_price', input.unitPrice ?? null);
    if (input.amount !== undefined || input.quantity !== undefined || input.unitPrice !== undefined) {
      assign('amount', amount);
    }
    if (input.supplier !== undefined) assign('supplier', input.supplier ?? null);
    if (input.paymentMethod !== undefined) assign('payment_method', input.paymentMethod ?? null);
    if (input.paymentReference !== undefined) {
      assign('payment_reference', input.paymentReference ?? null);
    }
    if (input.receiptUrl !== undefined) assign('receipt_url', input.receiptUrl ?? null);
    if (input.notes !== undefined) assign('notes', input.notes ?? null);

    if (row.approval_status === 'rejected') {
      sets.push("approval_status = 'draft'");
      sets.push('rejected_by = NULL');
      sets.push('rejected_at = NULL');
      sets.push('rejection_reason = NULL');
    }
    sets.push('updated_at = now()');

    if (sets.length > 0) {
      values.push(id, row.organization_id);
      await pool.query(
        `UPDATE expenses SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
        values,
      );
    }

    await recordAudit({
      actorUserId: actor.id,
      organizationId: row.organization_id,
      action: 'expense.updated',
      targetType: 'expense',
      targetId: id,
      metadata: { amount },
    });

    return this.getById(actor, id);
  },

  async remove(actor: AuthUser, id: string): Promise<void> {
    const row = await fetchExpense(actor, id);
    ensureCanEdit(actor, row);
    if (row.approval_status !== 'draft') {
      throw new AppError(409, 'Only draft expenses can be deleted. Cancel it instead.', 'INVALID_STATE');
    }
    await pool.query(`DELETE FROM expenses WHERE id = ? AND organization_id = ?`, [
      id,
      row.organization_id,
    ]);
    await recordAudit({
      actorUserId: actor.id,
      organizationId: row.organization_id,
      action: 'expense.deleted',
      targetType: 'expense',
      targetId: id,
      metadata: { amount: num(row.amount) },
    });
  },

  async submit(actor: AuthUser, id: string): Promise<ExpenseRecord> {
    const row = await fetchExpense(actor, id);
    ensureCanEdit(actor, row);
    if (row.approval_status !== 'draft' && row.approval_status !== 'rejected') {
      throw new AppError(409, 'This expense cannot be submitted.', 'INVALID_STATE');
    }
    await pool.query(
      `UPDATE expenses
       SET approval_status = 'submitted', submitted_by = ?, submitted_at = now(),
           rejected_by = NULL, rejected_at = NULL, rejection_reason = NULL, updated_at = now()
       WHERE id = ? AND organization_id = ?`,
      [actor.id, id, row.organization_id],
    );
    await recordAudit({
      actorUserId: actor.id,
      organizationId: row.organization_id,
      action: 'expense.submitted',
      targetType: 'expense',
      targetId: id,
      metadata: { amount: num(row.amount) },
    });
    return this.getById(actor, id);
  },

  async approve(actor: AuthUser, id: string): Promise<ExpenseRecord> {
    const row = await fetchExpense(actor, id);
    if (row.approval_status !== 'submitted') {
      throw new AppError(409, 'Only submitted expenses can be approved.', 'INVALID_STATE');
    }
    const { role } = requireOrgContext(actor);
    if (row.recorded_by === actor.id && role !== 'organization_administrator') {
      throw new AppError(403, 'You cannot approve an expense you recorded.', 'SELF_APPROVAL');
    }
    await pool.query(
      `UPDATE expenses
       SET approval_status = 'approved', approved_by = ?, approved_at = now(), updated_at = now()
       WHERE id = ? AND organization_id = ?`,
      [actor.id, id, row.organization_id],
    );
    await recordAudit({
      actorUserId: actor.id,
      organizationId: row.organization_id,
      action: 'expense.approved',
      targetType: 'expense',
      targetId: id,
      metadata: { amount: num(row.amount) },
    });
    return this.getById(actor, id);
  },

  async reject(actor: AuthUser, id: string, reason: string): Promise<ExpenseRecord> {
    const row = await fetchExpense(actor, id);
    if (row.approval_status !== 'submitted') {
      throw new AppError(409, 'Only submitted expenses can be rejected.', 'INVALID_STATE');
    }
    await pool.query(
      `UPDATE expenses
       SET approval_status = 'rejected', rejected_by = ?, rejected_at = now(),
           rejection_reason = ?, updated_at = now()
       WHERE id = ? AND organization_id = ?`,
      [actor.id, reason, id, row.organization_id],
    );
    await recordAudit({
      actorUserId: actor.id,
      organizationId: row.organization_id,
      action: 'expense.rejected',
      targetType: 'expense',
      targetId: id,
      metadata: { reason, amount: num(row.amount) },
    });
    return this.getById(actor, id);
  },

  async cancel(actor: AuthUser, id: string, reason: string): Promise<ExpenseRecord> {
    const row = await fetchExpense(actor, id);
    ensureCanEdit(actor, row);
    if (row.approval_status === 'cancelled') {
      throw new AppError(409, 'This expense is already cancelled.', 'INVALID_STATE');
    }
    const payments = await pool.query<{ total: string | number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expense_payments WHERE expense_id = ?`,
      [id],
    );
    if (num(payments.rows[0]?.total) > 0) {
      throw new AppError(409, 'Reverse the recorded payments before cancelling this expense.', 'PAYMENTS_EXIST');
    }
    await pool.query(
      `UPDATE expenses
       SET approval_status = 'cancelled', rejection_reason = ?, updated_at = now()
       WHERE id = ? AND organization_id = ?`,
      [reason, id, row.organization_id],
    );
    await recordAudit({
      actorUserId: actor.id,
      organizationId: row.organization_id,
      action: 'expense.cancelled',
      targetType: 'expense',
      targetId: id,
      metadata: { reason, amount: num(row.amount) },
    });
    return this.getById(actor, id);
  },

  async addPayment(actor: AuthUser, id: string, input: RecordExpensePaymentInput) {
    const row = await fetchExpense(actor, id);
    const amount = round2(input.amount);

    await pool.withTransaction(async (db) => {
      const locked = await db.query<ExpenseRow>(
        `SELECT * FROM expenses WHERE id = ? AND organization_id = ? FOR UPDATE`,
        [id, row.organization_id],
      );
      const expense = locked.rows[0];
      if (!expense) throw new AppError(404, 'Expense not found.', 'NOT_FOUND');
      if (expense.approval_status !== 'approved') {
        throw new AppError(
          409,
          'Only approved expenses can be paid. Approval and payment are separate steps.',
          'INVALID_STATE',
        );
      }
      const remaining = round2(num(expense.amount) - num(expense.amount_paid));
      if (amount > remaining + 0.005) {
        throw new AppError(
          400,
          `The payment exceeds the outstanding balance of ${remaining.toFixed(2)}.`,
          'OVERPAYMENT',
        );
      }

      await db.query(
        `INSERT INTO expense_payments
           (id, organization_id, expense_id, amount, paid_on, method, reference, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uid(),
          row.organization_id,
          id,
          amount,
          input.paidOn,
          input.method ?? null,
          input.reference ?? null,
          input.notes ?? null,
          actor.id,
        ],
      );
      await db.query(
        `UPDATE expenses SET amount_paid = amount_paid + ?, updated_at = now()
         WHERE id = ? AND organization_id = ?`,
        [amount, id, row.organization_id],
      );
    });

    await recordAudit({
      actorUserId: actor.id,
      organizationId: row.organization_id,
      action: 'expense.payment_recorded',
      targetType: 'expense',
      targetId: id,
      metadata: { amount, paidOn: input.paidOn },
    });

    return this.getById(actor, id);
  },

  async listPayments(actor: AuthUser, expenseId: string) {
    const row = await fetchExpense(actor, expenseId);
    const result = await pool.query(
      `SELECT p.id, p.amount, p.paid_on, p.method, p.reference, p.notes,
              p.recorded_by, u.name AS recorded_by_name, p.created_at
       FROM expense_payments p
       LEFT JOIN users u ON u.id = p.recorded_by
       WHERE p.expense_id = ? AND p.organization_id = ?
       ORDER BY p.paid_on DESC, p.created_at DESC`,
      [expenseId, row.organization_id],
    );
    return result.rows.map((payment) => ({
      id: payment.id as string,
      amount: num(payment.amount),
      paidOn: formatDateOnly(payment.paid_on as string | Date),
      method: payment.method as string | null,
      reference: payment.reference as string | null,
      notes: payment.notes as string | null,
      recordedBy: payment.recorded_by as string | null,
      recordedByName: payment.recorded_by_name as string | null,
      createdAt: formatDateTime(payment.created_at as string | Date),
    }));
  },

  async listCategories(actor: AuthUser) {
    const { organizationId } = requireOrgContext(actor);
    const result = await pool.query(
      `SELECT id, code, name, module, description, is_system, is_active
       FROM expense_categories
       WHERE (organization_id IS NULL OR organization_id = ?) AND is_active = 1
       ORDER BY is_system DESC, module, name`,
      [organizationId],
    );
    return result.rows.map((row) => ({
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      module: row.module as 'chemical' | 'labour' | 'other',
      description: row.description as string | null,
      isSystem: Boolean(row.is_system),
    }));
  },

  async createCategory(
    actor: AuthUser,
    input: { code: string; name: string; module: 'chemical' | 'labour' | 'other'; description?: string | null },
  ) {
    const { organizationId } = requireOrgContext(actor);
    const id = uid();
    try {
      await pool.query(
        `INSERT INTO expense_categories
           (id, organization_id, code, name, module, description, is_system, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 0, 1)`,
        [id, organizationId, input.code, input.name, input.module, input.description ?? null],
      );
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new AppError(409, 'A category with this code already exists.', 'DUPLICATE');
      }
      throw error;
    }
    await recordAudit({
      actorUserId: actor.id,
      organizationId,
      action: 'expense_category.created',
      targetType: 'expense_category',
      targetId: id,
      metadata: { code: input.code, module: input.module },
    });
    return { id, ...input };
  },

  async updateCategory(
    actor: AuthUser,
    id: string,
    input: { name?: string; module?: 'chemical' | 'labour' | 'other'; description?: string | null; isActive?: boolean },
  ) {
    const { organizationId } = requireOrgContext(actor);
    const existing = await pool.query<{ id: string; is_system: boolean }>(
      `SELECT id, is_system FROM expense_categories WHERE id = ? AND organization_id = ?`,
      [id, organizationId],
    );
    if (existing.rows.length === 0) {
      throw new AppError(404, 'Category not found.', 'NOT_FOUND');
    }
    const sets: string[] = [];
    const values: unknown[] = [];
    if (input.name !== undefined) {
      sets.push('name = ?');
      values.push(input.name);
    }
    if (input.module !== undefined) {
      sets.push('module = ?');
      values.push(input.module);
    }
    if (input.description !== undefined) {
      sets.push('description = ?');
      values.push(input.description ?? null);
    }
    if (input.isActive !== undefined) {
      sets.push('is_active = ?');
      values.push(input.isActive ? 1 : 0);
    }
    if (sets.length > 0) {
      values.push(id, organizationId);
      await pool.query(
        `UPDATE expense_categories SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
        values,
      );
    }
    return { id };
  },
};

