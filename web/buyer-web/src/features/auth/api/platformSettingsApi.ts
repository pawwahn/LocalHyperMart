import { apiRequest } from '@/shared/api/http';

export type PublicPlatformSettingsVm = {
  termsUrl: string;
  privacyUrl: string;
  refundUrl: string;
  grievanceOfficer: string;
  supportPhone: string;
};

type SettingsDto = Record<string, unknown>;

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export async function getPublicPlatformSettings(): Promise<PublicPlatformSettingsVm> {
  const data = await apiRequest<SettingsDto>('/api/v1/platform/settings/public');
  return {
    termsUrl: asString(data?.termsUrl),
    privacyUrl: asString(data?.privacyUrl),
    refundUrl: asString(data?.refundUrl),
    grievanceOfficer: asString(data?.grievanceOfficer),
    supportPhone: asString(data?.supportPhone),
  };
}
