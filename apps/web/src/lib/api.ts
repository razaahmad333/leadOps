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

function selectedBranchId(): string | null {
  const raw = localStorage.getItem('session');
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { selectedBranchId?: string | null };
    return typeof parsed.selectedBranchId === 'string' && parsed.selectedBranchId.trim().length > 0
      ? parsed.selectedBranchId.trim()
      : null;
  } catch {
    return null;
  }
}

function token(): string | null {
  return localStorage.getItem('access_token');
}

function buildHeaders(options: RequestOptions = {}): Record<string, string> {
  const { skipAuth = false, ...rest } = options;
  const bearer = skipAuth ? null : token();

  const headers: Record<string, string> = {
    ...(rest.headers as Record<string, string>),
  };

  // In authenticated SaaS mode, tenant context should come from the JWT tenant,
  // not a dev-only fixed header, otherwise tenant switching gets pinned to the old tenant.
  if (DEV_TENANT && !bearer) {
    headers['x-tenant-id'] = DEV_TENANT;
  }

  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;

    const branchId = selectedBranchId();
    if (branchId) {
      headers['x-branch-id'] = branchId;
    }
  }

  return headers;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { ...rest } = options;

  const headers = buildHeaders({
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(rest.headers as Record<string, string>),
    },
  });

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
  download: async (path: string, opts?: RequestOptions): Promise<Response> => {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      ...opts,
      headers: buildHeaders(opts),
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

    return response;
  },
};
