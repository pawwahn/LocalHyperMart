import { apiRequest } from '@/shared/api/http';

export type PublicPlatformSettingsVm = {
  termsUrl: string;
  privacyUrl: string;
  refundUrl: string;
  grievanceOfficer: string;
  supportPhone: string;
  deliveryFee: number;
  membershipEnabled: boolean;
  referralsEnabled: boolean;
  mealPlannerEnabled: boolean;
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

let settingsCache: { expiresAt: number; value: PublicPlatformSettingsVm } | null = null;
const SETTINGS_TTL_MS = 5 * 60 * 1000;

export function clearPublicPlatformSettingsCache() {
  settingsCache = null;
}

export async function getPublicPlatformSettings(): Promise<PublicPlatformSettingsVm> {
  const now = Date.now();
  if (settingsCache && now < settingsCache.expiresAt) {
    return settingsCache.value;
  }
  const data = await apiRequest<SettingsDto>('/api/v1/platform/settings/public', { timeoutMs: 5_000 });
  const value = {
    termsUrl: asString(data?.termsUrl),
    privacyUrl: asString(data?.privacyUrl),
    refundUrl: asString(data?.refundUrl),
    grievanceOfficer: asString(data?.grievanceOfficer),
    supportPhone: asString(data?.supportPhone),
    deliveryFee: asNumber(data?.deliveryFee, 40),
    membershipEnabled: data?.membershipEnabled === true,
    referralsEnabled: data?.referralsEnabled === true,
    mealPlannerEnabled: data?.mealPlannerEnabled === true,
  };
  settingsCache = { expiresAt: now + SETTINGS_TTL_MS, value };
  return value;
}
