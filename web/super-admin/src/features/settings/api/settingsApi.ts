import { apiRequest } from '@/shared/api/http';

export type PlatformSettingsVm = {
  mapsEnabled: boolean;
  maintenanceMode: boolean;
  termsUrl: string;
  privacyUrl: string;
  refundUrl: string;
  grievanceOfficer: string;
  supportPhone: string;
  /** Platform-wide buyer delivery fee in ₹ (not town-specific). */
  deliveryFee: number;
};

type SettingsDto = Record<string, unknown>;

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asNumber(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function mapSettings(data: SettingsDto): PlatformSettingsVm {
  return {
    mapsEnabled: asBool(data.mapsEnabled, false),
    maintenanceMode: asBool(data.maintenanceMode, false),
    termsUrl: asString(data.termsUrl),
    privacyUrl: asString(data.privacyUrl),
    refundUrl: asString(data.refundUrl),
    grievanceOfficer: asString(data.grievanceOfficer),
    supportPhone: asString(data.supportPhone),
    deliveryFee: asNumber(data.deliveryFee, 40),
  };
}

export async function getPlatformSettings(token: string): Promise<PlatformSettingsVm> {
  const data = await apiRequest<SettingsDto>('/api/v1/platform/settings', { token });
  return mapSettings(data ?? {});
}

export async function patchPlatformSettings(
  token: string,
  patch: Partial<PlatformSettingsVm>,
): Promise<PlatformSettingsVm> {
  const data = await apiRequest<SettingsDto>('/api/v1/platform/settings', {
    method: 'PATCH',
    token,
    body: patch,
  });
  return mapSettings(data ?? {});
}
