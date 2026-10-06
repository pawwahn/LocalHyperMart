export type PlatformBrandPublic = {
  brandLogoUrl: string;
  brandLogoMediaId: string;
  appName: string;
};

type SettingsDto = Record<string, unknown>;

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export async function fetchPlatformBrandPublic(): Promise<PlatformBrandPublic> {
  const response = await fetch('/api/v1/platform/settings/public', {
    headers: { Accept: 'application/json' },
  });
  let payload: { data?: SettingsDto } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    /* ignore */
  }
  const data = payload.data ?? {};
  const legal = asString(data.supplierLegalName, 'KoyaKart').trim() || 'KoyaKart';
  return {
    brandLogoUrl: asString(data.brandLogoUrl),
    brandLogoMediaId: asString(data.brandLogoMediaId),
    appName: legal,
  };
}

export function resolveBrandLogoSrc(logoUrl: string | null | undefined): string {
  const raw = (logoUrl ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
    return raw;
  }
  if (typeof window !== 'undefined' && raw.startsWith('/')) {
    return `${window.location.origin}${raw}`;
  }
  return raw;
}
