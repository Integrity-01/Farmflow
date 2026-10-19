import { ApiError, apiUrl, type RequestOptions } from '@/services/api';
import type { ApiErrorPayload } from '@/types';

const REQUEST_TIMEOUT_MS = 15_000;

interface SystemAuthHooks {
  getAccessToken?: () => string | null;
  refreshSession?: () => Promise<boolean>;
}

let authHooks: SystemAuthHooks = {};

export function configureSystemApiAuth(hooks: SystemAuthHooks): void {
  authHooks = hooks;
}

function systemUrl(path: string): string {
  return apiUrl(`/system${path.startsWith('/') ? path : `/${path}`}`);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  requestOptions: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = authHooks.getAccessToken?.();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(systemUrl(path), {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(
        'The request took too long. Please check your connection and try again.',
        408,
        'REQUEST_TIMEOUT',
      );
    }
    throw new ApiError('Please check your internet connection and try again.', 0, 'NETWORK_ERROR');
  }
  clearTimeout(timeoutId);

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (
    response.status === 401 &&
    !requestOptions.skipAuthRetry &&
    (payload as ApiErrorPayload | null)?.code === 'UNAUTHORIZED' &&
    authHooks.refreshSession
  ) {
    const refreshed = await authHooks.refreshSession();
    if (refreshed) {
      return request<T>(path, options, { ...requestOptions, skipAuthRetry: true });
    }
  }

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | undefined;
    throw new ApiError(
      errorPayload?.message ?? 'We could not complete that request. Please try again.',
      response.status,
      errorPayload?.code ?? 'REQUEST_FAILED',
    );
  }

  return payload as T;
}

export const systemApi = {
  get: <T>(path: string, requestOptions?: RequestOptions) =>
    request<T>(path, undefined, requestOptions),
  post: <T>(path: string, body?: unknown, requestOptions?: RequestOptions) =>
    request<T>(
      path,
      { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) },
      requestOptions,
    ),
  patch: <T>(path: string, body?: unknown, requestOptions?: RequestOptions) =>
    request<T>(
      path,
      { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) },
      requestOptions,
    ),
};
