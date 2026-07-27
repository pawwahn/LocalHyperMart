const SESSION_KEY = 'hlm.buyer.session';

/**
 * @deprecated Seed town UUID for docs/tests only — buyer UI must not use this as a silent fallback.
 */
export const PILOT_TOWN_ID = 'a1111111-1111-4111-8111-111111111111';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  roles: string[];
  phone: string;
  /** Empty until the buyer picks a town. */
  townId: string;
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
