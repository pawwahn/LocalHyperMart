const SESSION_KEY = 'hlm.delivery.session';

export type PortalRole = 'HUB_ADMIN' | 'DELIVERY_AGENT';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  roles: string[];
  portalRole: PortalRole;
  phone: string;
  hubId?: string;
  hubName?: string;
  townId?: string;
  /** Display name from towns API, e.g. "Narsaraopet (Andhra Pradesh)". */
  townName?: string;
  agentId?: string;
  /** Delivery agent display name from delivery-service. */
  agentName?: string;
};

/** Infer portal role from stored session (handles older saves missing portalRole). */
export function resolvePortalRole(session: AuthSession): PortalRole | null {
  if (session.portalRole === 'HUB_ADMIN' || session.portalRole === 'DELIVERY_AGENT') {
    return session.portalRole;
  }
  const roles = session.roles ?? [];
  if (roles.includes('HUB_ADMIN')) return 'HUB_ADMIN';
  if (roles.includes('DELIVERY_AGENT')) return 'DELIVERY_AGENT';
  return null;
}

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    const portalRole = resolvePortalRole(parsed);
    if (portalRole && parsed.portalRole !== portalRole) {
      parsed.portalRole = portalRole;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
