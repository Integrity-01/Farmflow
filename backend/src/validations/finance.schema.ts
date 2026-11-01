import { z } from 'zod';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Please use a YYYY-MM-DD date.');

const optionalDate = dateOnly.optional().nullable();

const money = z.coerce.number().min(0, 'Amount cannot be negative.').max(1e12);
const positiveMoney = z.coerce.number().positive('Amount must be greater than zero.').max(1e12);
const quantity = z.coerce.number().positive('Quantity must be greater than zero.').max(1e12);

const booleanQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

const pageQuery = {
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
};

const uuid = z.string().uuid('Please choose a valid record.');
const nullableUuid = z.string().uuid('Please choose a valid record.').optional().nullable();

const shortText = (max: number) => z.string().trim().max(max).optional().nullable();

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------
const expenseFields = z.object({
  farmId: uuid,
  fieldId: nullableUuid,
  taskId: nullableUuid,
  categoryId: uuid,
  expenseDate: dateOnly,
  description: z
    .string()
    .trim()
    .min(2, 'Please describe the expense.')
    .max(500, 'Description is too long.'),
  quantity: z.coerce.number().nonnegative().max(1e12).optional().nullable(),
  unit: shortText(30),
  unitPrice: money.optional().nullable(),
  amount: positiveMoney.optional(),
  supplier: shortText(160),
  paymentMethod: shortText(60),
  paymentReference: shortText(120),
  receiptUrl: shortText(2000),
  notes: shortText(4000),
  submit: z.boolean().optional().default(false),
});

export const createExpenseSchema = expenseFields.refine(
  (value) =>
    value.amount !== undefined ||
    (value.quantity !== undefined && value.unitPrice !== undefined),
  {
    message: 'Enter an amount, or a quantity and unit price.',
    path: ['amount'],
  },
);

export const updateExpenseSchema = expenseFields.partial();

export const listExpensesQuerySchema = z.object({
  farmId: z.string().uuid().optional(),
  fieldId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  approvalStatus: z
    .enum(['draft', 'submitted', 'approved', 'rejected', 'cancelled'])
    .optional(),
  paymentStatus: z.enum(['unpaid', 'partially_paid', 'paid']).optional(),
  module: z.enum(['chemical', 'labour', 'other']).optional(),
  search: z.string().trim().max(160).optional(),
  dateFrom: dateOnly.optional(),
  dateTo: dateOnly.optional(),
  ...pageQuery,
});

export const recordExpensePaymentSchema = z.object({
  amount: positiveMoney,
  paidOn: dateOnly,
  method: shortText(60),
  reference: shortText(120),
  notes: shortText(500),
});

export const reasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Please give a reason.')
    .max(500, 'Reason is too long.'),
});

export const createExpenseCategorySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'Use lower-case letters, numbers and underscores only.'),
  name: z.string().trim().min(2).max(120),
  module: z.enum(['chemical', 'labour', 'other']).default('other'),
  description: shortText(255),
});

export const updateExpenseCategorySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  module: z.enum(['chemical', 'labour', 'other']).optional(),
  description: shortText(255),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Chemicals
// ---------------------------------------------------------------------------
const chemicalUnits = z.string().trim().min(1, 'Please choose a unit.').max(30);

export const createChemicalSchema = z
  .object({
    farmId: nullableUuid,
    fieldId: nullableUuid,
    name: z.string().trim().min(2, 'Please enter the product name.').max(160),
    activeIngredient: shortText(160),
    formulation: shortText(80),
    intendedUse: shortText(255),
    supplier: shortText(160),
    batchNumber: shortText(120),
    purchaseDate: optionalDate,
    expiryDate: optionalDate,
    quantityReceived: z.coerce.number().nonnegative().max(1e12).default(0),
    unit: chemicalUnits.default('litre'),
    purchaseCost: money.default(0),
    storageLocation: shortText(160),
    minimumStock: z.coerce.number().nonnegative().max(1e12).default(0),
    safetyInstructions: shortText(4000),
    receiptUrl: shortText(2000),
    notes: shortText(4000),
    recordExpense: z.boolean().optional().default(true),
  })
  .refine((value) => value.purchaseCost <= 0 || value.quantityReceived > 0, {
    message: 'Enter the quantity received for a purchased chemical.',
    path: ['quantityReceived'],
  })
  .refine((value) => !value.recordExpense || value.purchaseCost <= 0 || Boolean(value.farmId), {
    message: 'Choose the farm this purchase should be charged to.',
    path: ['farmId'],
  });

