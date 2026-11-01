import { pool, uid } from '../database/pool.js';
import type { AuthUser } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';
import { formatDateOnly, formatDateTime } from '../utils/dates.js';
import { num, round2 } from '../utils/numbers.js';
import { recordAudit } from './audit.service.js';
import { assertFarmAccess, farmScope, requireOrgContext } from './finance-access.js';

interface Period {
  dateFrom: string;
  dateTo: string;
}

function resolvePeriod(query: { dateFrom?: string; dateTo?: string }): Period {
  const today = formatDateOnly(new Date())!;
  const dateTo = query.dateTo ?? today;
  const dateFrom = query.dateFrom ?? `${dateTo.slice(0, 8)}01`;
  if (dateFrom > dateTo) {
    throw new AppError(400, 'The start date must be on or before the end date.', 'VALIDATION_ERROR');
  }
  return { dateFrom, dateTo };
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

function lastMonths(count: number): string[] {
  const months: string[] = [];
  const date = new Date();
  date.setDate(1);
  for (let i = count - 1; i >= 0; i -= 1) {
    const item = new Date(date.getFullYear(), date.getMonth() - i, 1);
    months.push(`${item.getFullYear()}-${String(item.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

export const financialService = {
  async overview(actor: AuthUser, query: { farmId?: string; dateFrom?: string; dateTo?: string }) {
    const { organizationId } = requireOrgContext(actor);
    const { dateFrom, dateTo } = resolvePeriod(query);
    const scope = farmScope(actor, 'f');
    const farmFilter = query.farmId ? ' AND e.farm_id = ?' : '';
    const baseValues = [organizationId, ...scope.params];
    const extra = query.farmId ? [query.farmId] : [];

    const expenseWhere = `e.organization_id = ? AND ${scope.clause}
      AND e.approval_status = 'approved' AND e.expense_date BETWEEN ? AND ?${farmFilter}`;
    const expenseValues = [...baseValues, dateFrom, dateTo, ...extra];

    const [totals, pending, unpaid, labour, chemicalAlerts, budget, farms, categories, trend, recent] =
      await Promise.all([
        pool.query(
          `SELECT COALESCE(SUM(e.amount), 0) AS total,
                  COALESCE(SUM(CASE WHEN c.module = 'chemical' THEN e.amount ELSE 0 END), 0) AS chemical,
                  COALESCE(SUM(CASE WHEN c.module = 'labour' THEN e.amount ELSE 0 END), 0) AS labour,
                  COALESCE(SUM(CASE WHEN c.module = 'other' THEN e.amount ELSE 0 END), 0) AS other,
                  COUNT(*) AS count
           FROM expenses e
           JOIN farms f ON f.id = e.farm_id
           JOIN expense_categories c ON c.id = e.category_id
           WHERE ${expenseWhere}`,
          expenseValues,
        ),
        pool.query(
          `SELECT COUNT(*) AS count, COALESCE(SUM(e.amount), 0) AS total
           FROM expenses e
           JOIN farms f ON f.id = e.farm_id
           WHERE e.organization_id = ? AND ${scope.clause}
             AND e.approval_status = 'submitted'${farmFilter}`,
          [...baseValues, ...extra],
        ),
        pool.query(
          `SELECT COUNT(*) AS count, COALESCE(SUM(e.amount - e.amount_paid), 0) AS total
           FROM expenses e
           JOIN farms f ON f.id = e.farm_id
           WHERE e.organization_id = ? AND ${scope.clause}
             AND e.approval_status = 'approved' AND e.amount_paid < e.amount${farmFilter}`,
          [...baseValues, ...extra],
        ),
        pool.query(
          `SELECT COALESCE(SUM(e.agreed_total - COALESCE(
                    (SELECT SUM(lp.amount) FROM labour_payments lp WHERE lp.engagement_id = e.id), 0)), 0) AS outstanding
           FROM labour_engagements e
           JOIN farms f ON f.id = e.farm_id
           WHERE e.organization_id = ? AND ${scope.clause}
             AND e.approval_status = 'approved'${farmFilter}`,
          [...baseValues, ...extra],
        ),
        pool.query(
          `SELECT
             SUM(CASE WHEN available_stock <= minimum_stock THEN 1 ELSE 0 END) AS low_stock,
             SUM(CASE WHEN expiry_date IS NOT NULL
                       AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS expiring
           FROM chemical_products
           WHERE organization_id = ? AND is_active = 1`,
          [organizationId],
        ),
        pool.query(
          `SELECT COALESCE(SUM(b.amount), 0) AS total
           FROM farm_budgets b
           JOIN farms f ON f.id = b.farm_id
           WHERE b.organization_id = ? AND ${scope.clause}
             AND b.period_end >= ? AND b.period_start <= ?
             ${query.farmId ? 'AND b.farm_id = ?' : ''}`,
          [...baseValues, dateFrom, dateTo, ...extra],
        ),
        pool.query(
          `SELECT COUNT(*) AS count FROM farms f WHERE ${scope.clause}`,
          scope.params,
        ),
        pool.query(
          `SELECT c.id, c.name, c.module, COALESCE(SUM(e.amount), 0) AS total, COUNT(*) AS count
           FROM expenses e
           JOIN farms f ON f.id = e.farm_id
           JOIN expense_categories c ON c.id = e.category_id
           WHERE ${expenseWhere}
           GROUP BY c.id, c.name, c.module
           ORDER BY total DESC
           LIMIT 5`,
          expenseValues,
        ),
        pool.query(
          `SELECT DATE_FORMAT(e.expense_date, '%Y-%m') AS month,
                  COALESCE(SUM(e.amount), 0) AS total
           FROM expenses e
           JOIN farms f ON f.id = e.farm_id
           WHERE e.organization_id = ? AND ${scope.clause}
             AND e.approval_status = 'approved'
             AND e.expense_date >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
             ${farmFilter}
           GROUP BY month
           ORDER BY month`,
          [...baseValues, ...extra],
        ),
        pool.query(
          `SELECT e.id, e.expense_date, e.description, e.amount, e.amount_paid,
                  e.approval_status, c.name AS category_name, c.module AS category_module,
                  f.name AS farm_name
           FROM expenses e
           JOIN farms f ON f.id = e.farm_id
           JOIN expense_categories c ON c.id = e.category_id
           WHERE e.organization_id = ? AND ${scope.clause}
             AND e.approval_status IN ('approved', 'submitted')${farmFilter}
           ORDER BY e.expense_date DESC, e.created_at DESC
           LIMIT 6`,
          [...baseValues, ...extra],
        ),
      ]);

    const totalRow = totals.rows[0] ?? {};
    const totalSpend = num(totalRow.total);
    const budgetTotal = num(budget.rows[0]?.total);
    const trendMap = new Map(
      trend.rows.map((row) => [String(row.month), num(row.total)]),
    );
    const months = lastMonths(6);

    return {
      period: { dateFrom, dateTo },
      cards: {
        totalSpend,
        chemicalSpend: num(totalRow.chemical),
        labourSpend: num(totalRow.labour),
        otherSpend: num(totalRow.other),
        expenseCount: Number(totalRow.count ?? 0),
        budget: budgetTotal,
        budgetVariance: round2(budgetTotal - totalSpend),
        budgetUtilisation:
          budgetTotal > 0 ? Math.round((totalSpend / budgetTotal) * 1000) / 10 : null,
        pendingApprovalCount: Number(pending.rows[0]?.count ?? 0),
        pendingApprovalValue: num(pending.rows[0]?.total),
        unpaidValue: num(unpaid.rows[0]?.total),
        unpaidCount: Number(unpaid.rows[0]?.count ?? 0),
        outstandingLabour: num(labour.rows[0]?.outstanding),
        lowStockCount: Number(chemicalAlerts.rows[0]?.low_stock ?? 0),
        expiringCount: Number(chemicalAlerts.rows[0]?.expiring ?? 0),
        farmCount: Number(farms.rows[0]?.count ?? 0),
      },
      topCategories: categories.rows.map((row) => ({
        id: row.id as string,
        name: row.name as string,
        module: row.module as string,
        total: num(row.total),
        count: Number(row.count ?? 0),
      })),
      monthlyTrend: months.map((month) => ({ month, total: trendMap.get(month) ?? 0 })),
      recentExpenses: recent.rows.map((row) => ({
        id: row.id as string,
        expenseDate: formatDateOnly(row.expense_date as string | Date),
        description: row.description as string,
        amount: num(row.amount),
        amountPaid: num(row.amount_paid),
        approvalStatus: row.approval_status as string,
        categoryName: row.category_name as string,
        categoryModule: row.category_module as string,
        farmName: row.farm_name as string,
      })),
    };
  },

  async costAnalysis(
    actor: AuthUser,
    query: { farmId?: string; dateFrom?: string; dateTo?: string; groupBy: 'farm' | 'field' | 'category' },
  ) {
    const { organizationId } = requireOrgContext(actor);
    const { dateFrom, dateTo } = resolvePeriod(query);
    const scope = farmScope(actor, 'f');

    if (query.groupBy === 'category') {
      const result = await pool.query(
        `SELECT c.id, c.name, c.module,
                COALESCE(SUM(e.amount), 0) AS total, COUNT(*) AS count
         FROM expenses e
         JOIN farms f ON f.id = e.farm_id
         JOIN expense_categories c ON c.id = e.category_id
         WHERE e.organization_id = ? AND ${scope.clause}
           AND e.approval_status = 'approved' AND e.expense_date BETWEEN ? AND ?
           ${query.farmId ? 'AND e.farm_id = ?' : ''}
         GROUP BY c.id, c.name, c.module
         ORDER BY total DESC`,
        [organizationId, ...scope.params, dateFrom, dateTo, ...(query.farmId ? [query.farmId] : [])],
      );
      return {
        period: { dateFrom, dateTo },
        groupBy: query.groupBy,
        groups: result.rows.map((row) => ({
          id: row.id as string,
          name: row.name as string,
          module: row.module as string,
          total: num(row.total),
          count: Number(row.count ?? 0),
        })),
      };
    }

    if (query.groupBy === 'field') {
      const result = await pool.query(
        `SELECT COALESCE(fl.id, '__unallocated__') AS id,
                COALESCE(fl.name, 'Unallocated') AS name,
                f.id AS farm_id, f.name AS farm_name,
                COALESCE(SUM(e.amount), 0) AS total,
                COALESCE(SUM(CASE WHEN c.module = 'chemical' THEN e.amount ELSE 0 END), 0) AS chemical,
                COALESCE(SUM(CASE WHEN c.module = 'labour' THEN e.amount ELSE 0 END), 0) AS labour,
                COALESCE(SUM(CASE WHEN c.module = 'other' THEN e.amount ELSE 0 END), 0) AS other,
                COUNT(*) AS count
         FROM expenses e
         JOIN farms f ON f.id = e.farm_id
         LEFT JOIN fields fl ON fl.id = e.field_id
         JOIN expense_categories c ON c.id = e.category_id
         WHERE e.organization_id = ? AND ${scope.clause}
           AND e.approval_status = 'approved' AND e.expense_date BETWEEN ? AND ?
           ${query.farmId ? 'AND e.farm_id = ?' : ''}
         GROUP BY fl.id, fl.name, f.id, f.name
         ORDER BY total DESC`,
        [organizationId, ...scope.params, dateFrom, dateTo, ...(query.farmId ? [query.farmId] : [])],
      );
      return {
        period: { dateFrom, dateTo },
        groupBy: query.groupBy,
        groups: result.rows.map((row) => ({
          id: row.id as string,
          name: row.name as string,
          farmId: row.farm_id as string,
          farmName: row.farm_name as string,
          total: num(row.total),
          chemical: num(row.chemical),
          labour: num(row.labour),
          other: num(row.other),
          count: Number(row.count ?? 0),
          budget: null,
          variance: null,
          utilisation: null,
          perSizeUnit: null,
        })),
      };
    }

    const result = await pool.query(
      `SELECT f.id, f.name, f.size, f.size_unit,
              COALESCE(SUM(e.amount), 0) AS total,
              COALESCE(SUM(CASE WHEN c.module = 'chemical' THEN e.amount ELSE 0 END), 0) AS chemical,
              COALESCE(SUM(CASE WHEN c.module = 'labour' THEN e.amount ELSE 0 END), 0) AS labour,
              COALESCE(SUM(CASE WHEN c.module = 'other' THEN e.amount ELSE 0 END), 0) AS other,
              COUNT(e.id) AS count,
              (SELECT COALESCE(SUM(b.amount), 0) FROM farm_budgets b
               WHERE b.farm_id = f.id AND b.period_end >= ? AND b.period_start <= ?) AS budget
       FROM farms f
       LEFT JOIN expenses e ON e.farm_id = f.id AND e.organization_id = ?
         AND e.approval_status = 'approved' AND e.expense_date BETWEEN ? AND ?
       LEFT JOIN expense_categories c ON c.id = e.category_id
       WHERE ${scope.clause}
         ${query.farmId ? 'AND f.id = ?' : ''}
       GROUP BY f.id, f.name, f.size, f.size_unit
       ORDER BY total DESC`,
      [
        dateFrom,
        dateTo,
        organizationId,
        dateFrom,
        dateTo,
        ...scope.params,
        ...(query.farmId ? [query.farmId] : []),
      ],
    );

    return {
      period: { dateFrom, dateTo },
      groupBy: query.groupBy,
      groups: result.rows.map((row) => {
        const total = num(row.total);
        const budget = num(row.budget);
        const size = row.size === null ? 0 : num(row.size);
        return {
          id: row.id as string,
          name: row.name as string,
          farmId: row.id as string,
          farmName: row.name as string,
          size,
          sizeUnit: row.size_unit as string | null,
          total,
          chemical: num(row.chemical),
          labour: num(row.labour),
          other: num(row.other),
          count: Number(row.count ?? 0),
          budget,
          variance: round2(budget - total),
          utilisation: budget > 0 ? Math.round((total / budget) * 1000) / 10 : null,
          perSizeUnit: size > 0 ? round2(total / size) : null,
        };
      }),
    };
  },

  async listBudgets(actor: AuthUser, query: { farmId?: string; dateFrom?: string; dateTo?: string }) {
    const { organizationId } = requireOrgContext(actor);
    const scope = farmScope(actor, 'f');
    const conditions = [scope.clause, 'b.organization_id = ?'];
    const values: unknown[] = [...scope.params, organizationId];
    if (query.farmId) {
      conditions.push('b.farm_id = ?');
      values.push(query.farmId);
    }
    if (query.dateFrom) {
      conditions.push('b.period_end >= ?');
      values.push(query.dateFrom);
    }
    if (query.dateTo) {
      conditions.push('b.period_start <= ?');
      values.push(query.dateTo);
    }
    const result = await pool.query(
      `SELECT b.*, f.name AS farm_name
       FROM farm_budgets b
       JOIN farms f ON f.id = b.farm_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY b.period_start DESC, f.name ASC`,
      values,
    );
    return result.rows.map((row) => ({
      id: row.id as string,
      farmId: row.farm_id as string,
      farmName: row.farm_name as string,
      periodStart: formatDateOnly(row.period_start as string | Date),
      periodEnd: formatDateOnly(row.period_end as string | Date),
      amount: num(row.amount),
      notes: row.notes as string | null,
      createdAt: formatDateTime(row.created_at as string | Date),
    }));
  },

  async upsertBudget(
    actor: AuthUser,
    input: { farmId: string; periodStart: string; periodEnd: string; amount: number; notes?: string | null },
  ) {
    const { organizationId } = requireOrgContext(actor);
    await assertFarmAccess(actor, input.farmId);

    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM farm_budgets
       WHERE farm_id = ? AND period_start = ? AND period_end = ?`,
      [input.farmId, input.periodStart, input.periodEnd],
    );
    const id = existing.rows[0]?.id ?? uid();
    await pool.query(
      `INSERT INTO farm_budgets
         (id, organization_id, farm_id, period_start, period_end, amount, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount), notes = VALUES(notes), updated_at = now()`,
      [
        id,
        organizationId,
        input.farmId,
        input.periodStart,
        input.periodEnd,
        input.amount,
        input.notes ?? null,
        actor.id,
      ],
    );
    await recordAudit({
      actorUserId: actor.id,
      organizationId,
      action: 'budget.upserted',
      targetType: 'farm_budget',
      targetId: id,
      metadata: {
        farmId: input.farmId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        amount: input.amount,
      },
    });
    return { id, ...input };
  },

  async export(actor: AuthUser, type: string, query: { farmId?: string; dateFrom?: string; dateTo?: string }) {
    const { organizationId } = requireOrgContext(actor);
    const { dateFrom, dateTo } = resolvePeriod(query);
    const scope = farmScope(actor, 'f');

    if (type === 'expenses') {
      const result = await pool.query(
        `SELECT e.expense_date, e.description, c.name AS category, c.module,
                f.name AS farm, fl.name AS field, e.amount, e.amount_paid,
                e.approval_status, e.supplier, e.payment_reference, e.notes
         FROM expenses e
         JOIN farms f ON f.id = e.farm_id
         JOIN expense_categories c ON c.id = e.category_id
         LEFT JOIN fields fl ON fl.id = e.field_id
         WHERE e.organization_id = ? AND ${scope.clause}
           AND e.expense_date BETWEEN ? AND ? AND e.approval_status <> 'cancelled'
           ${query.farmId ? 'AND e.farm_id = ?' : ''}
         ORDER BY e.expense_date DESC`,
        [organizationId, ...scope.params, dateFrom, dateTo, ...(query.farmId ? [query.farmId] : [])],
      );
      return {
        filename: `expenses-${dateFrom}-to-${dateTo}.csv`,
        csv: toCsv(
          ['Date', 'Description', 'Category', 'Module', 'Farm', 'Field', 'Amount', 'Amount paid', 'Approval', 'Supplier', 'Reference', 'Notes'],
          result.rows.map((row) => [
            formatDateOnly(row.expense_date as string | Date),
            row.description,
            row.category,
            row.module,
            row.farm,
            row.field,
            num(row.amount).toFixed(2),
            num(row.amount_paid).toFixed(2),
            row.approval_status,
            row.supplier,
            row.payment_reference,
            row.notes,
          ]),
        ),
      };
    }

    if (type === 'chemical-usage') {
      const result = await pool.query(
        `SELECT cu.usage_date, p.name AS product, p.batch_number, f.name AS farm,
                fl.name AS field, cu.crop, cu.quantity_used, cu.unit,
                cu.quantity_deducted, cu.stock_unit, cu.area_treated, cu.area_unit,
                cu.application_method, cu.applied_by, cu.total_cost_at_use, cu.cancelled_at
         FROM chemical_usage cu
         JOIN chemical_products p ON p.id = cu.product_id
         JOIN farms f ON f.id = cu.farm_id
         LEFT JOIN fields fl ON fl.id = cu.field_id
         WHERE cu.organization_id = ? AND ${scope.clause}
           AND cu.usage_date BETWEEN ? AND ?
           ${query.farmId ? 'AND cu.farm_id = ?' : ''}
         ORDER BY cu.usage_date DESC`,
        [organizationId, ...scope.params, dateFrom, dateTo, ...(query.farmId ? [query.farmId] : [])],
      );
      return {
        filename: `chemical-usage-${dateFrom}-to-${dateTo}.csv`,
        csv: toCsv(
          ['Date', 'Product', 'Batch', 'Farm', 'Field', 'Crop', 'Quantity used', 'Unit', 'Stock deducted', 'Stock unit', 'Area', 'Area unit', 'Method', 'Applied by', 'Cost at use', 'Cancelled'],
          result.rows.map((row) => [
            formatDateOnly(row.usage_date as string | Date),
            row.product,
            row.batch_number,
            row.farm,
            row.field,
            row.crop,
            num(row.quantity_used),
            row.unit,
            num(row.quantity_deducted),
            row.stock_unit,
            row.area_treated === null ? '' : num(row.area_treated),
            row.area_unit,
            row.application_method,
            row.applied_by,
            row.total_cost_at_use === null ? '' : num(row.total_cost_at_use).toFixed(2),
            row.cancelled_at ? 'yes' : 'no',
          ]),
        ),
      };
    }

    if (type === 'chemical-stock') {
      const result = await pool.query(
        `SELECT name, batch_number, active_ingredient, unit, quantity_received,
                available_stock, minimum_stock, purchase_cost, storage_location,
                purchase_date, expiry_date, is_active
         FROM chemical_products
         WHERE organization_id = ?
         ORDER BY name ASC, expiry_date ASC`,
        [organizationId],
      );
      return {
        filename: `chemical-stock-${dateFrom}-to-${dateTo}.csv`,
        csv: toCsv(
          ['Product', 'Batch', 'Active ingredient', 'Unit', 'Received', 'Available', 'Minimum', 'Purchase cost', 'Storage', 'Purchased', 'Expires', 'Active'],
          result.rows.map((row) => [
            row.name,
            row.batch_number,
            row.active_ingredient,
            row.unit,
            num(row.quantity_received),
            num(row.available_stock),
            num(row.minimum_stock),
            num(row.purchase_cost).toFixed(2),
            row.storage_location,
            formatDateOnly(row.purchase_date as string | Date | null),
            formatDateOnly(row.expiry_date as string | Date | null),
            row.is_active ? 'yes' : 'no',
          ]),
        ),
      };
    }

    if (type === 'labour-engagements' || type === 'labour-payments') {
      const payments = type === 'labour-payments';
      const result = await pool.query(
        payments
          ? `SELECT lp.paid_on, l.name AS labourer, e.work_type, f.name AS farm,
                    lp.amount, lp.method, lp.reference, lp.notes
             FROM labour_payments lp
             JOIN labour_engagements e ON e.id = lp.engagement_id
             JOIN farms f ON f.id = e.farm_id
             JOIN external_labourers l ON l.id = e.labourer_id
             WHERE lp.organization_id = ? AND ${scope.clause}
               AND lp.paid_on BETWEEN ? AND ?
               ${query.farmId ? 'AND e.farm_id = ?' : ''}
             ORDER BY lp.paid_on DESC`
          : `SELECT e.start_date, e.completion_date, l.name AS labourer, e.work_type,
                    f.name AS farm, fl.name AS field, e.agreed_total,
                    COALESCE((SELECT SUM(lp.amount) FROM labour_payments lp
                              WHERE lp.engagement_id = e.id), 0) AS paid_total,
                    e.approval_status, e.pricing_method, e.notes
             FROM labour_engagements e
             JOIN farms f ON f.id = e.farm_id
             JOIN external_labourers l ON l.id = e.labourer_id
             LEFT JOIN fields fl ON fl.id = e.field_id
             WHERE e.organization_id = ? AND ${scope.clause}
               AND DATE(COALESCE(e.start_date, e.created_at)) BETWEEN ? AND ?
               ${query.farmId ? 'AND e.farm_id = ?' : ''}
             ORDER BY COALESCE(e.start_date, e.created_at) DESC`,
        [organizationId, ...scope.params, dateFrom, dateTo, ...(query.farmId ? [query.farmId] : [])],
      );
      return payments
        ? {
            filename: `labour-payments-${dateFrom}-to-${dateTo}.csv`,
            csv: toCsv(
              ['Paid on', 'Labourer', 'Work', 'Farm', 'Amount', 'Method', 'Reference', 'Notes'],
              result.rows.map((row) => [
                formatDateOnly(row.paid_on as string | Date),
                row.labourer,
                row.work_type,
                row.farm,
                num(row.amount).toFixed(2),
                row.method,
                row.reference,
                row.notes,
              ]),
            ),
          }
        : {
            filename: `labour-engagements-${dateFrom}-to-${dateTo}.csv`,
            csv: toCsv(
              ['Start', 'Completed', 'Labourer', 'Work', 'Farm', 'Field', 'Agreed total', 'Paid', 'Outstanding', 'Approval', 'Pricing', 'Notes'],
              result.rows.map((row) => [
                formatDateOnly(row.start_date as string | Date | null),
                formatDateOnly(row.completion_date as string | Date | null),
                row.labourer,
                row.work_type,
                row.farm,
                row.field,
                num(row.agreed_total).toFixed(2),
                num(row.paid_total).toFixed(2),
                round2(num(row.agreed_total) - num(row.paid_total)).toFixed(2),
                row.approval_status,
                row.pricing_method,
                row.notes,
              ]),
            ),
          };
    }

    if (type === 'outstanding-payments') {
      const expenses = await pool.query(
        `SELECT e.expense_date, e.description, f.name AS farm, e.amount, e.amount_paid,
                (e.amount - e.amount_paid) AS outstanding, e.approval_status
         FROM expenses e
         JOIN farms f ON f.id = e.farm_id
         WHERE e.organization_id = ? AND ${scope.clause}
           AND e.approval_status = 'approved' AND e.amount_paid < e.amount
           ${query.farmId ? 'AND e.farm_id = ?' : ''}
         ORDER BY e.expense_date DESC`,
        [organizationId, ...scope.params, ...(query.farmId ? [query.farmId] : [])],
      );
      const labour = await pool.query(
        `SELECT e.start_date, l.name AS labourer, e.work_type, f.name AS farm,
                e.agreed_total,
                COALESCE((SELECT SUM(lp.amount) FROM labour_payments lp
                          WHERE lp.engagement_id = e.id), 0) AS paid_total
         FROM labour_engagements e
         JOIN farms f ON f.id = e.farm_id
         JOIN external_labourers l ON l.id = e.labourer_id
         WHERE e.organization_id = ? AND ${scope.clause}
           AND e.approval_status = 'approved'
           AND (SELECT COALESCE(SUM(lp.amount), 0) FROM labour_payments lp
                WHERE lp.engagement_id = e.id) < e.agreed_total
           ${query.farmId ? 'AND e.farm_id = ?' : ''}
         ORDER BY e.start_date DESC`,
        [organizationId, ...scope.params, ...(query.farmId ? [query.farmId] : [])],
      );
      const rows: unknown[][] = [
        ...expenses.rows.map((row) => [
          'Expense',
          formatDateOnly(row.expense_date as string | Date),
          row.description,
          row.farm,
          num(row.amount).toFixed(2),
          num(row.amount_paid).toFixed(2),
          num(row.outstanding).toFixed(2),
        ]),
        ...labour.rows.map((row) => [
          'Labour',
          formatDateOnly(row.start_date as string | Date | null) ?? '',
          `${row.work_type} (${row.labourer})`,
          row.farm,
          num(row.agreed_total).toFixed(2),
          num(row.paid_total).toFixed(2),
          round2(num(row.agreed_total) - num(row.paid_total)).toFixed(2),
        ]),
      ];
      return {
        filename: `outstanding-payments-${dateFrom}-to-${dateTo}.csv`,
        csv: toCsv(['Type', 'Date', 'Description', 'Farm', 'Total', 'Paid', 'Outstanding'], rows),
      };
    }

    if (type === 'budget-vs-actual' || type === 'farm-cost-summary') {
      const analysis = await this.costAnalysis(actor, {
        dateFrom,
        dateTo,
        farmId: query.farmId,
        groupBy: 'farm',
      });
      const groups = analysis.groups as Array<{
        id: string;
        name: string;
        farmId: string;
        farmName: string;
        size?: number | null;
        sizeUnit?: string | null;
        total: number;
        chemical: number;
        labour: number;
        other: number;
        count: number;
        budget?: number | null;
        variance?: number | null;
        utilisation?: number | null;
        perSizeUnit?: number | null;
      }>;
      const budgetReport = type === 'budget-vs-actual';
      return {
        filename: `${type}-${dateFrom}-to-${dateTo}.csv`,
        csv: toCsv(
          budgetReport
            ? ['Farm', 'Budget', 'Actual', 'Variance', 'Utilisation %', 'Chemical', 'Labour', 'Other']
            : ['Farm', 'Size', 'Size unit', 'Total', 'Chemical', 'Labour', 'Other', 'Cost per unit', 'Count'],
          groups.map((group) =>
            budgetReport
              ? [
                  group.farmName,
                  (group.budget ?? 0).toFixed(2),
                  group.total.toFixed(2),
                  (group.variance ?? 0).toFixed(2),
                  group.utilisation === null ? '' : group.utilisation,
                  group.chemical.toFixed(2),
                  group.labour.toFixed(2),
                  group.other.toFixed(2),
                ]
              : [
                  group.farmName,
                  group.size,
                  group.sizeUnit,
                  group.total.toFixed(2),
                  group.chemical.toFixed(2),
                  group.labour.toFixed(2),
                  group.other.toFixed(2),
                  group.perSizeUnit ?? '',
                  group.count,
                ],
          ),
        ),
      };
    }

    throw new AppError(400, 'Unknown report type.', 'UNKNOWN_REPORT');
  },
};
