import { apiRequest } from '@/shared/api/http';

export type PlatformSettingsVm = {
  mapsEnabled: boolean;
  maintenanceMode: boolean;
  termsUrl: string;
  privacyUrl: string;
  refundUrl: string;
  termsText: string;
  privacyText: string;
  refundText: string;
  legalVersion: number;
  legalUpdatedAt: string;
  grievanceOfficer: string;
  supportPhone: string;
  /** Platform-wide buyer delivery fee in ₹ (not town-specific). */
  deliveryFee: number;
  /** Spoken and displayed for every vendor's new-order alert. */
  vendorOrderAlertMessage: string;
  membershipEnabled?: boolean;
  membershipQuarterlyPrice?: number;
  membershipQuarterlyCredits?: number;
  membershipHalfYearPrice?: number;
  membershipHalfYearCredits?: number;
  membershipAnnualPrice?: number;
  membershipAnnualCredits?: number;
  referralsEnabled?: boolean;
  mealPlannerEnabled?: boolean;
  referralReferrerRewardAmount?: number;
  referralRefereeRewardAmount?: number;
  referralShareBaseUrl?: string;
  referralShareMessageTemplate?: string;
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
    termsText: asString(data.termsText),
    privacyText: asString(data.privacyText),
    refundText: asString(data.refundText),
    legalVersion: asNumber(data.legalVersion, 1),
    legalUpdatedAt: asString(data.legalUpdatedAt),
    grievanceOfficer: asString(data.grievanceOfficer),
    supportPhone: asString(data.supportPhone),
    deliveryFee: asNumber(data.deliveryFee, 40),
    vendorOrderAlertMessage: asString(data.vendorOrderAlertMessage, 'Order received'),
    membershipEnabled: asBool(data.membershipEnabled, false),
    membershipQuarterlyPrice: asNumber(data.membershipQuarterlyPrice, 0),
    membershipQuarterlyCredits: asNumber(data.membershipQuarterlyCredits, 0),
    membershipHalfYearPrice: asNumber(data.membershipHalfYearPrice, 0),
    membershipHalfYearCredits: asNumber(data.membershipHalfYearCredits, 0),
    membershipAnnualPrice: asNumber(data.membershipAnnualPrice, 0),
    membershipAnnualCredits: asNumber(data.membershipAnnualCredits, 0),
    referralsEnabled: asBool(data.referralsEnabled, false),
    mealPlannerEnabled: asBool(data.mealPlannerEnabled, false),
    referralReferrerRewardAmount: asNumber(data.referralReferrerRewardAmount, 0),
    referralRefereeRewardAmount: asNumber(data.referralRefereeRewardAmount, 0),
    referralShareBaseUrl: asString(data.referralShareBaseUrl),
    referralShareMessageTemplate: asString(
      data.referralShareMessageTemplate,
      'Order groceries from local shops on HyperLocalMart. Use my code {code}: {link}',
    ),
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

export async function resetLegalDefaults(token: string): Promise<PlatformSettingsVm> {
  const data = await apiRequest<SettingsDto>('/api/v1/platform/settings', {
    method: 'PATCH',
    token,
    body: { resetLegalDefaults: true },
  });
  return mapSettings(data ?? {});
}
