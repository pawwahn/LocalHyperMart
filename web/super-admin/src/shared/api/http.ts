export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
  timestamp?: string;
  correlationId?: string;
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
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  vendorId?: string | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Abort the request after this many ms (default 30s). */
  timeoutMs?: number;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.vendorId) {
    headers['X-Vendor-Id'] = options.vendorId;
  }

  const timeoutMs = options.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => clearTimeout(timeoutId);
  options.signal?.addEventListener('abort', onAbort, { once: true });

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal ?? controller.signal,
    });
  } catch (err) {
    onAbort();
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('Request timed out. Check that backend services are running.', 408);
    }
    throw err;
  }
  onAbort();

  let payload: ApiEnvelope<T> | null = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      throw new ApiError(text || response.statusText, response.status);
    }
  }

  if (!response.ok) {
    throw new ApiError(payload?.message || response.statusText || 'Request failed', response.status);
  }

  if (payload == null) {
    throw new ApiError('Empty response', response.status);
  }

  return payload.data;
}
