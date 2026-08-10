import { apiRequest } from '@/shared/api/http';
import type { AuthSession, PortalRole } from '@/shared/auth/session';
import { resolveTownDisplayName } from '@/features/towns/api/townsApi';

type LoginApiResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  roles: string[];
};

type HubMeDto = {
  hubId: string;
  townId: string;
  hubName?: string;
};

type AgentMeDto = {
  agentId: string;
  townId: string;
  hubId?: string;
  name?: string;
  phone?: string;
};

/**
 * @deprecated Seed IDs only — login resolves hub/agent from API now.
 * Kept for docs/tests that reference pilot phones.
 */
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
    const me = await apiRequest<HubMeDto>('/api/v1/delivery/hubs/me', {
      token: data.accessToken,
    });
    session.hubId = me.hubId;
    session.townId = me.townId;
    if (me.hubName) session.hubName = me.hubName;
  } else {
    const me = await apiRequest<AgentMeDto>('/api/v1/delivery/agents/me', {
      token: data.accessToken,
    });
    session.agentId = me.agentId;
    session.townId = me.townId;
    if (me.hubId) session.hubId = me.hubId;
  }

  if (session.townId) {
    try {
      const townName = await resolveTownDisplayName(session.townId);
      if (townName) session.townName = townName;
    } catch {
      // Town label is best-effort; chrome still shows role + phone.
    }
  }

  return session;
}
