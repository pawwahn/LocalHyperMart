import { apiRequest } from '@/shared/api/http';
import type { AuthSession } from '@/shared/auth/session';
import { loadTownPreference } from '@/shared/town/townPreference';

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
  acceptedTerms: boolean;
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
    timeoutMs: 12_000,
  });

  const townId = loadTownPreference()?.townId ?? '';

  // Town is applied on the client session. Do not block login on profile PATCH
  // (that call was leaving the Sign in button stuck on "Please wait…").
  if (townId) {
    void apiRequest('/api/v1/users/me', {
      method: 'PATCH',
      token: data.accessToken,
      body: { defaultTownId: townId },
      timeoutMs: 8_000,
    }).catch(() => undefined);
  }

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    userId: data.userId,
    roles: data.roles ?? [],
    phone,
    townId,
  };
}
