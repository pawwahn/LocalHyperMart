import { apiRequest } from '@/shared/api/http';

export type VendorCodPinStatus = {
  configured: boolean;
  defaultPinActive: boolean;
};

export async function fetchVendorCodPinStatus(token: string): Promise<VendorCodPinStatus> {
  return apiRequest<VendorCodPinStatus>('/api/v1/vendors/me/cod-pin/status', { token });
}

export async function setVendorCodPin(token: string, pin: string, otp: string): Promise<void> {
  await apiRequest<null>('/api/v1/vendors/me/cod-pin', {
    method: 'PUT',
    token,
    body: { pin, otp },
  });
}
