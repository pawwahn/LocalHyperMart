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
  /** Abort hanging requests so UI cannot stick on Loading forever. */
  timeoutMs?: number;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const DEFAULT_TIMEOUT_MS = 15_000;

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

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (err) {
    const aborted =
      (err instanceof DOMException && err.name === 'AbortError') ||
      (err instanceof Error && err.name === 'AbortError');
    if (aborted) {
      throw new ApiError('Request timed out. Check services are running, then refresh.', 408);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  let payload: ApiEnvelope<T> | null = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      // Only clear session when an authenticated call was rejected — anonymous
      // 401s (e.g. public route not yet allowed by an old gateway) must not log out.
      if (response.status === 401 && options.token) notifyUnauthorized();
      throw new ApiError(text || response.statusText, response.status);
    }
  }
  if (!response.ok) {
    if (response.status === 401 && options.token) notifyUnauthorized();
    throw new ApiError(payload?.message || response.statusText || 'Request failed', response.status);
  }
  if (payload == null) throw new ApiError('Empty response', response.status);
  return payload.data;
}
