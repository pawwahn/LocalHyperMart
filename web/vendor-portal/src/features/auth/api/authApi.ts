import { apiRequest } from '@/shared/api/http';
import type { AuthSession } from '@/shared/auth/session';

type LoginApiResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  roles: string[];
};

type VendorMeResponse = {
  vendorId: string;
  townId?: string;
  businessName?: string | null;
  phone?: string | null;
  shopName?: string | null;
  shopId?: string | null;
  status?: string | null;
};

/**
 * @deprecated Seed IDs only — login resolves vendor from /vendors/me now.
 * Kept for docs/tests that reference pilot phones.
 */
export const PILOT_VENDOR_BY_PHONE: Record<string, string> = {
  '9876500001': 'b1111111-1111-4111-8111-111111111111',
  '9876500002': 'b2222222-2222-4222-8222-222222222222',
};

/** @deprecated Prefer live shopName from /vendors/me. Kept for docs/tests. */
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
    throw new Error('This portal is for vendors. Use a vendor account.');
  }

  const me = await apiRequest<VendorMeResponse>('/api/v1/vendors/me', {
    token: data.accessToken,
  });
  const vendorId = me.vendorId;
  const shopName = me.shopName ?? me.businessName ?? undefined;

  if (!vendorId) {
    throw new Error('No vendor shop linked to this login. Ask hub/admin to approve your registration.');
  }

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    userId: data.userId,
    roles,
    vendorId,
    phone,
    shopName: shopName ?? 'Your shop',
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
