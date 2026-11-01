import { pool, uid } from '../database/pool.js';
import type { AuthUser } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';
import { formatDateOnly, formatDateTime } from '../utils/dates.js';
import { nextStockBalance, unitCostFromPurchase } from '../utils/finance-calc.js';
import { num, round2, round3 } from '../utils/numbers.js';
import { convertQuantity } from '../utils/units.js';
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
  ChemicalMovementInput,
  ChemicalUsageInput,
  CreateChemicalInput,
  UpdateChemicalInput,
} from '../validations/finance.schema.js';

interface ProductRow {
  id: string;
  organization_id: string;
  name: string;
  active_ingredient: string | null;
  formulation: string | null;
  intended_use: string | null;
  supplier: string | null;
  batch_number: string | null;
  purchase_date: string | Date | null;
  expiry_date: string | Date | null;
  quantity_received: string | number;
  unit: string;
  purchase_cost: string | number;
  storage_location: string | null;
  available_stock: string | number;
  minimum_stock: string | number;
  safety_instructions: string | null;
  receipt_url: string | null;
  notes: string | null;
  is_active: boolean | number;
  created_at: string | Date;
  updated_at: string | Date;
  usage_count?: string | number;
}

function unitCostOf(row: ProductRow): number {
  return unitCostFromPurchase(num(row.quantity_received), num(row.purchase_cost));
}

function daysUntil(date: string | Date | null): number | null {
  if (!date) return null;
  const value = date instanceof Date ? date : new Date(`${String(date).slice(0, 10)}T00:00:00`);
  const today = new Date();
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  return Math.round((target.getTime() - midnight.getTime()) / 86_400_000);
}

function stockStatus(available: number, minimum: number): 'out' | 'low' | 'in_stock' {
  if (available <= 0) return 'out';
  if (available <= minimum) return 'low';
  return 'in_stock';
}

function mapProduct(row: ProductRow) {
  const available = num(row.available_stock);
  const minimum = num(row.minimum_stock);
  const expiryDays = daysUntil(row.expiry_date);
  return {
    id: row.id,
    name: row.name,
    activeIngredient: row.active_ingredient,
    formulation: row.formulation,
    intendedUse: row.intended_use,
    supplier: row.supplier,
    batchNumber: row.batch_number,
    purchaseDate: formatDateOnly(row.purchase_date),
    expiryDate: formatDateOnly(row.expiry_date),
    quantityReceived: num(row.quantity_received),
    unit: row.unit,
    purchaseCost: num(row.purchase_cost),
    unitCost: unitCostOf(row),
    storageLocation: row.storage_location,
    availableStock: available,
    minimumStock: minimum,
    stockStatus: stockStatus(available, minimum),
    isExpired: expiryDays !== null && expiryDays < 0,
    daysToExpiry: expiryDays,
    safetyInstructions: row.safety_instructions,
    receiptUrl: row.receipt_url,
    notes: row.notes,
    isActive: Boolean(row.is_active),
    usageCount: Number(row.usage_count ?? 0),
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
  };
}

async function fetchProduct(actor: AuthUser, id: string): Promise<ProductRow> {
  const { organizationId } = requireOrgContext(actor);
  const result = await pool.query<ProductRow>(
    `SELECT p.*, (SELECT COUNT(*) FROM chemical_usage cu
                  WHERE cu.product_id = p.id AND cu.cancelled_at IS NULL) AS usage_count
     FROM chemical_products p
     WHERE p.id = ? AND p.organization_id = ?`,
    [id, organizationId],
  );
  const product = result.rows[0];
  if (!product) throw new AppError(404, 'Chemical product not found.', 'NOT_FOUND');
  return product;
}

