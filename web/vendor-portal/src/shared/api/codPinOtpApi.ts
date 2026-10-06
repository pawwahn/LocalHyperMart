import { apiRequest } from '@/shared/api/http';

export async function requestCodPinResetOtp(token: string): Promise<void> {
  await apiRequest<null>('/api/v1/users/me/cod-pin-otp/request', {
    method: 'POST',
    token,
  });
}
