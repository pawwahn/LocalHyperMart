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
};

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
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
