import { isNativeApp } from './platform';

const DEFAULT_EMULATOR_GATEWAY = 'http://10.0.2.2:8080';

/**
 * Browser dev: empty string → Vite proxy `/api` to gateway.
 * Native: VITE_API_BASE_URL, else emulator host gateway (physical phone: set LAN IP at build time).
 */
export function resolveApiBaseUrl(viteApiBase: string | undefined): string {
  const fromEnv = String(viteApiBase ?? '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (isNativeApp()) return DEFAULT_EMULATOR_GATEWAY;
  return '';
}
