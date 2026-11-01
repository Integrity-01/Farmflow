import { pool, uid } from '../database/pool.js';
import type { AuthUser } from '../types/auth.js';
import { roleAtLeast } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';
import { formatDateOnly, formatDateTime } from '../utils/dates.js';
import { computeAgreedTotal } from '../utils/finance-calc.js';
import { num, round2 } from '../utils/numbers.js';
import { recordAudit } from './audit.service.js';
import { createLinkedExpense } from './finance-ledger.js';
import {
  assertFarmAccess,
  assertFieldAccess,
  assertTaskAccess,
  farmScope,
  requireOrgContext,
} from './finance-access.js';
import type {
  CreateLabourEngagementInput,
  CreateLabourerInput,
  RecordLabourPaymentInput,
} from '../validations/finance.schema.js';

interface LabourerRow {
  id: string;
  organization_id: string;
  name: string;
  business_name: string | null;
  phone: string | null;
  email: string | null;
  labour_type: string | null;
  is_contractor: boolean | number;
  notes: string | null;
  status: 'active' | 'inactive';
  created_at: string | Date;
  updated_at: string | Date;
}

interface EngagementRow {
  id: string;
  organization_id: string;
  farm_id: string;
  farm_name: string;
  field_id: string | null;
  field_name: string | null;
  task_id: string | null;
  labourer_id: string;
  labourer_name: string;
  work_type: string;
  description: string | null;
  start_date: string | Date | null;
  completion_date: string | Date | null;
  worker_count: number | string | null;
  quantity_completed: string | number | null;
  unit_of_work: string | null;
  pricing_method: 'daily' | 'fixed' | 'per_area' | 'per_unit' | 'other';
  agreed_rate: string | number | null;
  agreed_total: string | number;
  approval_status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled';
  recorded_by: string | null;
  recorded_by_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | Date | null;
  rejection_reason: string | null;
  invoice_url: string | null;
  notes: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  paid_total: string | number;
}

function mapLabourer(row: LabourerRow) {
  return {
    id: row.id,
    name: row.name,
    businessName: row.business_name,
    phone: row.phone,
    email: row.email,
    labourType: row.labour_type,
    isContractor: Boolean(row.is_contractor),
    notes: row.notes,
    status: row.status,
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
  };
}

function mapEngagement(row: EngagementRow) {
  const agreed = num(row.agreed_total);
  const paid = num(row.paid_total);
  const paymentStatus = paid >= agreed - 0.005 && agreed > 0
    ? 'paid'
    : paid > 0
      ? 'partially_paid'
      : 'unpaid';

  let status: string = row.approval_status;
  if (row.approval_status === 'approved') {
    status = paymentStatus === 'paid' ? 'fully_paid' : paymentStatus === 'partially_paid' ? 'partially_paid' : 'approved';
  } else if (row.approval_status === 'submitted') {
    status = 'pending_approval';
  }

  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farm_name,
    fieldId: row.field_id,
    fieldName: row.field_name,
    taskId: row.task_id,
    labourerId: row.labourer_id,
    labourerName: row.labourer_name,
    workType: row.work_type,
    description: row.description,
    startDate: formatDateOnly(row.start_date),
    completionDate: formatDateOnly(row.completion_date),
    workerCount: row.worker_count === null ? null : Number(row.worker_count),
    quantityCompleted: row.quantity_completed === null ? null : num(row.quantity_completed),
    unitOfWork: row.unit_of_work,
    pricingMethod: row.pricing_method,
    agreedRate: row.agreed_rate === null ? null : num(row.agreed_rate),
    agreedTotal: agreed,
    paidTotal: paid,
    outstanding: round2(Math.max(agreed - paid, 0)),
    approvalStatus: row.approval_status,
    paymentStatus,
    status,
    recordedBy: row.recorded_by,
    recordedByName: row.recorded_by_name,
    approvedBy: row.approved_by,
    approvedByName: row.approved_by_name,
    approvedAt: formatDateTime(row.approved_at),
    rejectionReason: row.rejection_reason,
    invoiceUrl: row.invoice_url,
    notes: row.notes,
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
  };
}

