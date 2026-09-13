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
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const REQUEST_TIMEOUT_MS = 8_000;

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onParentAbort);
  if (options.signal?.aborted) controller.abort();
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(
        options.signal?.aborted ? 'Cancelled' : 'Request timed out. Try again.',
        408,
      );
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener('abort', onParentAbort);
  }

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
  if (payload == null) throw new ApiError('Empty response', response.status);
  return payload.data;
}
