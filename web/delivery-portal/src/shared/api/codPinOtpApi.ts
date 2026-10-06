import { apiRequest } from '@/shared/api/http';

/** Sends OTP to the logged-in user's registered phone (hub/shop owner). Pilot: 111111 */
export async function requestCodPinResetOtp(token: string): Promise<void> {
  await apiRequest<null>('/api/v1/users/me/cod-pin-otp/request', {
    method: 'POST',
    token,
  });
}
