import { apiRequest } from '@/shared/api/http';

export type VendorAlertSettings = {
  vendorOrderAlertMessage: string;
};

type SettingsDto = Record<string, unknown>;

export async function fetchVendorAlertSettings(): Promise<VendorAlertSettings> {
  const data = await apiRequest<SettingsDto>('/api/v1/platform/settings/public');
  const raw = data?.vendorOrderAlertMessage;
  return {
    vendorOrderAlertMessage:
      typeof raw === 'string' && raw.trim() ? raw.trim() : 'Order received',
  };
}
