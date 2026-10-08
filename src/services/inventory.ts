import { api } from '@/services/api';
import type {
  AdjustStockInput,
  InputDraft,
  InputType,
  InventoryItem,
  PagedInventory,
  PagedMovements,
  UserRole,
} from '@/types';

export interface InventoryQuery {
  search?: string;
  type?: InputType;
  stock?: 'all' | 'low' | 'out';
  farmId?: string;
  page?: number;
  pageSize?: number;
}

export const inventoryApi = {
  async list(query: InventoryQuery = {}): Promise<PagedInventory> {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.type) params.set('type', query.type);
    if (query.stock && query.stock !== 'all') params.set('stock', query.stock);
    if (query.farmId) params.set('farmId', query.farmId);
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    const qs = params.toString();
    return api.get<PagedInventory>(qs ? `/inventory?${qs}` : `/inventory`);
  },

  async get(id: string): Promise<InventoryItem> {
    const result = await api.get<{ input: InventoryItem }>(`/inventory/${id}`);
    return result.input;
  },

  async create(input: InputDraft): Promise<InventoryItem> {
    const result = await api.post<{ input: InventoryItem }>('/inventory', input);
    return result.input;
  },

  async update(id: string, input: Partial<InputDraft>): Promise<InventoryItem> {
    const result = await api.patch<{ input: InventoryItem }>(`/inventory/${id}`, input);
    return result.input;
  },

  async remove(id: string): Promise<void> {
    await api.delete<void>(`/inventory/${id}`);
  },

  async adjust(id: string, input: AdjustStockInput): Promise<InventoryItem> {
    const result = await api.post<{ input: InventoryItem }>(`/inventory/${id}/adjust`, input);
    return result.input;
  },

  async movements(id: string, page = 1, pageSize = 10): Promise<PagedMovements> {
    return api.get<PagedMovements>(`/inventory/${id}/movements?page=${page}&pageSize=${pageSize}`);
  },
};

export function canManageInventory(role: UserRole | null): boolean {
  return role === 'administrator' || role === 'farm_manager';
}