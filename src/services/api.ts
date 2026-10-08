import type { ApiErrorPayload } from '@/types';

const BASE_URL: string = import.meta.env.VITE_API_URL || '/api';

const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface AuthHooks {
  getAccessToken?: () => string | null;
  refreshSession?: () => Promise<boolean>;
}

let authHooks: AuthHooks = {};

export function configureApiAuth(hooks: AuthHooks): void {
  authHooks = hooks;
}

export interface RequestOptions {
  skipAuthRetry?: boolean;
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

const API_ORIGIN = (import.meta.env.VITE_API_URL as string | undefined)
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '').trim()
  : '';

export function fileUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

function humanMessage(payload: ApiErrorPayload | undefined, status: number): string {
  if (payload && payload.message) {
    return payload.message;
  }
  if (status >= 500) {
    return 'Something went wrong. Please try again.';
  }
  if (status === 404) {
    return "We couldn't find what you were looking for.";
  }
  return "We couldn't complete that request. Please try again.";
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  requestOptions: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const fetchWithTimeout = () =>
    fetch(apiUrl(path), {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });

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
    response = await fetchWithTimeout();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(
        'The request took too long. Please check your connection and try again.',
        408,
        'REQUEST_TIMEOUT',
      );
    }
    throw new ApiError(
      'Please check your internet connection and try again.',
      0,
      'NETWORK_ERROR',
    );
  }
  clearTimeout(timeoutId);

  const isJson = response.headers.get('content-type')?.includes('application/json');
  let payload: unknown = null;
  if (isJson) {
    payload = await response.json().catch(() => null);
  }

  if (
    response.status === 401 &&
    !requestOptions.skipAuthRetry &&
    (payload as ApiErrorPayload | null)?.code === 'UNAUTHORIZED' &&
    authHooks.refreshSession
  ) {
    const refreshed = await authHooks.refreshSession();
    if (refreshed) {
      // One refresh attempt per request only — without the guard a persistent
      // 401 turns into an infinite refresh/retry loop that burns the API
      // rate limit.
      return request<T>(path, options, { ...requestOptions, skipAuthRetry: true });
    }
  }

  if (!response.ok) {
    throw new ApiError(
      humanMessage(payload as ApiErrorPayload | undefined, response.status),
      response.status,
      (payload as ApiErrorPayload | undefined)?.code ?? 'REQUEST_FAILED',
    );
  }

  return payload as T;
}

export const api = {
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
  put: <T>(path: string, body?: unknown, requestOptions?: RequestOptions) =>
    request<T>(
      path,
      { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) },
      requestOptions,
    ),
  delete: <T>(path: string, requestOptions?: RequestOptions) =>
    request<T>(path, { method: 'DELETE' }, requestOptions),
  form: <T>(path: string, form: FormData, requestOptions?: RequestOptions) =>
    request<T>(
      path,
      { method: 'POST', body: form },
      requestOptions,
    ),
};