export const updateChemicalSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  activeIngredient: shortText(160),
  formulation: shortText(80),
  intendedUse: shortText(255),
  supplier: shortText(160),
  batchNumber: shortText(120),
  purchaseDate: optionalDate,
  expiryDate: optionalDate,
  unit: chemicalUnits.optional(),
  purchaseCost: money.optional(),
  storageLocation: shortText(160),
  minimumStock: z.coerce.number().nonnegative().max(1e12).optional(),
  safetyInstructions: shortText(4000),
  receiptUrl: shortText(2000),
  notes: shortText(4000),
  isActive: z.boolean().optional(),
});

export const listChemicalsQuerySchema = z.object({
  search: z.string().trim().max(160).optional(),
  lowStock: booleanQuery,
  includeInactive: booleanQuery,
  expiringDays: z.coerce.number().int().min(1).max(3650).optional(),
  ...pageQuery,
});

export const chemicalMovementSchema = z
  .object({
    type: z.enum([
      'purchase',
      'transfer',
      'issue',
      'return',
      'adjustment',
      'expired',
      'damaged',
    ]),
    direction: z.enum(['increase', 'decrease']).optional(),
    quantity: z.coerce.number().positive('Quantity must be greater than zero.').max(1e12),
    unitCost: money.optional().nullable(),
    farmId: nullableUuid,
    fieldId: nullableUuid,
    storageLocation: shortText(160),
    reference: shortText(120),
    note: shortText(500),
    recordExpense: z.boolean().optional().default(true),
  })
  .refine((value) => value.type !== 'adjustment' || Boolean(value.direction), {
    message: 'Choose whether the adjustment increases or decreases stock.',
    path: ['direction'],
  });

export const chemicalUsageSchema = z.object({
  productId: uuid,
  farmId: uuid,
  fieldId: nullableUuid,
  taskId: nullableUuid,
  crop: shortText(120),
  batchNumber: shortText(120),
  usageDate: dateOnly,
  quantityUsed: quantity,
  unit: chemicalUnits,
  areaTreated: z.coerce.number().nonnegative().max(1e12).optional().nullable(),
  areaUnit: shortText(30),
  applicationMethod: shortText(120),
  appliedBy: shortText(160),
  supervisor: shortText(160),
  purpose: shortText(255),
  weatherConditions: shortText(255),
  rateApplied: z.coerce.number().nonnegative().max(1e12).optional().nullable(),
  rateUnit: shortText(60),
  attachmentUrl: shortText(2000),
  notes: shortText(4000),
});

export const listChemicalUsageQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  farmId: z.string().uuid().optional(),
  fieldId: z.string().uuid().optional(),
  dateFrom: dateOnly.optional(),
  dateTo: dateOnly.optional(),
  includeCancelled: booleanQuery,
  ...pageQuery,
});

