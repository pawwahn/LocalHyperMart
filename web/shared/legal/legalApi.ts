export type LegalDocKey = 'terms' | 'privacy' | 'refund';

export type PublicLegal = {
  termsText: string;
  privacyText: string;
  refundText: string;
  legalVersion: number;
  legalUpdatedAt: string;
  termsUrl: string;
  privacyUrl: string;
  refundUrl: string;
  grievanceOfficer: string;
  supportPhone: string;
};

export function legalTitle(key: LegalDocKey): string {
  if (key === 'privacy') return 'Privacy policy';
  if (key === 'refund') return 'Refund, wallet & membership';
  return 'Terms & conditions';
}

export function legalBody(legal: PublicLegal, key: LegalDocKey): string {
  if (key === 'privacy') return legal.privacyText;
  if (key === 'refund') return legal.refundText;
  return legal.termsText;
}

export function formatLegalStamp(legal: Pick<PublicLegal, 'legalVersion' | 'legalUpdatedAt'>): string {
  const ver = legal.legalVersion > 0 ? `v${legal.legalVersion}` : '';
  if (!legal.legalUpdatedAt) return ver || 'Current';
  try {
    const d = new Date(legal.legalUpdatedAt);
    if (Number.isNaN(d.getTime())) return ver;
    return `${ver} · ${d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  } catch {
    return ver;
  }
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asNumber(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function mapPublicLegal(data: Record<string, unknown> | null | undefined): PublicLegal {
  return {
    termsText: asString(data?.termsText),
    privacyText: asString(data?.privacyText),
    refundText: asString(data?.refundText),
    legalVersion: asNumber(data?.legalVersion, 1),
    legalUpdatedAt: asString(data?.legalUpdatedAt),
    termsUrl: asString(data?.termsUrl),
    privacyUrl: asString(data?.privacyUrl),
    refundUrl: asString(data?.refundUrl),
    grievanceOfficer: asString(data?.grievanceOfficer),
    supportPhone: asString(data?.supportPhone),
  };
}

export async function fetchPublicLegal(): Promise<PublicLegal> {
  const response = await fetch('/api/v1/platform/settings/public', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await response.text();
  let payload: { data?: Record<string, unknown>; message?: string } | Record<string, unknown> = {};
  if (text) {
    try {
      payload = JSON.parse(text) as { data?: Record<string, unknown> };
    } catch {
      throw new Error(text || 'Could not load policies');
    }
  }
  if (!response.ok) {
    const msg =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message?: string }).message ?? 'Could not load policies')
        : 'Could not load policies';
    throw new Error(msg);
  }
  const data =
    payload && typeof payload === 'object' && 'data' in payload && payload.data
      ? payload.data
      : (payload as Record<string, unknown>);
  return mapPublicLegal(data);
}
