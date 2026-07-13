export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export type PageData<T> = {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/** Fired when the API rejects a request as unauthorized (expired/invalid JWT). */
export const AUTH_UNAUTHORIZED_EVENT = 'hlm:unauthorized';

function notifyUnauthorized(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let payload: ApiEnvelope<T> | null = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      if (response.status === 401) notifyUnauthorized();
      throw new ApiError(text || response.statusText, response.status);
    }
  }
  if (!response.ok) {
    if (response.status === 401) notifyUnauthorized();
    throw new ApiError(payload?.message || response.statusText || 'Request failed', response.status);
  }
  if (payload == null) throw new ApiError('Empty response', response.status);
  return payload.data;
}
