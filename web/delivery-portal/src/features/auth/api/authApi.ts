import { apiRequest } from '@/shared/api/http';
import type { AuthSession, PortalRole } from '@/shared/auth/session';

type LoginApiResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  roles: string[];
};

/** Pilot seed mapping */
export const PILOT = {
  hubAdminPhone: '9876500100',
  agentPhone: '9876500200',
  hubId: 'd1111111-1111-4111-8111-111111111111',
  townId: 'a1111111-1111-4111-8111-111111111111',
  agentId: 'e1111111-1111-4111-8111-111111111111',
} as const;

export async function login(phone: string, password: string): Promise<AuthSession> {
  const data = await apiRequest<LoginApiResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: { phone, password },
  });

  const roles = data.roles ?? [];
  let portalRole: PortalRole | null = null;
  if (roles.includes('HUB_ADMIN')) portalRole = 'HUB_ADMIN';
  else if (roles.includes('DELIVERY_AGENT')) portalRole = 'DELIVERY_AGENT';

  if (!portalRole) {
    throw new Error('This portal is for hub admins and delivery agents only.');
  }

  const session: AuthSession = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    userId: data.userId,
    roles,
    portalRole,
    phone,
  };

  if (portalRole === 'HUB_ADMIN') {
    session.hubId = PILOT.hubId;
    session.townId = PILOT.townId;
  } else {
    session.agentId = PILOT.agentId;
    session.townId = PILOT.townId;
  }

  return session;
}