async function listMovements(organizationId: string, productId: string, limit = 25) {
  const result = await pool.query(
    `SELECT m.id, m.movement_type, m.quantity_change, m.balance_after, m.unit_cost,
            m.farm_id, m.field_id, m.storage_location, m.reference, m.note,
            m.recorded_by, u.name AS recorded_by_name, m.created_at
     FROM chemical_stock_movements m
     LEFT JOIN users u ON u.id = m.recorded_by
     WHERE m.organization_id = ? AND m.product_id = ?
     ORDER BY m.created_at DESC
     LIMIT ?`,
    [organizationId, productId, limit],
  );
  return result.rows.map((row) => ({
    id: row.id as string,
    type: row.movement_type as string,
    quantityChange: num(row.quantity_change),
    balanceAfter: num(row.balance_after),
    unitCost: row.unit_cost === null ? null : num(row.unit_cost),
    farmId: row.farm_id as string | null,
    fieldId: row.field_id as string | null,
    storageLocation: row.storage_location as string | null,
    reference: row.reference as string | null,
    note: row.note as string | null,
    recordedBy: row.recorded_by as string | null,
    recordedByName: row.recorded_by_name as string | null,
    createdAt: formatDateTime(row.created_at as string | Date),
  }));
}

export const chemicalService = {
  async list(actor: AuthUser, query: { search?: string; lowStock?: boolean; includeInactive?: boolean; expiringDays?: number; page: number; pageSize: number }) {
    const { organizationId } = requireOrgContext(actor);
    const conditions = ['p.organization_id = ?'];
    const values: unknown[] = [organizationId];

    if (!query.includeInactive) conditions.push('p.is_active = 1');
    if (query.lowStock) conditions.push('p.available_stock <= p.minimum_stock');
    if (query.search) {
      const like = `%${query.search}%`;
      conditions.push(
        '(p.name LIKE ? OR p.active_ingredient LIKE ? OR p.batch_number LIKE ? OR p.supplier LIKE ? OR p.storage_location LIKE ?)',
      );
      values.push(like, like, like, like, like);
    }
    if (query.expiringDays) {
      conditions.push('p.expiry_date IS NOT NULL AND p.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)');
      values.push(query.expiringDays);
    }

    const where = conditions.join(' AND ');
    const [rows, count] = await Promise.all([
      pool.query<ProductRow>(
        `SELECT p.*, (SELECT COUNT(*) FROM chemical_usage cu
                      WHERE cu.product_id = p.id AND cu.cancelled_at IS NULL) AS usage_count
         FROM chemical_products p
         WHERE ${where}
         ORDER BY p.name ASC, p.expiry_date ASC
         LIMIT ? OFFSET ?`,
        [...values, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      pool.query<{ total: string | number }>(
        `SELECT COUNT(*) AS total FROM chemical_products p WHERE ${where}`,
        values,
      ),
    ]);

    return {
      items: rows.rows.map(mapProduct),
      total: Number(count.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  async getById(actor: AuthUser, id: string) {
    const product = await fetchProduct(actor, id);
    const movements = await listMovements(product.organization_id, id);
    return { ...mapProduct(product), movements };
  },

  async create(actor: AuthUser, input: CreateChemicalInput) {
    const { organizationId } = requireOrgContext(actor);
    if (input.farmId) await assertFarmAccess(actor, input.farmId);
    if (input.farmId && input.fieldId) {
      await assertFieldAccess(actor, input.farmId, input.fieldId);
    }

    const id = uid();
    const quantityReceived = round3(input.quantityReceived);
    await pool.withTransaction(async (db) => {
      await db.query(
        `INSERT INTO chemical_products
           (id, organization_id, name, active_ingredient, formulation, intended_use,
            supplier, batch_number, purchase_date, expiry_date, quantity_received, unit,
            purchase_cost, storage_location, available_stock, minimum_stock,
            safety_instructions, receipt_url, notes, is_active, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          id,
          organizationId,
          input.name,
          input.activeIngredient ?? null,
          input.formulation ?? null,
          input.intendedUse ?? null,
          input.supplier ?? null,
          input.batchNumber ?? null,
          input.purchaseDate ?? null,
          input.expiryDate ?? null,
          quantityReceived,
          input.unit,
          input.purchaseCost,
          input.storageLocation ?? null,
          quantityReceived,
          input.minimumStock,
          input.safetyInstructions ?? null,
          input.receiptUrl ?? null,
          input.notes ?? null,
          actor.id,
        ],
      );

      let expenseId: string | null = null;
      if (input.purchaseCost > 0 && input.recordExpense) {
        if (!input.farmId) {
          throw new AppError(
            400,
            'Choose the farm this chemical purchase should be charged to.',
            'INVALID_REFERENCE',
          );
        }
        expenseId = await createLinkedExpense(db, {
          organizationId,
          farmId: input.farmId,
          fieldId: input.fieldId ?? null,
          categoryCode: 'chemical_purchase',
          expenseDate: input.purchaseDate ?? formatDateOnly(new Date())!,
          description: `Chemical purchase: ${input.name}${input.batchNumber ? ` (batch ${input.batchNumber})` : ''}`,
          amount: input.purchaseCost,
          quantity: quantityReceived,
          unit: input.unit,
          unitPrice: quantityReceived > 0 ? unitCostFromPurchase(quantityReceived, input.purchaseCost) : null,
          supplier: input.supplier ?? null,
          recordedBy: actor.id,
          approved: true,
          notes: input.notes ?? null,
        });
      }

      if (quantityReceived > 0) {
        await db.query(
          `INSERT INTO chemical_stock_movements
             (id, organization_id, product_id, movement_type, quantity_change, balance_after,
              unit_cost, farm_id, field_id, storage_location, expense_id, note, recorded_by)
           VALUES (?, ?, ?, 'opening', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uid(),
            organizationId,
            id,
            quantityReceived,
            quantityReceived,
            quantityReceived > 0 ? unitCostFromPurchase(quantityReceived, input.purchaseCost) : null,
            input.farmId ?? null,
            input.fieldId ?? null,
            input.storageLocation ?? null,
            expenseId,
            'Opening stock',
            actor.id,
          ],
        );
      }
    });

    await recordAudit({
      actorUserId: actor.id,
      organizationId,
      action: 'chemical.created',
      targetType: 'chemical_product',
      targetId: id,
      metadata: { name: input.name, unit: input.unit, quantityReceived },
    });

    return this.getById(actor, id);
  },

  async update(actor: AuthUser, id: string, input: UpdateChemicalInput) {
    const product = await fetchProduct(actor, id);
    const sets: string[] = [];
    const values: unknown[] = [];
    const assign = (column: string, value: unknown) => {
      sets.push(`${column} = ?`);
      values.push(value);
    };

    if (input.name !== undefined) assign('name', input.name);
    if (input.activeIngredient !== undefined) assign('active_ingredient', input.activeIngredient ?? null);
    if (input.formulation !== undefined) assign('formulation', input.formulation ?? null);
    if (input.intendedUse !== undefined) assign('intended_use', input.intendedUse ?? null);
    if (input.supplier !== undefined) assign('supplier', input.supplier ?? null);
    if (input.batchNumber !== undefined) assign('batch_number', input.batchNumber ?? null);
    if (input.purchaseDate !== undefined) assign('purchase_date', input.purchaseDate ?? null);
    if (input.expiryDate !== undefined) assign('expiry_date', input.expiryDate ?? null);
    if (input.unit !== undefined) assign('unit', input.unit);
    if (input.purchaseCost !== undefined) assign('purchase_cost', input.purchaseCost);
    if (input.storageLocation !== undefined) assign('storage_location', input.storageLocation ?? null);
    if (input.minimumStock !== undefined) assign('minimum_stock', input.minimumStock);
    if (input.safetyInstructions !== undefined) {
      assign('safety_instructions', input.safetyInstructions ?? null);
    }
    if (input.receiptUrl !== undefined) assign('receipt_url', input.receiptUrl ?? null);
    if (input.notes !== undefined) assign('notes', input.notes ?? null);
    if (input.isActive !== undefined) assign('is_active', input.isActive ? 1 : 0);

    if (sets.length > 0) {
      sets.push('updated_at = now()');
      values.push(id, product.organization_id);
      await pool.query(
        `UPDATE chemical_products SET ${sets.join(', ')}
         WHERE id = ? AND organization_id = ?`,
        values,
      );
      await recordAudit({
        actorUserId: actor.id,
        organizationId: product.organization_id,
        action: 'chemical.updated',
        targetType: 'chemical_product',
        targetId: id,
      });
    }

    return this.getById(actor, id);
  },

  async remove(actor: AuthUser, id: string) {
    const product = await fetchProduct(actor, id);
    await pool.query(
      `UPDATE chemical_products SET is_active = 0, updated_at = now()
       WHERE id = ? AND organization_id = ?`,
      [id, product.organization_id],
    );
    await recordAudit({
      actorUserId: actor.id,
      organizationId: product.organization_id,
      action: 'chemical.archived',
      targetType: 'chemical_product',
      targetId: id,
    });
  },

  async addMovement(actor: AuthUser, id: string, input: ChemicalMovementInput) {
    const { organizationId } = requireOrgContext(actor);
    if (input.farmId) await assertFarmAccess(actor, input.farmId);
    if (input.farmId && input.fieldId) {
      await assertFieldAccess(actor, input.farmId, input.fieldId);
    }

    let movementId = '';
    await pool.withTransaction(async (db) => {
      const result = await db.query<ProductRow>(
        `SELECT * FROM chemical_products WHERE id = ? AND organization_id = ? FOR UPDATE`,
        [id, organizationId],
      );
      const product = result.rows[0];
      if (!product) throw new AppError(404, 'Chemical product not found.', 'NOT_FOUND');

      let change = input.quantity;
      if (input.type === 'adjustment') {
        change = input.direction === 'decrease' ? -input.quantity : input.quantity;
      } else if (['transfer', 'issue', 'expired', 'damaged'].includes(input.type)) {
        change = -input.quantity;
      }
      change = round3(change);

      const newBalance = nextStockBalance(num(product.available_stock), change);
      if (newBalance === null) {
        throw new AppError(
          400,
          'This movement would make the available stock negative.',
          'INSUFFICIENT_STOCK',
        );
      }

      const unitCost =
        input.unitCost ?? (unitCostOf(product) || null);
      let expenseId: string | null = null;
      if (input.type === 'purchase' && input.recordExpense) {
        const total = round2(input.quantity * num(unitCost));
        if (total > 0) {
          if (!input.farmId) {
            throw new AppError(
              400,
              'Choose the farm this purchase should be charged to.',
              'INVALID_REFERENCE',
            );
          }
          expenseId = await createLinkedExpense(db, {
            organizationId,
            farmId: input.farmId,
            fieldId: input.fieldId ?? null,
            categoryCode: 'chemical_purchase',
            expenseDate: formatDateOnly(new Date())!,
            description: `Chemical purchase: ${product.name}${input.reference ? ` (${input.reference})` : ''}`,
            amount: total,
            quantity: input.quantity,
            unit: product.unit,
            unitPrice: unitCost,
            paymentReference: input.reference ?? null,
            recordedBy: actor.id,
            approved: true,
            notes: input.note ?? null,
          });
        }
      }

      movementId = uid();
      await db.query(
        `INSERT INTO chemical_stock_movements
           (id, organization_id, product_id, movement_type, quantity_change, balance_after,
            unit_cost, farm_id, field_id, storage_location, expense_id, reference, note, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          movementId,
          organizationId,
          id,
          input.type,
          change,
          newBalance,
          unitCost,
          input.farmId ?? null,
          input.fieldId ?? null,
          input.storageLocation ?? null,
          expenseId,
          input.reference ?? null,
          input.note ?? null,
          actor.id,
        ],
      );

      await db.query(
        `UPDATE chemical_products
         SET available_stock = ?, storage_location = COALESCE(?, storage_location), updated_at = now()
         WHERE id = ? AND organization_id = ?`,
        [newBalance, input.storageLocation ?? null, id, organizationId],
      );
    });

    await recordAudit({
      actorUserId: actor.id,
      organizationId,
      action: 'chemical.stock_movement',
      targetType: 'chemical_product',
      targetId: id,
      metadata: { movementId, type: input.type, quantity: input.quantity },
    });

    return this.getById(actor, id);
  },

  async listUsage(actor: AuthUser, query: { productId?: string; farmId?: string; fieldId?: string; dateFrom?: string; dateTo?: string; includeCancelled?: boolean; page: number; pageSize: number }) {
    const scope = farmScope(actor, 'f');
    const conditions = [scope.clause];
    const values: unknown[] = [...scope.params];

    if (query.productId) {
      conditions.push('cu.product_id = ?');
      values.push(query.productId);
    }
    if (query.farmId) {
      conditions.push('cu.farm_id = ?');
      values.push(query.farmId);
    }
    if (query.fieldId) {
      conditions.push('cu.field_id = ?');
      values.push(query.fieldId);
    }
    if (query.dateFrom) {
      conditions.push('cu.usage_date >= ?');
      values.push(query.dateFrom);
    }
    if (query.dateTo) {
      conditions.push('cu.usage_date <= ?');
      values.push(query.dateTo);
    }
    if (!query.includeCancelled) conditions.push('cu.cancelled_at IS NULL');

    const where = conditions.join(' AND ');
    const select = `FROM chemical_usage cu
      JOIN chemical_products p ON p.id = cu.product_id
      JOIN farms f ON f.id = cu.farm_id
      LEFT JOIN fields fl ON fl.id = cu.field_id
      LEFT JOIN users u ON u.id = cu.recorded_by`;

    const [rows, count] = await Promise.all([
      pool.query(
        `SELECT cu.*, p.name AS product_name, p.unit AS stock_unit_name,
                f.name AS farm_name, fl.name AS field_name, u.name AS recorded_by_name
         ${select}
         WHERE ${where}
         ORDER BY cu.usage_date DESC, cu.created_at DESC
         LIMIT ? OFFSET ?`,
        [...values, query.pageSize, (query.page - 1) * query.pageSize],
      ),
      pool.query<{ total: string | number }>(
        `SELECT COUNT(*) AS total ${select} WHERE ${where}`,
        values,
      ),
    ]);

    return {
      items: rows.rows.map(mapUsage),
      total: Number(count.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  async recordUsage(actor: AuthUser, input: ChemicalUsageInput) {
    const { organizationId } = requireOrgContext(actor);
    await assertFarmAccess(actor, input.farmId);
    if (input.fieldId) await assertFieldAccess(actor, input.farmId, input.fieldId);
    if (input.taskId) await assertTaskAccess(actor, input.taskId, input.farmId);

    const usageId = uid();
    let deducted = 0;
    let unitCost = 0;
    let totalCost = 0;

    await pool.withTransaction(async (db) => {
      const result = await db.query<ProductRow>(
        `SELECT * FROM chemical_products
         WHERE id = ? AND organization_id = ? AND is_active = 1 FOR UPDATE`,
        [input.productId, organizationId],
      );
      const product = result.rows[0];
      if (!product) throw new AppError(404, 'Chemical product not found.', 'NOT_FOUND');

      const converted = convertQuantity(input.quantityUsed, input.unit, product.unit);
      if (converted === null) {
        throw new AppError(
          400,
          `The usage unit (${input.unit}) is not compatible with the stock unit (${product.unit}).`,
          'UNIT_MISMATCH',
        );
      }
      deducted = round3(converted);
      const newBalance = nextStockBalance(num(product.available_stock), -deducted);
      if (newBalance === null) {
        throw new AppError(
          400,
          `Only ${num(product.available_stock)} ${product.unit} is available in stock.`,
          'INSUFFICIENT_STOCK',
        );
      }

      unitCost = unitCostOf(product);
      totalCost = round2(deducted * unitCost);

      await db.query(
        `INSERT INTO chemical_usage
           (id, organization_id, product_id, farm_id, field_id, task_id, crop, batch_number,
            usage_date, quantity_used, unit, quantity_deducted, stock_unit, area_treated,
            area_unit, application_method, applied_by, supervisor, purpose, weather_conditions,
            rate_applied, rate_unit, unit_cost_at_use, total_cost_at_use, attachment_url,
            notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          usageId,
          organizationId,
          input.productId,
          input.farmId,
          input.fieldId ?? null,
          input.taskId ?? null,
          input.crop ?? null,
          input.batchNumber ?? product.batch_number ?? null,
          input.usageDate,
          input.quantityUsed,
          input.unit,
          deducted,
          product.unit,
          input.areaTreated ?? null,
          input.areaUnit ?? null,
          input.applicationMethod ?? null,
          input.appliedBy ?? null,
          input.supervisor ?? null,
          input.purpose ?? null,
          input.weatherConditions ?? null,
          input.rateApplied ?? null,
          input.rateUnit ?? null,
          unitCost,
          totalCost,
          input.attachmentUrl ?? null,
          input.notes ?? null,
          actor.id,
        ],
      );

      await db.query(
        `INSERT INTO chemical_stock_movements
           (id, organization_id, product_id, movement_type, quantity_change, balance_after,
            unit_cost, farm_id, field_id, usage_id, note, recorded_by)
         VALUES (?, ?, ?, 'usage', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uid(),
          organizationId,
          input.productId,
          -deducted,
          newBalance,
          unitCost,
          input.farmId,
          input.fieldId ?? null,
          usageId,
          input.purpose ?? 'Chemical usage',
          actor.id,
        ],
      );

      await db.query(
        `UPDATE chemical_products SET available_stock = ?, updated_at = now()
         WHERE id = ? AND organization_id = ?`,
        [newBalance, input.productId, organizationId],
      );
    });

    await recordAudit({
      actorUserId: actor.id,
      organizationId,
      action: 'chemical.usage_recorded',
      targetType: 'chemical_usage',
      targetId: usageId,
      metadata: {
        productId: input.productId,
        farmId: input.farmId,
        quantityUsed: input.quantityUsed,
        unit: input.unit,
        quantityDeducted: deducted,
      },
    });

    return this.getUsage(actor, usageId);
  },

  async getUsage(actor: AuthUser, id: string) {
    const scope = farmScope(actor, 'f');
    const result = await pool.query(
      `SELECT cu.*, p.name AS product_name, f.name AS farm_name, fl.name AS field_name,
              u.name AS recorded_by_name
       FROM chemical_usage cu
       JOIN chemical_products p ON p.id = cu.product_id
       JOIN farms f ON f.id = cu.farm_id
       LEFT JOIN fields fl ON fl.id = cu.field_id
       LEFT JOIN users u ON u.id = cu.recorded_by
       WHERE cu.id = ? AND ${scope.clause}`,
      [id, ...scope.params],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, 'Chemical usage record not found.', 'NOT_FOUND');
    return mapUsage(row);
  },

  async cancelUsage(actor: AuthUser, id: string, reason: string) {
    const { organizationId } = requireOrgContext(actor);
    const existing = await pool.query<{ id: string; farm_id: string; cancelled_at: string | Date | null }>(
      `SELECT id, farm_id, cancelled_at FROM chemical_usage WHERE id = ? AND organization_id = ?`,
      [id, organizationId],
    );
    const usage = existing.rows[0];
    if (!usage) throw new AppError(404, 'Chemical usage record not found.', 'NOT_FOUND');
    if (usage.cancelled_at) {
      throw new AppError(409, 'This usage record is already cancelled.', 'INVALID_STATE');
    }
    await assertFarmAccess(actor, usage.farm_id);

    await pool.withTransaction(async (db) => {
      const locked = await db.query<{
        id: string;
        product_id: string;
        quantity_deducted: string | number;
        unit_cost_at_use: string | number | null;
        cancelled_at: string | Date | null;
      }>(
        `SELECT id, product_id, quantity_deducted, unit_cost_at_use, cancelled_at
         FROM chemical_usage WHERE id = ? AND organization_id = ? FOR UPDATE`,
        [id, organizationId],
      );
      const record = locked.rows[0];
      if (!record) throw new AppError(404, 'Chemical usage record not found.', 'NOT_FOUND');
      if (record.cancelled_at) {
        throw new AppError(409, 'This usage record is already cancelled.', 'INVALID_STATE');
      }

      const productResult = await db.query<ProductRow>(
        `SELECT * FROM chemical_products WHERE id = ? AND organization_id = ? FOR UPDATE`,
        [record.product_id, organizationId],
      );
      const product = productResult.rows[0];
      if (!product) throw new AppError(404, 'Chemical product not found.', 'NOT_FOUND');

      const quantity = num(record.quantity_deducted);
      const newBalance = nextStockBalance(num(product.available_stock), quantity) ?? 0;

      await db.query(
        `INSERT INTO chemical_stock_movements
           (id, organization_id, product_id, movement_type, quantity_change, balance_after,
            unit_cost, farm_id, field_id, usage_id, note, recorded_by)
         VALUES (?, ?, ?, 'usage_cancel', ?, ?, ?, ?, NULL, ?, ?, ?)`,
        [
          uid(),
          organizationId,
          record.product_id,
          quantity,
          newBalance,
          record.unit_cost_at_use === null ? null : num(record.unit_cost_at_use),
          usage.farm_id,
          id,
          `Usage cancelled: ${reason}`,
          actor.id,
        ],
      );
      await db.query(
        `UPDATE chemical_products SET available_stock = ?, updated_at = now()
         WHERE id = ? AND organization_id = ?`,
        [newBalance, record.product_id, organizationId],
      );
      await db.query(
        `UPDATE chemical_usage
         SET cancelled_at = now(), cancelled_by = ?, cancellation_reason = ?, updated_at = now()
         WHERE id = ? AND organization_id = ?`,
        [actor.id, reason, id, organizationId],
      );
    });

    await recordAudit({
      actorUserId: actor.id,
      organizationId,
      action: 'chemical.usage_cancelled',
      targetType: 'chemical_usage',
      targetId: id,
      metadata: { reason },
    });

    return this.getUsage(actor, id);
  },

  async alerts(actor: AuthUser) {
    const { organizationId } = requireOrgContext(actor);
    const result = await pool.query<ProductRow>(
      `SELECT p.*, (SELECT COUNT(*) FROM chemical_usage cu
                    WHERE cu.product_id = p.id AND cu.cancelled_at IS NULL) AS usage_count
       FROM chemical_products p
       WHERE p.organization_id = ? AND p.is_active = 1
         AND (
           p.available_stock <= p.minimum_stock
           OR (p.expiry_date IS NOT NULL AND p.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY))
         )
       ORDER BY p.expiry_date ASC, p.available_stock ASC
       LIMIT 100`,
      [organizationId],
    );
    const products = result.rows.map(mapProduct);
    return {
      lowStock: products.filter((product) => product.stockStatus !== 'in_stock'),
      expiringSoon: products.filter(
        (product) => product.daysToExpiry !== null && product.daysToExpiry >= 0 && product.daysToExpiry <= 30,
      ),
      expired: products.filter((product) => product.isExpired),
    };
  },
};

function mapUsage(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    productId: row.product_id as string,
    productName: row.product_name as string,
    farmId: row.farm_id as string,
    farmName: row.farm_name as string,
    fieldId: row.field_id as string | null,
    fieldName: row.field_name as string | null,
    taskId: row.task_id as string | null,
    crop: row.crop as string | null,
    batchNumber: row.batch_number as string | null,
    usageDate: formatDateOnly(row.usage_date as string | Date),
    quantityUsed: num(row.quantity_used),
    unit: row.unit as string,
    quantityDeducted: num(row.quantity_deducted),
    stockUnit: row.stock_unit as string,
    areaTreated: row.area_treated === null ? null : num(row.area_treated),
    areaUnit: row.area_unit as string | null,
    applicationMethod: row.application_method as string | null,
    appliedBy: row.applied_by as string | null,
    supervisor: row.supervisor as string | null,
    purpose: row.purpose as string | null,
    weatherConditions: row.weather_conditions as string | null,
    rateApplied: row.rate_applied === null ? null : num(row.rate_applied),
    rateUnit: row.rate_unit as string | null,
    unitCostAtUse: row.unit_cost_at_use === null ? null : num(row.unit_cost_at_use),
    totalCostAtUse: row.total_cost_at_use === null ? null : num(row.total_cost_at_use),
    attachmentUrl: row.attachment_url as string | null,
    notes: row.notes as string | null,
    recordedBy: row.recorded_by as string | null,
    recordedByName: row.recorded_by_name as string | null,
    cancelledAt: formatDateTime(row.cancelled_at as string | Date | null),
    cancellationReason: row.cancellation_reason as string | null,
    createdAt: formatDateTime(row.created_at as string | Date | null),
  };
}
