import { ApiError } from '@/services/api';
import { configureSystemApiAuth, systemApi } from '@/services/systemApi';
import { useSystemAdminStore } from '@/store/systemAdmin.store';
import type {
  AnalyticsResult,
  ActivityItem,
  GlobalUserDetail,
  GlobalUserItem,
  MfaEnrollment,
  OrgDetail,
  OrgListItem,
  Paginated,
  PlatformHealth,
  SystemAdmin,
  SystemAdminAuthUser,
  SystemLoginResult,
  SystemSession,
  SystemOverview,
} from '@/types/system';

function isTemporaryFailure(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.code === 'NETWORK_ERROR' || error.code === 'REQUEST_TIMEOUT') return true;
  return error.status >= 500;
}

function toQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const systemAuthApi = {
  async login(adminId: string, password: string): Promise<SystemLoginResult> {
    return systemApi.post<SystemLoginResult>('/auth/login', { adminId, password });
  },

  async verifyMfa(mfaToken: string, code: string): Promise<SystemSession> {
    return systemApi.post<SystemSession>('/auth/verify-mfa', { mfaToken, code });
  },

  async refresh(): Promise<SystemSession> {
    return systemApi.post<SystemSession>('/auth/refresh', undefined, { skipAuthRetry: true });
  },

  async me(): Promise<SystemAdminAuthUser> {
    const result = await systemApi.get<{ user: SystemAdminAuthUser }>('/auth/me');
    return result.user;
  },

  async logout(): Promise<void> {
    await systemApi.post<void>('/auth/logout');
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await systemApi.post<void>('/auth/change-password', { currentPassword, newPassword });
  },

  async updateProfile(name: string, email: string): Promise<SystemAdminAuthUser> {
    const result = await systemApi.patch<{ user: SystemAdminAuthUser }>('/auth/profile', {
      name,
      email,
    });
    return result.user;
  },

  async beginMfaEnrollment(): Promise<MfaEnrollment> {
    return systemApi.post<MfaEnrollment>('/auth/mfa/enroll');
  },

  async confirmMfaEnrollment(code: string): Promise<void> {
    await systemApi.post<void>('/auth/mfa/confirm', { code });
  },

  async disableMfa(password: string): Promise<void> {
    await systemApi.post<void>('/auth/mfa/disable', { password });
  },

  async forgotPassword(email: string): Promise<{ message: string; devResetLink?: string }> {
    return systemApi.post<{ message: string; devResetLink?: string }>('/auth/forgot-password', {
      email,
    });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await systemApi.post<void>('/auth/reset-password', { token, password });
  },
};

let refreshing: Promise<boolean> | null = null;

export function configureSystemAuthHooks(): void {
  configureSystemApiAuth({
    getAccessToken: () => useSystemAdminStore.getState().accessToken,
    refreshSession: () => {
      if (!refreshing) {
        refreshing = systemAuthApi
          .refresh()
          .then((session) => {
            useSystemAdminStore.getState().setSession(session.user, session.accessToken);
            return true;
          })
          .catch((error) => {
            if (!isTemporaryFailure(error)) {
              useSystemAdminStore.getState().clearSession();
            }
            return false;
          })
          .finally(() => {
            refreshing = null;
          });
      }
      return refreshing;
    },
  });
}

export async function bootstrapSystemAuth(): Promise<void> {
  configureSystemAuthHooks();
  const store = useSystemAdminStore.getState();
  try {
    const session = await systemAuthApi.refresh();
    store.setSession(session.user, session.accessToken);
  } catch (error) {
    const keepPersisted = isTemporaryFailure(error) && store.status === 'authenticated';
    if (!keepPersisted) {
      store.clearSession();
    }
  }
}

export interface OrgListParams {
  search?: string;
  status?: string;
  sort?: string;
  order?: string;
  page?: number;
  pageSize?: number;
}

export interface UserListParams {
  search?: string;
  status?: string;
  role?: string;
  sort?: string;
  order?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditListParams {
  search?: string;
  action?: string;
  actorType?: string;
  organizationId?: string;
  page?: number;
  pageSize?: number;
}

export const systemPlatformApi = {
  overview(): Promise<SystemOverview> {
    return systemApi.get<SystemOverview>('/overview');
  },

  organizations(params: OrgListParams = {}): Promise<Paginated<OrgListItem>> {
    return systemApi.get<Paginated<OrgListItem>>(`/organizations${toQuery(params)}`);
  },

  organization(id: string): Promise<OrgDetail> {
    return systemApi.get<OrgDetail>(`/organizations/${id}`);
  },

  suspendOrganization(id: string): Promise<{ id: string; name: string; status: string }> {
    return systemApi.post<{ id: string; name: string; status: string }>(`/organizations/${id}/suspend`);
  },

  activateOrganization(id: string): Promise<{ id: string; name: string; status: string }> {
    return systemApi.post<{ id: string; name: string; status: string }>(`/organizations/${id}/activate`);
  },

  users(params: UserListParams = {}): Promise<Paginated<GlobalUserItem>> {
    return systemApi.get<Paginated<GlobalUserItem>>(`/users${toQuery(params)}`);
  },

  user(id: string): Promise<GlobalUserDetail> {
    return systemApi.get<GlobalUserDetail>(`/users/${id}`);
  },

  analytics(range: string, from?: string, to?: string): Promise<AnalyticsResult> {
    return systemApi.get<AnalyticsResult>(
      `/analytics${toQuery({ range, from, to })}`,
    );
  },

  auditLogs(params: AuditListParams = {}): Promise<Paginated<ActivityItem>> {
    return systemApi.get<Paginated<ActivityItem>>(`/audit-logs${toQuery(params)}`);
  },

  health(): Promise<PlatformHealth> {
    return systemApi.get<PlatformHealth>('/health');
  },

  administrators(): Promise<{ items: SystemAdmin[] }> {
    return systemApi.get<{ items: SystemAdmin[] }>('/administrators');
  },

  createAdministrator(input: {
    name: string;
    email?: string;
    password?: string;
    isOwner?: boolean;
  }): Promise<{ admin: SystemAdmin; temporaryPassword: string }> {
    return systemApi.post<{ admin: SystemAdmin; temporaryPassword: string }>(
      '/administrators',
      input,
    );
  },

  setAdministratorStatus(id: string, status: 'active' | 'disabled'): Promise<{ id: string; status: string }> {
    return systemApi.patch<{ id: string; status: string }>(`/administrators/${id}/status`, { status });
  },

  resetAdministratorPassword(id: string): Promise<{ id: string; temporaryPassword: string }> {
    return systemApi.post<{ id: string; temporaryPassword: string }>(
      `/administrators/${id}/reset-password`,
    );
  },
};
