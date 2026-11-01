import { isNativeApp, resolveApiBaseUrl } from '@hlm-native';

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
  shopId?: string | null;
  townId?: string | null;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

const API_BASE = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
const DEFAULT_TIMEOUT_MS = 45_000;

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
  if (options.shopId) {
    headers['X-Shop-Id'] = options.shopId;
  }
  if (options.townId) {
    headers['X-Town-Id'] = options.townId;
  }

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
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('Request timed out. Check services are running, then refresh.', 408);
    }
    const msg = err instanceof Error ? err.message : String(err ?? '');
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      throw new ApiError(
        isNativeApp()
          ? 'Cannot reach KoyaKart server. Keep gateway running and retry.'
          : 'Cannot reach KoyaKart server. Check your connection and retry.',
        0,
      );
    }
    throw err;
  }
  clearTimeout(timer);

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
    const body = payload as (ApiEnvelope<T> & { error?: string }) | null;
    let message = body?.message?.trim() || body?.error?.trim() || response.statusText || 'Request failed';
    if (response.status >= 502 && response.status <= 504) {
      message =
        'Backend service unavailable. Run .\\scripts\\health-check.ps1 or .\\scripts\\start-dev.ps1, then refresh.';
    } else if (
      response.status >= 500 &&
      /internal server error/i.test(message) &&
      !body?.message?.trim()
    ) {
      message =
        'Orders backend error — order-service (port 8086) may be stopped. Restart it or run start-dev, then refresh.';
    }
    throw new ApiError(message, response.status);
  }

  if (payload == null) {
    throw new ApiError('Empty response', response.status);
  }

  return payload.data;
}
