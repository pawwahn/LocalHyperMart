import { apiRequest } from '@/shared/api/http';
import { isPlatformAdminLoginRole, resolvePlatformAdminAccess } from '@/shared/auth/platformAdminAccess';
import type { AuthSession } from '@/shared/auth/session';

type LoginApiResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  roles: string[];
};

export async function refreshAccessToken(refreshToken: string): Promise<LoginApiResponse> {
  return apiRequest<LoginApiResponse>('/api/v1/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    skipAuthRetry: true,
  });
}

export async function login(phone: string, password: string): Promise<AuthSession> {
  const data = await apiRequest<LoginApiResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: { phone, password },
    skipAuthRetry: true,
  });

  const roles = data.roles ?? [];
  if (!isPlatformAdminLoginRole(roles)) {
    throw new Error('This portal is for KoyaKart app admins only.');
  }

  const access = resolvePlatformAdminAccess(roles);

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    userId: data.userId,
    roles,
    phone,
    displayName: access.roleLabel,
  };
}
