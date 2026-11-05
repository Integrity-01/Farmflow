import { ApiError, api, configureApiAuth } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import type { AuthSession, AuthUser } from '@/types';

/**
 * A refresh that fails because the network is down (or the API is briefly
 * unavailable) must NOT destroy the session — otherwise going offline logs
 * the user out with no way to log back in. Only a definite 4xx rejection
 * means the session is truly invalid.
 */
function isTemporaryRefreshFailure(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.code === 'NETWORK_ERROR' || error.code === 'REQUEST_TIMEOUT') return true;
  return error.status >= 500;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  organizationId: string;
  accessKey: string;
  phone?: string;
}

export interface OrganizationAccess {
  id: string;
  name: string;
  joinMode?: 'open' | 'approval';
}

export interface VerifiedOrganizationState {
  organization: OrganizationAccess;
  accessKey: string;
  next?: string;
}

export interface CreateOrganizationInput {
  organizationName: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export const authApi = {
  async verifyOrganizationKey(accessKey: string): Promise<OrganizationAccess> {
    const result = await api.post<{ organization: OrganizationAccess }>(
      '/auth/verify-organization-key',
      { accessKey },
    );
    return result.organization;
  },

  async login(
    email: string,
    password: string,
    organizationId: string,
    accessKey: string,
  ): Promise<AuthSession> {
    return api.post<AuthSession>('/auth/login', {
      email,
      password,
      organizationId,
      accessKey,
    });
  },

  async register(input: RegisterInput): Promise<AuthSession> {
    return api.post<AuthSession>('/auth/register', input);
  },

  async adminLogin(adminId: string, password: string): Promise<AuthSession> {
    return api.post<AuthSession>('/auth/admin-login', { adminId, password });
  },

  async createOrganization(input: CreateOrganizationInput): Promise<
    AuthSession & { accessKey: string; adminId: string; organization: OrganizationAccess }
  > {
    return api.post<
      AuthSession & { accessKey: string; adminId: string; organization: OrganizationAccess }
    >('/auth/organizations', input);
  },

  async refresh(): Promise<AuthSession> {
    return api.post<AuthSession>('/auth/refresh', undefined, { skipAuthRetry: true });
  },

  async me(): Promise<AuthUser> {
    const result = await api.get<{ user: AuthUser }>('/auth/me');
    return result.user;
  },

  async logout(): Promise<void> {
    await api.post<void>('/auth/logout');
  },

  async forgotPassword(email: string): Promise<{ message: string; devResetLink?: string }> {
    return api.post<{ message: string; devResetLink?: string }>('/auth/forgot-password', {
      email,
    });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await api.post<void>('/auth/reset-password', { token, password });
  },
};

let refreshing: Promise<AuthSession> | null = null;

/**
 * Refresh tokens are single-use: a second refresh with the same cookie is
 * rejected, and a rejection clears the session. Share one in-flight request
 * so concurrent callers (a 401 retry racing the boot refresh, or React
 * StrictMode mounting the app twice) can never rotate the token twice.
 */
function refreshOnce(): Promise<AuthSession> {
  if (!refreshing) {
    refreshing = authApi.refresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export function configureAuthHooks(): void {
  configureApiAuth({
    getAccessToken: () => useAuthStore.getState().accessToken,
    refreshSession: async () => {
      try {
        const session = await refreshOnce();
        useAuthStore.getState().setSession(session.user, session.accessToken);
        return true;
      } catch (error) {
        if (!isTemporaryRefreshFailure(error)) {
          useAuthStore.getState().clearSession();
        }
        return false;
      }
    },
  });
}

export async function bootstrapAuth(): Promise<void> {
  configureAuthHooks();
  const store = useAuthStore.getState();
  try {
    const session = await refreshOnce();
    store.setSession(session.user, session.accessToken);
  } catch (error) {
    // Offline reload: keep the persisted session so the app shell and cached
    // data still open without a login (which is impossible offline anyway).
    const keepPersistedSession =
      isTemporaryRefreshFailure(error) && store.status === 'authenticated';
    if (!keepPersistedSession) {
      store.clearSession();
    }
  }
}