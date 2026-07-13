import { apiRequest } from '@/shared/api/http';
import { PILOT_TOWN_ID, type AuthSession } from '@/shared/auth/session';

type AuthApi = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  roles: string[];
};

export async function registerBuyer(input: {
  phone: string;
  password: string;
  firstName: string;
  lastName?: string;
}): Promise<void> {
  await apiRequest<unknown>('/api/v1/auth/register', {
    method: 'POST',
    body: input,
  });
}

export async function loginBuyer(phone: string, password: string): Promise<AuthSession> {
  const data = await apiRequest<AuthApi>('/api/v1/auth/login', {
    method: 'POST',
    body: { phone, password },
  });

  // Set default town for checkout/cart context
  try {
    await apiRequest('/api/v1/users/me', {
      method: 'PATCH',
      token: data.accessToken,
      body: { defaultTownId: PILOT_TOWN_ID },
    });
  } catch {
    // non-fatal for already configured profiles
  }

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    userId: data.userId,
    roles: data.roles ?? [],
    phone,
    townId: PILOT_TOWN_ID,
  };
}
