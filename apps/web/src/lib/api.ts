const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const DEV_TENANT = (import.meta.env.VITE_TENANT_ID as string | undefined) ?? '';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

interface ApiErrorBody {
  error?: {
    message?: string | string[];
  };
}

function token(): string | null {
  return localStorage.getItem('access_token');
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth = false, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string>),
  };

  if (DEV_TENANT) {
    headers['x-tenant-id'] = DEV_TENANT;
  }

  if (!skipAuth) {
    const bearer = token();
    if (bearer) {
      headers.Authorization = `Bearer ${bearer}`;
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    let message = `Request failed (${response.status})`;

    if (contentType.includes('application/json')) {
      const body = (await response.json()) as ApiErrorBody;
      const raw = body.error?.message;
      message = Array.isArray(raw) ? raw.join(', ') : raw ?? message;
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null as T;
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions): Promise<T> => request(path, { method: 'GET', ...opts }),
  post: <T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> =>
    request(path, { method: 'POST', body: JSON.stringify(body), ...opts }),
  patch: <T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> =>
    request(path, { method: 'PATCH', body: JSON.stringify(body), ...opts }),
  delete: <T>(path: string, opts?: RequestOptions): Promise<T> => request(path, { method: 'DELETE', ...opts }),
};
