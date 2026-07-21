import { apiRequest } from '@/shared/api/http';
import type { AuthSession } from '@/shared/auth/session';

type LoginApiResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  roles: string[];
};

export async function login(phone: string, password: string): Promise<AuthSession> {
  const data = await apiRequest<LoginApiResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: { phone, password },
  });

  const roles = data.roles ?? [];
  if (!roles.includes('SUPER_ADMIN')) {
    throw new Error('This portal is for platform super admins only.');
  }

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    userId: data.userId,
    roles,
    phone,
    displayName: 'Super Admin',
  };
}
