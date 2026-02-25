/**
 * Typed API client — fetch wrapper for the LeadOps API.
 *
 * Features:
 * - Auto-injects Authorization: Bearer <token> from localStorage
 * - Auto-injects x-tenant-id header from VITE_TENANT_ID env var (dev convenience)
 * - Throws Error with the API's message on non-2xx responses
 * - Base URL configurable via VITE_API_URL (defaults to '' for Vite proxy)
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const TENANT_ID = (import.meta.env.VITE_TENANT_ID as string | undefined) ?? '';

function getToken(): string | null {
  return localStorage.getItem('access_token');
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth = false, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (TENANT_ID) {
    headers['x-tenant-id'] = TENANT_ID;
  }

  if (!skipAuth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, { ...rest, headers });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    let message = `Request failed with status ${response.status}`;
    if (contentType.includes('application/json')) {
      const body = (await response.json()) as { message?: string | string[] };
      const msg = body.message;
      message = Array.isArray(msg) ? msg.join('; ') : (msg ?? message);
    }
    throw new Error(message);
  }

  const ct = response.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return null as unknown as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: 'GET', ...opts }),

  post: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), ...opts }),

  patch: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body), ...opts }),

  del: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: 'DELETE', ...opts }),
};
