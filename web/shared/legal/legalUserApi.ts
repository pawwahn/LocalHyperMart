export type LegalUserProfile = {
  termsVersion?: number | null;
  termsAcceptedAt?: string | null;
  roles?: string[];
};

function authHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export function isSessionExpiredError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('Session expired');
}

function profileError(status: number, body: string): Error {
  if (status === 401) {
    return new Error('Session expired. Sign out and sign in again.');
  }
  if (status === 403) {
    return new Error('Access denied. Use an account allowed for this portal.');
  }
  if (status === 408 || body.includes('timed out')) {
    return new Error('Request timed out. Check api-gateway (8080) and user-service (8081).');
  }
  if (status >= 502 || body.includes('Connection refused') || body.includes('connect')) {
    return new Error(
      'User service unreachable. From LocalHyperMart folder run: .\\scripts\\restart-service.ps1 user-service',
    );
  }
  if (status >= 500) {
    return new Error('Server error loading profile. Retry or restart user-service.');
  }
  try {
    const parsed = JSON.parse(body) as { message?: string };
    if (parsed.message) return new Error(parsed.message);
  } catch {
    /* ignore */
  }
  return new Error(`Could not load profile (HTTP ${status}).`);
}

export async function fetchLegalUserProfile(token: string): Promise<LegalUserProfile> {
  if (!token.trim()) {
    throw new Error('Not signed in. Go to login.');
  }
  let response: Response;
  try {
    response = await fetch('/api/v1/users/me', {
      headers: authHeaders(token),
      cache: 'no-store',
    });
  } catch {
    throw new Error(
      'Network error reaching /api (is Vite dev server proxying to localhost:8080?).',
    );
  }
  const text = await response.text();
  if (!response.ok) {
    throw profileError(response.status, text);
  }
  let payload: unknown = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('Invalid profile response from server.');
    }
  }
  const data = unwrapData<Record<string, unknown>>(payload);
  return {
    termsVersion: typeof data.termsVersion === 'number' ? data.termsVersion : null,
    termsAcceptedAt: typeof data.termsAcceptedAt === 'string' ? data.termsAcceptedAt : null,
    roles: Array.isArray(data.roles) ? data.roles.map(String) : [],
  };
}

export async function postAcceptLegal(token: string, legalVersion: number): Promise<void> {
  const response = await fetch('/api/v1/users/me/accept-legal', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ legalVersion }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw profileError(response.status, text);
  }
}

/** True when user must accept current platform legal version before using the app. */
export function needsLegalAcceptance(profile: LegalUserProfile, currentLegalVersion: number): boolean {
  const accepted = profile.termsVersion ?? 0;
  const current = currentLegalVersion > 0 ? currentLegalVersion : 1;
  return accepted < current;
}
