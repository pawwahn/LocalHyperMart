import { apiRequest } from '@/shared/api/http';
import type { AuthSession } from '@/shared/auth/session';

type LoginApiResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  roles: string[];
};

/** Pilot vendor map — phone → vendor UUID used in X-Vendor-Id header */
export const PILOT_VENDOR_BY_PHONE: Record<string, string> = {
  '9876500001': 'b1111111-1111-4111-8111-111111111111',
  '9876500002': 'b2222222-2222-4222-8222-222222222222',
};

/** Fallback display names until shop API loads. Prefer live shopName from /vendors/me/shop. */
export const PILOT_SHOP_NAME_BY_PHONE: Record<string, string> = {
  '9876500001': 'Ravi Kirana',
  '9876500002': 'Siva General Store',
};

export async function login(phone: string, password: string): Promise<AuthSession> {
  const data = await apiRequest<LoginApiResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: { phone, password },
  });

  const roles = data.roles ?? [];
  if (!roles.includes('VENDOR')) {
    throw new Error('This portal is for vendors. Use a vendor pilot account.');
  }

  const vendorId = PILOT_VENDOR_BY_PHONE[phone];
  if (!vendorId) {
    throw new Error('No vendor shop mapped for this phone. Pilot vendors: 9876500001 or 9876500002.');
  }

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    userId: data.userId,
    roles,
    vendorId,
    phone,
    shopName: PILOT_SHOP_NAME_BY_PHONE[phone] ?? 'Your shop',
  };
}

export async function forgotPassword(phone: string): Promise<void> {
  await apiRequest<null>('/api/v1/auth/forgot-password', {
    method: 'POST',
    body: { phone },
  });
}

export async function resetPassword(phone: string, otp: string, newPassword: string): Promise<void> {
  await apiRequest<null>('/api/v1/auth/reset-password', {
    method: 'POST',
    body: { phone, otp, newPassword },
  });
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiRequest<null>('/api/v1/auth/change-password', {
    method: 'POST',
    token,
    body: { currentPassword, newPassword },
  });
}
