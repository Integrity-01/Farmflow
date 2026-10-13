import { api } from '@/services/api';
import type {
  Farm,
  FarmDetail,
  FarmDraft,
  FarmField,
  FarmFieldDraft,
  FarmStatus,
  PagedFarms,
  UserRole,
} from '@/types';

export interface FarmManager {
  id: string;
  name: string;
}

export interface FarmsQuery {
  search?: string;
  status?: FarmStatus;
  page?: number;
  pageSize?: number;
}

export const farmsApi = {
  async list(query: FarmsQuery = {}): Promise<PagedFarms> {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.status) params.set('status', query.status);
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    const qs = params.toString();
    return api.get<PagedFarms>(qs ? `/farms?${qs}` : `/farms`);
  },

  async managers(): Promise<FarmManager[]> {
    const result = await api.get<{ managers: FarmManager[] }>('/farms/managers');
    return result.managers;
  },

  async get(id: string): Promise<FarmDetail> {
    const result = await api.get<{ farm: FarmDetail }>(`/farms/${id}`);
    return result.farm;
  },

  async create(input: FarmDraft): Promise<Farm> {
    const result = await api.post<{ farm: Farm }>('/farms', input);
    return result.farm;
  },

  async update(id: string, input: Partial<FarmDraft>): Promise<Farm> {
    const result = await api.patch<{ farm: Farm }>(`/farms/${id}`, input);
    return result.farm;
  },

  async remove(id: string): Promise<void> {
    await api.delete<void>(`/farms/${id}`);
  },

  async addField(farmId: string, input: FarmFieldDraft): Promise<FarmField> {
    const result = await api.post<{ field: FarmField }>(`/farms/${farmId}/fields`, input);
    return result.field;
  },

  async updateField(fieldId: string, input: Partial<FarmFieldDraft>): Promise<FarmField> {
    const result = await api.patch<{ field: FarmField }>(`/farms/fields/${fieldId}`, input);
    return result.field;
  },

  async removeField(fieldId: string): Promise<void> {
    await api.delete<void>(`/farms/fields/${fieldId}`);
  },
};

export function canManageFarms(role: UserRole | null): boolean {
  return role === 'organization_administrator' || role === 'farm_manager';
}