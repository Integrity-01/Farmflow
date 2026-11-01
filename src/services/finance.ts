import { api, downloadFile } from '@/services/api';
import type {
  BudgetInput,
  ChemicalAlerts,
  ChemicalInput,
  ChemicalMovement,
  ChemicalMovementInput,
  ChemicalProduct,
  ChemicalProductDetail,
  ChemicalUsage,
  ChemicalUsageInput,
  CostAnalysis,
  EngagementInput,
  ExpenseCategory,
  ExpenseInput,
  ExpensePayment,
  ExpenseQuery,
  ExpenseRecord,
  ExportType,
  FarmBudget,
  FinancePeriod,
  FinancialOverview,
  LabourEngagement,
  LabourPayment,
  LabourerInput,
  ExternalLabourer,
  PagedChemicalUsage,
  PagedChemicals,
  PagedEngagements,
  PagedExpenses,
  PagedLabourers,
  PaymentInput,
} from '@/types/finance';

type Query = Record<string, string | number | boolean | undefined | null>;

function qs(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export interface ChemicalQuery {
  search?: string;
  lowStock?: boolean;
  includeInactive?: boolean;
  expiringDays?: number;
  page?: number;
  pageSize?: number;
}

export interface UsageQuery {
  productId?: string;
  farmId?: string;
  fieldId?: string;
  dateFrom?: string;
  dateTo?: string;
  includeCancelled?: boolean;
  page?: number;
  pageSize?: number;
}

export interface EngagementQuery {
  farmId?: string;
  labourerId?: string;
  approvalStatus?: string;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface LabourerQuery {
  search?: string;
  status?: 'active' | 'inactive';
  page?: number;
  pageSize?: number;
}

export interface CostQuery extends FinancePeriod {
  farmId?: string;
  groupBy?: 'farm' | 'field' | 'category';
}

export const financeApi = {
  expenses: {
    async list(query: ExpenseQuery = {}): Promise<PagedExpenses> {
      return api.get<PagedExpenses>(`/expenses${qs(query as Query)}`);
    },
    async create(input: ExpenseInput): Promise<ExpenseRecord> {
      const result = await api.post<{ expense: ExpenseRecord }>('/expenses', input);
      return result.expense;
    },
    async update(id: string, input: Partial<ExpenseInput>): Promise<ExpenseRecord> {
      const result = await api.patch<{ expense: ExpenseRecord }>(`/expenses/${id}`, input);
      return result.expense;
    },
    async remove(id: string): Promise<void> {
      await api.delete<void>(`/expenses/${id}`);
    },
    async submit(id: string): Promise<ExpenseRecord> {
      const result = await api.post<{ expense: ExpenseRecord }>(`/expenses/${id}/submit`);
      return result.expense;
    },
    async approve(id: string): Promise<ExpenseRecord> {
      const result = await api.post<{ expense: ExpenseRecord }>(`/expenses/${id}/approve`);
      return result.expense;
    },
    async reject(id: string, reason: string): Promise<ExpenseRecord> {
      const result = await api.post<{ expense: ExpenseRecord }>(`/expenses/${id}/reject`, { reason });
      return result.expense;
    },
    async cancel(id: string, reason: string): Promise<ExpenseRecord> {
      const result = await api.post<{ expense: ExpenseRecord }>(`/expenses/${id}/cancel`, { reason });
      return result.expense;
    },
    async payments(id: string): Promise<ExpensePayment[]> {
      const result = await api.get<{ payments: ExpensePayment[] }>(`/expenses/${id}/payments`);
      return result.payments;
    },
    async addPayment(id: string, input: PaymentInput): Promise<ExpenseRecord> {
      const result = await api.post<{ expense: ExpenseRecord }>(`/expenses/${id}/payments`, input);
      return result.expense;
    },
    async categories(): Promise<ExpenseCategory[]> {
      const result = await api.get<{ categories: ExpenseCategory[] }>('/expenses/categories');
      return result.categories;
    },
    async createCategory(input: {
      code: string;
      name: string;
      module: 'chemical' | 'labour' | 'other';
      description?: string | null;
    }): Promise<ExpenseCategory> {
      const result = await api.post<{ category: ExpenseCategory }>('/expenses/categories', input);
      return result.category;
    },
  },

  chemicals: {
    async list(query: ChemicalQuery = {}): Promise<PagedChemicals> {
      return api.get<PagedChemicals>(`/chemicals${qs(query as Query)}`);
    },
    async get(id: string): Promise<ChemicalProductDetail> {
      const result = await api.get<{ product: ChemicalProductDetail }>(`/chemicals/${id}`);
      return result.product;
    },
    async create(input: ChemicalInput): Promise<ChemicalProduct> {
      const result = await api.post<{ product: ChemicalProduct }>('/chemicals', input);
      return result.product;
    },
    async update(id: string, input: Partial<ChemicalInput>): Promise<ChemicalProduct> {
      const result = await api.patch<{ product: ChemicalProduct }>(`/chemicals/${id}`, input);
      return result.product;
    },
    async remove(id: string): Promise<void> {
      await api.delete<void>(`/chemicals/${id}`);
    },
    async movements(id: string): Promise<ChemicalMovement[]> {
      const result = await api.get<{ movements: ChemicalMovement[] }>(`/chemicals/${id}/movements`);
      return result.movements;
    },
    async addMovement(id: string, input: ChemicalMovementInput): Promise<ChemicalProduct> {
      const result = await api.post<{ product: ChemicalProduct }>(`/chemicals/${id}/movements`, input);
      return result.product;
    },
    async usage(query: UsageQuery = {}): Promise<PagedChemicalUsage> {
      return api.get<PagedChemicalUsage>(`/chemicals/usage${qs(query as Query)}`);
    },
    async recordUsage(input: ChemicalUsageInput): Promise<ChemicalUsage> {
      const result = await api.post<{ usage: ChemicalUsage }>('/chemicals/usage', input);
      return result.usage;
    },
    async cancelUsage(id: string, reason: string): Promise<ChemicalUsage> {
      const result = await api.post<{ usage: ChemicalUsage }>(`/chemicals/usage/${id}/cancel`, {
        reason,
      });
      return result.usage;
    },
    async alerts(): Promise<ChemicalAlerts> {
      return api.get<ChemicalAlerts>('/chemicals/alerts');
    },
  },

  labour: {
    async labourers(query: LabourerQuery = {}): Promise<PagedLabourers> {
      return api.get<PagedLabourers>(`/labour/labourers${qs(query as Query)}`);
    },
    async labourer(id: string): Promise<ExternalLabourer> {
      const result = await api.get<{ labourer: ExternalLabourer }>(`/labour/labourers/${id}`);
      return result.labourer;
    },
    async createLabourer(input: LabourerInput): Promise<ExternalLabourer> {
      const result = await api.post<{ labourer: ExternalLabourer }>('/labour/labourers', input);
      return result.labourer;
    },
    async updateLabourer(id: string, input: Partial<LabourerInput>): Promise<ExternalLabourer> {
      const result = await api.patch<{ labourer: ExternalLabourer }>(`/labour/labourers/${id}`, input);
      return result.labourer;
    },
    async engagements(query: EngagementQuery = {}): Promise<PagedEngagements> {
      return api.get<PagedEngagements>(`/labour/engagements${qs(query as Query)}`);
    },
    async engagement(id: string): Promise<LabourEngagement & { payments: LabourPayment[] }> {
      const result = await api.get<{ engagement: LabourEngagement & { payments: LabourPayment[] } }>(
        `/labour/engagements/${id}`,
      );
      return result.engagement;
    },
    async createEngagement(input: EngagementInput): Promise<LabourEngagement> {
      const result = await api.post<{ engagement: LabourEngagement }>('/labour/engagements', input);
      return result.engagement;
    },
    async updateEngagement(
      id: string,
      input: Partial<EngagementInput>,
    ): Promise<LabourEngagement> {
      const result = await api.patch<{ engagement: LabourEngagement }>(
        `/labour/engagements/${id}`,
        input,
      );
      return result.engagement;
    },
    async submit(id: string): Promise<LabourEngagement> {
      const result = await api.post<{ engagement: LabourEngagement }>(
        `/labour/engagements/${id}/submit`,
      );
      return result.engagement;
    },
    async approve(id: string): Promise<LabourEngagement> {
      const result = await api.post<{ engagement: LabourEngagement }>(
        `/labour/engagements/${id}/approve`,
      );
      return result.engagement;
    },
    async reject(id: string, reason: string): Promise<LabourEngagement> {
      const result = await api.post<{ engagement: LabourEngagement }>(
        `/labour/engagements/${id}/reject`,
        { reason },
      );
      return result.engagement;
    },
    async cancel(id: string, reason: string): Promise<LabourEngagement> {
      const result = await api.post<{ engagement: LabourEngagement }>(
        `/labour/engagements/${id}/cancel`,
        { reason },
      );
      return result.engagement;
    },
    async payments(id: string): Promise<LabourPayment[]> {
      const result = await api.get<{ payments: LabourPayment[] }>(
        `/labour/engagements/${id}/payments`,
      );
      return result.payments;
    },
    async addPayment(id: string, input: PaymentInput): Promise<LabourEngagement> {
      const result = await api.post<{ engagement: LabourEngagement }>(
        `/labour/engagements/${id}/payments`,
        input,
      );
      return result.engagement;
    },
  },

  financial: {
    async overview(query: { farmId?: string; dateFrom?: string; dateTo?: string } = {}): Promise<FinancialOverview> {
      return api.get<FinancialOverview>(`/financial/overview${qs(query as Query)}`);
    },
    async costAnalysis(query: CostQuery): Promise<CostAnalysis> {
      return api.get<CostAnalysis>(`/financial/cost-analysis${qs(query as unknown as Query)}`);
    },
    async budgets(query: { farmId?: string; dateFrom?: string; dateTo?: string } = {}): Promise<FarmBudget[]> {
      const result = await api.get<{ budgets: FarmBudget[] }>(`/financial/budgets${qs(query as Query)}`);
      return result.budgets;
    },
    async upsertBudget(input: BudgetInput): Promise<FarmBudget> {
      const result = await api.put<{ budget: FarmBudget }>('/financial/budgets', input);
      return result.budget;
    },
    async export(type: ExportType, query: { farmId?: string; dateFrom?: string; dateTo?: string } = {}): Promise<void> {
      await downloadFile(`/financial/export/${type}${qs(query as Query)}`, `${type}.csv`);
    },
  },
};

export function hasPermission(permissions: string[] | undefined | null, code: string): boolean {
  return Array.isArray(permissions) && permissions.includes(code);
}

export function canAny(permissions: string[] | undefined | null, codes: string[]): boolean {
  return Array.isArray(permissions) && codes.some((code) => permissions.includes(code));
}