const ENGAGEMENT_SELECT = `
  SELECT e.*, f.name AS farm_name, fl.name AS field_name, l.name AS labourer_name,
         u.name AS recorded_by_name, ua.name AS approved_by_name,
         COALESCE((SELECT SUM(lp.amount) FROM labour_payments lp
                   WHERE lp.engagement_id = e.id), 0) AS paid_total
  FROM labour_engagements e
  JOIN farms f ON f.id = e.farm_id
  LEFT JOIN fields fl ON fl.id = e.field_id
  JOIN external_labourers l ON l.id = e.labourer_id
  LEFT JOIN users u ON u.id = e.recorded_by
  LEFT JOIN users ua ON ua.id = e.approved_by
`;

async function assertLabourer(organizationId: string, labourerId: string) {
  const result = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM external_labourers
     WHERE id = ? AND organization_id = ? AND status = 'active'`,
    [labourerId, organizationId],
  );
  if (result.rows.length === 0) {
    throw new AppError(400, 'Please choose a valid external labourer.', 'INVALID_REFERENCE');
  }
}

async function fetchEngagement(actor: AuthUser, id: string): Promise<EngagementRow> {
  const { organizationId } = requireOrgContext(actor);
  const scope = farmScope(actor, 'f');
  const result = await pool.query<EngagementRow>(
    `${ENGAGEMENT_SELECT}
     WHERE e.id = ? AND e.organization_id = ? AND ${scope.clause}`,
    [id, organizationId, ...scope.params],
  );
  const row = result.rows[0];
  if (!row) throw new AppError(404, 'Labour engagement not found.', 'NOT_FOUND');
  return row;
}

function ensureCanEdit(actor: AuthUser, row: EngagementRow) {
  const { role } = requireOrgContext(actor);
  if (row.recorded_by !== actor.id && !roleAtLeast(role, 'supervisor')) {
    throw new AppError(403, 'You can only edit labour records you created.', 'FORBIDDEN');
  }
}

export const labourService = {
  async listLabourers(actor: AuthUser, query: { search?: string; status?: 'active' | 'inactive'; page: number; pageSize: number }) {
    const { organizationId } = requireOrgContext(actor);
    const conditions = ['organization_id = ?'];
    const values: unknown[] = [organizationId];
    if (query.status) {
      conditions.push('status = ?');
      values.push(query.status);
    }
    if (query.search) {
      const like = `%${query.search}%`;
      conditions.push('(name LIKE ? OR business_name LIKE ? OR phone LIKE ? OR labour_type LIKE ?)');
      values.push(like, like, like, like);
    }
    const where = conditions.join(' AND ');
    const [rows, count] = await Promise.all([
      pool.query<LabourerRow>(
        `SELECT * FROM external_labourers WHERE ${where}
         ORDER BY name ASC LIMIT ? OFFSET ?`,
        [...values, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      pool.query<{ total: string | number }>(
        `SELECT COUNT(*) AS total FROM external_labourers WHERE ${where}`,
        values,
      ),
    ]);
    return {
      items: rows.rows.map(mapLabourer),
      total: Number(count.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  async getLabourer(actor: AuthUser, id: string) {
    const { organizationId } = requireOrgContext(actor);
    const result = await pool.query<LabourerRow>(
      `SELECT * FROM external_labourers WHERE id = ? AND organization_id = ?`,
      [id, organizationId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, 'External labourer not found.', 'NOT_FOUND');
    const engagements = await pool.query<{ total: string | number; paid: string | number }>(
      `SELECT COALESCE(SUM(e.agreed_total), 0) AS total,
              COALESCE(SUM((SELECT SUM(lp.amount) FROM labour_payments lp WHERE lp.engagement_id = e.id)), 0) AS paid
       FROM labour_engagements e
       WHERE e.organization_id = ? AND e.labourer_id = ?
         AND e.approval_status = 'approved'`,
      [organizationId, id],
    );
    return {
      ...mapLabourer(row),
      totalEngaged: num(engagements.rows[0]?.total),
      totalPaid: num(engagements.rows[0]?.paid),
    };
  },

  async createLabourer(actor: AuthUser, input: CreateLabourerInput) {
    const { organizationId } = requireOrgContext(actor);
    const id = uid();
    await pool.query(
      `INSERT INTO external_labourers
         (id, organization_id, name, business_name, phone, email, labour_type,
          is_contractor, notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        organizationId,
        input.name,
        input.businessName ?? null,
        input.phone ?? null,
        input.email || null,
        input.labourType ?? null,
        input.isContractor ? 1 : 0,
        input.notes ?? null,
        input.status,
        actor.id,
      ],
    );
    await recordAudit({
      actorUserId: actor.id,
      organizationId,
      action: 'labourer.created',
      targetType: 'external_labourer',
      targetId: id,
      metadata: { name: input.name },
    });
    return this.getLabourer(actor, id);
  },

  async updateLabourer(actor: AuthUser, id: string, input: Partial<CreateLabourerInput>) {
    const { organizationId } = requireOrgContext(actor);
    const sets: string[] = [];
    const values: unknown[] = [];
    const assign = (column: string, value: unknown) => {
      sets.push(`${column} = ?`);
      values.push(value);
    };
    if (input.name !== undefined) assign('name', input.name);
    if (input.businessName !== undefined) assign('business_name', input.businessName ?? null);
    if (input.phone !== undefined) assign('phone', input.phone ?? null);
    if (input.email !== undefined) assign('email', input.email || null);
    if (input.labourType !== undefined) assign('labour_type', input.labourType ?? null);
    if (input.isContractor !== undefined) assign('is_contractor', input.isContractor ? 1 : 0);
    if (input.notes !== undefined) assign('notes', input.notes ?? null);
    if (input.status !== undefined) assign('status', input.status);
    if (sets.length > 0) {
      sets.push('updated_at = now()');
      values.push(id, organizationId);
      await pool.query(
        `UPDATE external_labourers SET ${sets.join(', ')}
         WHERE id = ? AND organization_id = ?`,
        values,
      );
      await recordAudit({
        actorUserId: actor.id,
        organizationId,
        action: 'labourer.updated',
        targetType: 'external_labourer',
        targetId: id,
      });
    }
    return this.getLabourer(actor, id);
  },

  async listEngagements(actor: AuthUser, query: { farmId?: string; labourerId?: string; approvalStatus?: string; paymentStatus?: string; dateFrom?: string; dateTo?: string; search?: string; page: number; pageSize: number }) {
    const { organizationId } = requireOrgContext(actor);
    const scope = farmScope(actor, 'f');
    const conditions = [scope.clause, 'e.organization_id = ?'];
    const values: unknown[] = [...scope.params, organizationId];

    if (query.farmId) {
      conditions.push('e.farm_id = ?');
      values.push(query.farmId);
    }
    if (query.labourerId) {
      conditions.push('e.labourer_id = ?');
      values.push(query.labourerId);
    }
    if (query.approvalStatus) {
      conditions.push('e.approval_status = ?');
      values.push(query.approvalStatus);
    }
    if (query.dateFrom) {
      conditions.push('DATE(COALESCE(e.start_date, e.created_at)) >= ?');
      values.push(query.dateFrom);
    }
    if (query.dateTo) {
      conditions.push('DATE(COALESCE(e.completion_date, e.start_date, e.created_at)) <= ?');
      values.push(query.dateTo);
    }
    if (query.search) {
      const like = `%${query.search}%`;
      conditions.push('(e.work_type LIKE ? OR e.description LIKE ? OR l.name LIKE ?)');
      values.push(like, like, like);
    }
    if (query.paymentStatus) {
      const paidExpression = `COALESCE((SELECT SUM(lp.amount) FROM labour_payments lp WHERE lp.engagement_id = e.id), 0)`;
      if (query.paymentStatus === 'paid') {
        conditions.push(`(e.approval_status = 'approved' AND ${paidExpression} >= e.agreed_total)`);
      } else if (query.paymentStatus === 'partially_paid') {
        conditions.push(`(e.approval_status = 'approved' AND ${paidExpression} > 0 AND ${paidExpression} < e.agreed_total)`);
      } else if (query.paymentStatus === 'unpaid') {
        conditions.push(`${paidExpression} <= 0`);
      }
    }

    const where = conditions.join(' AND ');
    const [rows, count] = await Promise.all([
      pool.query<EngagementRow>(
        `${ENGAGEMENT_SELECT}
         WHERE ${where}
         ORDER BY COALESCE(e.start_date, e.created_at) DESC, e.created_at DESC
         LIMIT ? OFFSET ?`,
        [...values, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      pool.query<{ total: string | number }>(
        `SELECT COUNT(*) AS total
         FROM labour_engagements e
         JOIN farms f ON f.id = e.farm_id
         JOIN external_labourers l ON l.id = e.labourer_id
         WHERE ${where}`,
        values,
      ),
    ]);

    return {
      items: rows.rows.map(mapEngagement),
      total: Number(count.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  async getEngagement(actor: AuthUser, id: string) {
    const engagement = mapEngagement(await fetchEngagement(actor, id));
    const payments = await this.listPayments(actor, id);
    return { ...engagement, payments };
  },

  async createEngagement(actor: AuthUser, input: CreateLabourEngagementInput) {
    const { organizationId } = requireOrgContext(actor);
    await assertFarmAccess(actor, input.farmId);
    if (input.fieldId) await assertFieldAccess(actor, input.farmId, input.fieldId);
    if (input.taskId) await assertTaskAccess(actor, input.taskId, input.farmId);
    await assertLabourer(organizationId, input.labourerId);

    const agreedTotal = computeAgreedTotal(input);
    if (!(agreedTotal > 0)) {
      throw new AppError(400, 'Enter the agreed labour cost.', 'VALIDATION_ERROR');
    }

    const id = uid();
    const submitted = Boolean(input.submit);
    await pool.query(
      `INSERT INTO labour_engagements
         (id, organization_id, farm_id, field_id, task_id, labourer_id, work_type,
          description, start_date, completion_date, worker_count, quantity_completed,
          unit_of_work, pricing_method, agreed_rate, agreed_total, approval_status,
          recorded_by, submitted_by, submitted_at, invoice_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        organizationId,
        input.farmId,
        input.fieldId ?? null,
        input.taskId ?? null,
        input.labourerId,
        input.workType,
        input.description ?? null,
        input.startDate ?? null,
        input.completionDate ?? null,
        input.workerCount ?? null,
        input.quantityCompleted ?? null,
        input.unitOfWork ?? null,
        input.pricingMethod,
        input.agreedRate ?? null,
        agreedTotal,
        submitted ? 'submitted' : 'draft',
        actor.id,
        submitted ? actor.id : null,
        submitted ? new Date() : null,
        input.invoiceUrl ?? null,
        input.notes ?? null,
      ],
    );

    await recordAudit({
      actorUserId: actor.id,
      organizationId,
      action: submitted ? 'labour.submitted' : 'labour.created',
      targetType: 'labour_engagement',
      targetId: id,
      metadata: { farmId: input.farmId, agreedTotal },
    });

    return this.getEngagement(actor, id);
  },

  async updateEngagement(actor: AuthUser, id: string, input: Partial<CreateLabourEngagementInput>) {
    const row = await fetchEngagement(actor, id);
    ensureCanEdit(actor, row);
    if (row.approval_status !== 'draft' && row.approval_status !== 'rejected') {
      throw new AppError(409, 'Only draft or rejected labour records can be edited.', 'INVALID_STATE');
    }

    const farmId = input.farmId ?? row.farm_id;
    if (input.farmId && input.farmId !== row.farm_id) {
      await assertFarmAccess(actor, input.farmId);
    }
    const fieldId = input.fieldId === undefined ? row.field_id : input.fieldId;
    const taskId = input.taskId === undefined ? row.task_id : input.taskId;
    if (fieldId) await assertFieldAccess(actor, farmId, fieldId);
    if (taskId) await assertTaskAccess(actor, taskId, farmId);
    if (input.labourerId) await assertLabourer(row.organization_id, input.labourerId);

    const merged = {
      ...row,
      pricingMethod: input.pricingMethod ?? row.pricing_method,
      agreedRate: input.agreedRate === undefined ? (row.agreed_rate === null ? undefined : num(row.agreed_rate)) : input.agreedRate ?? undefined,
      agreedTotal: input.agreedTotal,
      workerCount: input.workerCount === undefined ? (row.worker_count === null ? undefined : Number(row.worker_count)) : input.workerCount ?? undefined,
      quantityCompleted: input.quantityCompleted === undefined ? (row.quantity_completed === null ? undefined : num(row.quantity_completed)) : input.quantityCompleted ?? undefined,
      startDate: input.startDate === undefined ? formatDateOnly(row.start_date) ?? undefined : input.startDate ?? undefined,
      completionDate: input.completionDate === undefined ? formatDateOnly(row.completion_date) ?? undefined : input.completionDate ?? undefined,
    };
    const pricingTouched = [
      'agreedTotal',
      'agreedRate',
      'pricingMethod',
      'workerCount',
      'quantityCompleted',
      'startDate',
      'completionDate',
    ].some((key) => input[key as keyof typeof input] !== undefined);
    const agreedTotal = pricingTouched
      ? computeAgreedTotal(merged)
      : num(row.agreed_total);
    if (!(agreedTotal > 0)) {
      throw new AppError(400, 'Enter the agreed labour cost.', 'VALIDATION_ERROR');
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
    if (input.labourerId !== undefined) assign('labourer_id', input.labourerId);
    if (input.workType !== undefined) assign('work_type', input.workType);
    if (input.description !== undefined) assign('description', input.description ?? null);
    if (input.startDate !== undefined) assign('start_date', input.startDate ?? null);
    if (input.completionDate !== undefined) assign('completion_date', input.completionDate ?? null);
    if (input.workerCount !== undefined) assign('worker_count', input.workerCount ?? null);
    if (input.quantityCompleted !== undefined) assign('quantity_completed', input.quantityCompleted ?? null);
    if (input.unitOfWork !== undefined) assign('unit_of_work', input.unitOfWork ?? null);
    if (input.pricingMethod !== undefined) assign('pricing_method', input.pricingMethod);
    if (input.agreedRate !== undefined) assign('agreed_rate', input.agreedRate ?? null);
    assign('agreed_total', agreedTotal);
    if (input.invoiceUrl !== undefined) assign('invoice_url', input.invoiceUrl ?? null);
    if (input.notes !== undefined) assign('notes', input.notes ?? null);

    if (row.approval_status === 'rejected') {
      sets.push("approval_status = 'draft'");
      sets.push('rejected_by = NULL');
      sets.push('rejected_at = NULL');
      sets.push('rejection_reason = NULL');
    }
    sets.push('updated_at = now()');
    values.push(id, row.organization_id);

    await pool.query(
      `UPDATE labour_engagements SET ${sets.join(', ')}
       WHERE id = ? AND organization_id = ?`,
      values,
    );
    await recordAudit({
      actorUserId: actor.id,
      organizationId: row.organization_id,
      action: 'labour.updated',
      targetType: 'labour_engagement',
      targetId: id,
      metadata: { agreedTotal },
    });

    return this.getEngagement(actor, id);
  },

  async submit(actor: AuthUser, id: string) {
    const row = await fetchEngagement(actor, id);
    ensureCanEdit(actor, row);
    if (row.approval_status !== 'draft' && row.approval_status !== 'rejected') {
      throw new AppError(409, 'This labour record cannot be submitted.', 'INVALID_STATE');
    }
    await pool.query(
      `UPDATE labour_engagements
       SET approval_status = 'submitted', submitted_by = ?, submitted_at = now(),
           rejected_by = NULL, rejected_at = NULL, rejection_reason = NULL, updated_at = now()
       WHERE id = ? AND organization_id = ?`,
      [actor.id, id, row.organization_id],
    );
    await recordAudit({
      actorUserId: actor.id,
      organizationId: row.organization_id,
      action: 'labour.submitted',
      targetType: 'labour_engagement',
      targetId: id,
    });
    return this.getEngagement(actor, id);
  },

  async approve(actor: AuthUser, id: string) {
    const row = await fetchEngagement(actor, id);
    if (row.approval_status !== 'submitted') {
      throw new AppError(409, 'Only submitted labour records can be approved.', 'INVALID_STATE');
    }
    const { role } = requireOrgContext(actor);
    if (row.recorded_by === actor.id && role !== 'organization_administrator') {
      throw new AppError(403, 'You cannot approve a labour record you created.', 'SELF_APPROVAL');
    }
    await pool.query(
      `UPDATE labour_engagements
       SET approval_status = 'approved', approved_by = ?, approved_at = now(), updated_at = now()
       WHERE id = ? AND organization_id = ?`,
      [actor.id, id, row.organization_id],
    );
    await recordAudit({
      actorUserId: actor.id,
      organizationId: row.organization_id,
      action: 'labour.approved',
      targetType: 'labour_engagement',
      targetId: id,
      metadata: { agreedTotal: num(row.agreed_total) },
    });
    return this.getEngagement(actor, id);
  },

  async reject(actor: AuthUser, id: string, reason: string) {
    const row = await fetchEngagement(actor, id);
    if (row.approval_status !== 'submitted') {
      throw new AppError(409, 'Only submitted labour records can be rejected.', 'INVALID_STATE');
    }
    await pool.query(
      `UPDATE labour_engagements
       SET approval_status = 'rejected', rejected_by = ?, rejected_at = now(),
           rejection_reason = ?, updated_at = now()
       WHERE id = ? AND organization_id = ?`,
      [actor.id, reason, id, row.organization_id],
    );
    await recordAudit({
      actorUserId: actor.id,
      organizationId: row.organization_id,
      action: 'labour.rejected',
      targetType: 'labour_engagement',
      targetId: id,
      metadata: { reason },
    });
    return this.getEngagement(actor, id);
  },

  async cancel(actor: AuthUser, id: string, reason: string) {
    const row = await fetchEngagement(actor, id);
    ensureCanEdit(actor, row);
    if (row.approval_status === 'cancelled') {
      throw new AppError(409, 'This labour record is already cancelled.', 'INVALID_STATE');
    }
    if (num(row.paid_total) > 0) {
      throw new AppError(409, 'Reverse the payments before cancelling this labour record.', 'PAYMENTS_EXIST');
    }
    await pool.query(
      `UPDATE labour_engagements
       SET approval_status = 'cancelled', rejection_reason = ?, updated_at = now()
       WHERE id = ? AND organization_id = ?`,
      [reason, id, row.organization_id],
    );
    await recordAudit({
      actorUserId: actor.id,
      organizationId: row.organization_id,
      action: 'labour.cancelled',
      targetType: 'labour_engagement',
      targetId: id,
      metadata: { reason },
    });
    return this.getEngagement(actor, id);
  },

  async addPayment(actor: AuthUser, id: string, input: RecordLabourPaymentInput) {
    const row = await fetchEngagement(actor, id);
    const amount = round2(input.amount);
    let paymentId = '';

    await pool.withTransaction(async (db) => {
      const locked = await db.query<EngagementRow>(
        `SELECT * FROM labour_engagements WHERE id = ? AND organization_id = ? FOR UPDATE`,
        [id, row.organization_id],
      );
      const engagement = locked.rows[0];
      if (!engagement) throw new AppError(404, 'Labour engagement not found.', 'NOT_FOUND');
      if (engagement.approval_status !== 'approved') {
        throw new AppError(
          409,
          'Only approved labour records can be paid. Approval and payment are separate.',
          'INVALID_STATE',
        );
      }
      const paid = await db.query<{ total: string | number }>(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM labour_payments
         WHERE engagement_id = ? AND organization_id = ?`,
        [id, row.organization_id],
      );
      const remaining = round2(num(engagement.agreed_total) - num(paid.rows[0]?.total));
      if (amount > remaining + 0.005) {
        throw new AppError(
          400,
          `The payment exceeds the outstanding balance of ${remaining.toFixed(2)}.`,
          'OVERPAYMENT',
        );
      }

      const expenseId = await createLinkedExpense(db, {
        organizationId: row.organization_id,
        farmId: engagement.farm_id,
        fieldId: engagement.field_id,
        taskId: engagement.task_id,
        categoryCode: 'labour_payment',
        expenseDate: input.paidOn,
        description: `External labour payment: ${row.labourer_name} - ${engagement.work_type}`,
        amount,
        amountPaid: amount,
        supplier: row.labourer_name,
        paymentMethod: input.method ?? null,
        paymentReference: input.reference ?? null,
        recordedBy: actor.id,
        approved: true,
        notes: input.notes ?? null,
      });

      paymentId = uid();
      await db.query(
        `INSERT INTO labour_payments
           (id, organization_id, engagement_id, amount, paid_on, method, reference,
            notes, expense_id, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentId,
          row.organization_id,
          id,
          amount,
          input.paidOn,
          input.method ?? null,
          input.reference ?? null,
          input.notes ?? null,
          expenseId,
          actor.id,
        ],
      );
    });

    await recordAudit({
      actorUserId: actor.id,
      organizationId: row.organization_id,
      action: 'labour.payment_recorded',
      targetType: 'labour_engagement',
      targetId: id,
      metadata: { amount, paidOn: input.paidOn, paymentId },
    });

    return this.getEngagement(actor, id);
  },

  async listPayments(actor: AuthUser, engagementId: string) {
    const row = await fetchEngagement(actor, engagementId);
    const result = await pool.query(
      `SELECT lp.id, lp.amount, lp.paid_on, lp.method, lp.reference, lp.notes,
              lp.expense_id, lp.recorded_by, u.name AS recorded_by_name, lp.created_at
       FROM labour_payments lp
       LEFT JOIN users u ON u.id = lp.recorded_by
       WHERE lp.engagement_id = ? AND lp.organization_id = ?
       ORDER BY lp.paid_on DESC, lp.created_at DESC`,
      [engagementId, row.organization_id],
    );
    return result.rows.map((payment) => ({
      id: payment.id as string,
      amount: num(payment.amount),
      paidOn: formatDateOnly(payment.paid_on as string | Date),
      method: payment.method as string | null,
      reference: payment.reference as string | null,
      notes: payment.notes as string | null,
      expenseId: payment.expense_id as string | null,
      recordedBy: payment.recorded_by as string | null,
      recordedByName: payment.recorded_by_name as string | null,
      createdAt: formatDateTime(payment.created_at as string | Date),
    }));
  },
};
