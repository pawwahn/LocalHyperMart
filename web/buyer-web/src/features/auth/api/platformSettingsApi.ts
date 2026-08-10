import { apiRequest } from '@/shared/api/http';

export type PublicPlatformSettingsVm = {
  termsUrl: string;
  privacyUrl: string;
  refundUrl: string;
  grievanceOfficer: string;
  supportPhone: string;
  deliveryFee: number;
};

type SettingsDto = Record<string, unknown>;

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asNumber(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export async function getPublicPlatformSettings(): Promise<PublicPlatformSettingsVm> {
  const data = await apiRequest<SettingsDto>('/api/v1/platform/settings/public');
  return {
    termsUrl: asString(data?.termsUrl),
    privacyUrl: asString(data?.privacyUrl),
    refundUrl: asString(data?.refundUrl),
    grievanceOfficer: asString(data?.grievanceOfficer),
    supportPhone: asString(data?.supportPhone),
    deliveryFee: asNumber(data?.deliveryFee, 40),
  };
}
