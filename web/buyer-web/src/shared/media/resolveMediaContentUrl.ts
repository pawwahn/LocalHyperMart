import { resolveApiBaseUrl } from '@hlm-native';

const API_BASE = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

/** Prefix gateway host for native builds so dish and hotel photos load. */
export function resolveMediaContentUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`;
}