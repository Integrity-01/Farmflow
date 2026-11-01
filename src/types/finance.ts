export type FinanceModule = 'chemical' | 'labour' | 'other';
export type ApprovalStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export interface Paged {
  total: number;
  page: number;
  pageSize: number;
}

export interface ExpenseCategory {
  id: string;
  code: string;
  name: string;
  module: FinanceModule;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
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
  categoryModule: FinanceModule;
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

export interface ExpensePayment {
  id: string;
  amount: string | number;
  paidOn: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  recordedBy: string | null;
  recordedByName: string | null;
  createdAt: string | null;
}

export interface PagedExpenses extends Paged {
  items: ExpenseRecord[];
}

export interface ExpenseInput {
  farmId: string;
  fieldId?: string | null;
  taskId?: string | null;
  categoryId: string;
  expenseDate: string;
  description: string;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  amount?: number;
  supplier?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  receiptUrl?: string | null;
  notes?: string | null;
  submit?: boolean;
}

export interface ExpenseQuery {
  farmId?: string;
  categoryId?: string;
  approvalStatus?: ApprovalStatus;
  paymentStatus?: PaymentStatus;
  module?: FinanceModule;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export type ChemicalStockStatus = 'out' | 'low' | 'in_stock';

export interface ChemicalProduct {
  id: string;
  name: string;
  activeIngredient: string | null;
  formulation: string | null;
  intendedUse: string | null;
  supplier: string | null;
  batchNumber: string | null;
  purchaseDate: string | null;
  expiryDate: string | null;
  quantityReceived: number;
  unit: string;
  purchaseCost: number;
  unitCost: number;
  storageLocation: string | null;
  availableStock: number;
  minimumStock: number;
  stockStatus: ChemicalStockStatus;
  isExpired: boolean;
  daysToExpiry: number | null;
  safetyInstructions: string | null;
  receiptUrl: string | null;
  notes: string | null;
  isActive: boolean;
  usageCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ChemicalMovement {
  id: string;
  movementType: string;
  quantityChange: string | number;
  balanceAfter: string | number;
  unitCost: string | number | null;
  farmId: string | null;
  fieldId: string | null;
  storageLocation: string | null;
  reference: string | null;
  note: string | null;
  recordedBy: string | null;
  recordedByName: string | null;
  createdAt: string | null;
}

export interface ChemicalProductDetail extends ChemicalProduct {
  movements: ChemicalMovement[];
}

export interface ChemicalUsage {
  id: string;
  productId: string;
  productName: string;
  farmId: string;
  farmName: string;
  fieldId: string | null;
  fieldName: string | null;
  taskId: string | null;
  crop: string | null;
  batchNumber: string | null;
  usageDate: string | null;
  quantityUsed: number;
  unit: string;
  quantityDeducted: number;
  stockUnit: string;
  areaTreated: number | null;
  areaUnit: string | null;
  applicationMethod: string | null;
  appliedBy: string | null;
  supervisor: string | null;
  purpose: string | null;
  weatherConditions: string | null;
  rateApplied: number | null;
  rateUnit: string | null;
  unitCostAtUse: number | null;
  totalCostAtUse: number | null;
  attachmentUrl: string | null;
  notes: string | null;
  recordedBy: string | null;
  recordedByName: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string | null;
}

export interface PagedChemicals extends Paged {
  items: ChemicalProduct[];
}

export interface PagedChemicalUsage extends Paged {
  items: ChemicalUsage[];
}

export interface ChemicalAlerts {
  lowStock: ChemicalProduct[];
  expiringSoon: ChemicalProduct[];
  expired: ChemicalProduct[];
}

export interface ChemicalInput {
  farmId?: string | null;
  fieldId?: string | null;
  name: string;
  activeIngredient?: string | null;
  formulation?: string | null;
  intendedUse?: string | null;
  supplier?: string | null;
  batchNumber?: string | null;
  purchaseDate?: string | null;
  expiryDate?: string | null;
  quantityReceived?: number;
  unit?: string;
  purchaseCost?: number;
  storageLocation?: string | null;
  minimumStock?: number;
  safetyInstructions?: string | null;
  receiptUrl?: string | null;
  notes?: string | null;
  recordExpense?: boolean;
}

export type ChemicalMovementType =
  | 'purchase'
  | 'transfer'
  | 'issue'
  | 'return'
  | 'adjustment'
  | 'expired'
  | 'damaged';

export interface ChemicalMovementInput {
  type: ChemicalMovementType;
  direction?: 'increase' | 'decrease';
  quantity: number;
  unitCost?: number | null;
  farmId?: string | null;
  fieldId?: string | null;
  storageLocation?: string | null;
  reference?: string | null;
  note?: string | null;
  recordExpense?: boolean;
}

export interface ChemicalUsageInput {
  productId: string;
  farmId: string;
  fieldId?: string | null;
  taskId?: string | null;
  crop?: string | null;
  batchNumber?: string | null;
  usageDate: string;
  quantityUsed: number;
  unit: string;
  areaTreated?: number | null;
  areaUnit?: string | null;
  applicationMethod?: string | null;
  appliedBy?: string | null;
  supervisor?: string | null;
  purpose?: string | null;
  weatherConditions?: string | null;
  rateApplied?: number | null;
  rateUnit?: string | null;
  attachmentUrl?: string | null;
  notes?: string | null;
}

export interface ExternalLabourer {
  id: string;
  name: string;
  businessName: string | null;
  phone: string | null;
  email: string | null;
  labourType: string | null;
  isContractor: boolean;
  notes: string | null;
  status: 'active' | 'inactive';
  createdAt: string | null;
  updatedAt: string | null;
  totalEngaged?: number;
  totalPaid?: number;
}

export interface PagedLabourers extends Paged {
  items: ExternalLabourer[];
}

export interface LabourEngagement {
  id: string;
  farmId: string;
  farmName: string;
  fieldId: string | null;
  fieldName: string | null;
  taskId: string | null;
  labourerId: string;
  labourerName: string;
  workType: string;
  description: string | null;
  startDate: string | null;
  completionDate: string | null;
  workerCount: number | null;
  quantityCompleted: number | null;
  unitOfWork: string | null;
  pricingMethod: 'daily' | 'fixed' | 'per_area' | 'per_unit' | 'other';
  agreedRate: number | null;
  agreedTotal: number;
  paidTotal: number;
  outstanding: number;
  approvalStatus: ApprovalStatus;
  paymentStatus: PaymentStatus;
  status: string;
  recordedBy: string | null;
  recordedByName: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  invoiceUrl: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface LabourPayment {
  id: string;
  amount: string | number;
  paidOn: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  recordedByName: string | null;
  createdAt: string | null;
}

export interface PagedEngagements extends Paged {
  items: LabourEngagement[];
}

export interface LabourerInput {
  name: string;
  businessName?: string | null;
  phone?: string | null;
  email?: string | null;
  labourType?: string | null;
  isContractor?: boolean;
  notes?: string | null;
  status?: 'active' | 'inactive';
}

export interface EngagementInput {
  farmId: string;
  fieldId?: string | null;
  taskId?: string | null;
  labourerId: string;
  workType: string;
  description?: string | null;
  startDate?: string | null;
  completionDate?: string | null;
  workerCount?: number | null;
  quantityCompleted?: number | null;
  unitOfWork?: string | null;
  pricingMethod?: 'daily' | 'fixed' | 'per_area' | 'per_unit' | 'other';
  agreedRate?: number | null;
  agreedTotal?: number;
  invoiceUrl?: string | null;
  notes?: string | null;
  submit?: boolean;
}

export interface PaymentInput {
  amount: number;
  paidOn: string;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface FarmBudget {
  id: string;
  farmId: string;
  farmName: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  notes: string | null;
  createdAt: string | null;
}

export interface BudgetInput {
  farmId: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  notes?: string | null;
}

export interface FinancePeriod {
  dateFrom: string;
  dateTo: string;
}

export interface FinanceCards {
  totalSpend: number;
  chemicalSpend: number;
  labourSpend: number;
  otherSpend: number;
  expenseCount: number;
  budget: number;
  budgetVariance: number;
  budgetUtilisation: number | null;
  pendingApprovalCount: number;
  pendingApprovalValue: number;
  unpaidValue: number;
  unpaidCount: number;
  outstandingLabour: number;
  lowStockCount: number;
  expiringCount: number;
  farmCount: number;
}

export interface FinancialOverview {
  period: FinancePeriod;
  cards: FinanceCards;
  topCategories: Array<{
    id: string;
    name: string;
    module: string;
    total: number;
    count: number;
  }>;
  monthlyTrend: Array<{ month: string; total: number }>;
  recentExpenses: Array<{
    id: string;
    expenseDate: string | null;
    description: string;
    amount: number;
    amountPaid: number;
    approvalStatus: string;
    categoryName: string;
    categoryModule: string;
    farmName: string;
  }>;
}

export interface CostGroup {
  id: string;
  name: string;
  module?: string;
  farmId?: string;
  farmName?: string;
  size?: number;
  sizeUnit?: string | null;
  total: number;
  chemical?: number;
  labour?: number;
  other?: number;
  count: number;
  budget?: number | null;
  variance?: number | null;
  utilisation?: number | null;
  perSizeUnit?: number | null;
}

export interface CostAnalysis {
  period: FinancePeriod;
  groupBy: 'farm' | 'field' | 'category';
  groups: CostGroup[];
}

export type ExportType =
  | 'expenses'
  | 'chemical-usage'
  | 'chemical-stock'
  | 'labour-engagements'
  | 'labour-payments'
  | 'outstanding-payments'
  | 'budget-vs-actual'
  | 'farm-cost-summary';