// ---------------------------------------------------------------------------
// External labour
// ---------------------------------------------------------------------------
export const createLabourerSchema = z.object({
  name: z.string().trim().min(2, 'Please enter the labourer name.').max(160),
  businessName: shortText(160),
  phone: shortText(40),
  email: z.union([z.string().trim().email('Enter a valid email.').max(160), z.literal('')]).optional().nullable(),
  labourType: shortText(120),
  isContractor: z.boolean().optional().default(false),
  notes: shortText(4000),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateLabourerSchema = createLabourerSchema.partial();

export const listLabourersQuerySchema = z.object({
  search: z.string().trim().max(160).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  ...pageQuery,
});

const engagementFields = z.object({
  farmId: uuid,
  fieldId: nullableUuid,
  taskId: nullableUuid,
  labourerId: uuid,
  workType: z.string().trim().min(2, 'Please enter the work type.').max(120),
  description: shortText(4000),
  startDate: optionalDate,
  completionDate: optionalDate,
  workerCount: z.coerce.number().int().positive().max(100000).optional().nullable(),
  quantityCompleted: z.coerce.number().nonnegative().max(1e12).optional().nullable(),
  unitOfWork: shortText(60),
  pricingMethod: z
    .enum(['daily', 'fixed', 'per_area', 'per_unit', 'other'])
    .default('fixed'),
  agreedRate: money.optional().nullable(),
  agreedTotal: positiveMoney.optional(),
  invoiceUrl: shortText(2000),
  notes: shortText(4000),
  submit: z.boolean().optional().default(false),
});

export const createLabourEngagementSchema = engagementFields.refine(
  (value) => value.agreedTotal !== undefined || value.agreedRate !== undefined,
  { message: 'Enter the agreed total or a rate.', path: ['agreedTotal'] },
);

export const updateLabourEngagementSchema = engagementFields.partial();

export const listLabourEngagementsQuerySchema = z.object({
  farmId: z.string().uuid().optional(),
  labourerId: z.string().uuid().optional(),
  approvalStatus: z
    .enum(['draft', 'submitted', 'approved', 'rejected', 'cancelled'])
    .optional(),
  paymentStatus: z.enum(['unpaid', 'partially_paid', 'paid']).optional(),
  dateFrom: dateOnly.optional(),
  dateTo: dateOnly.optional(),
  search: z.string().trim().max(160).optional(),
  ...pageQuery,
});

export const recordLabourPaymentSchema = z.object({
  amount: positiveMoney,
  paidOn: dateOnly,
  method: shortText(60),
  reference: shortText(120),
  notes: shortText(500),
});

// ---------------------------------------------------------------------------
// Budgets & financial analysis
// ---------------------------------------------------------------------------
export const upsertBudgetSchema = z
  .object({
    farmId: uuid,
    periodStart: dateOnly,
    periodEnd: dateOnly,
    amount: money,
    notes: shortText(500),
  })
  .refine((value) => value.periodEnd >= value.periodStart, {
    message: 'The end date must be on or after the start date.',
    path: ['periodEnd'],
  });

const periodQuery = {
  dateFrom: dateOnly.optional(),
  dateTo: dateOnly.optional(),
  farmId: z.string().uuid().optional(),
};

export const financialOverviewQuerySchema = z.object(periodQuery);

export const costAnalysisQuerySchema = z.object({
  ...periodQuery,
  groupBy: z.enum(['farm', 'field', 'category']).default('farm'),
});

export const financialExportQuerySchema = z.object({
  ...periodQuery,
  format: z.enum(['csv']).default('csv'),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
export type RecordExpensePaymentInput = z.infer<typeof recordExpensePaymentSchema>;
export type CreateChemicalInput = z.infer<typeof createChemicalSchema>;
export type UpdateChemicalInput = z.infer<typeof updateChemicalSchema>;
export type ChemicalMovementInput = z.infer<typeof chemicalMovementSchema>;
export type ChemicalUsageInput = z.infer<typeof chemicalUsageSchema>;
export type CreateLabourerInput = z.infer<typeof createLabourerSchema>;
export type CreateLabourEngagementInput = z.infer<typeof createLabourEngagementSchema>;
export type RecordLabourPaymentInput = z.infer<typeof recordLabourPaymentSchema>;
export type FinancialOverviewQuery = z.infer<typeof financialOverviewQuerySchema>;
export type CostAnalysisQuery = z.infer<typeof costAnalysisQuerySchema>;
