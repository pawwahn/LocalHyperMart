import { apiRequest } from '@/shared/api/http';
import { getPlatformSettings, patchPlatformSettings } from '@/features/settings/api/settingsApi';

export type MembershipSlabCode = 'QUARTERLY' | 'HALF_YEAR' | 'ANNUAL';

export type MembershipSettings = {
  membershipEnabled: boolean;
  membershipQuarterlyPrice: number;
  membershipQuarterlyCredits: number;
  membershipHalfYearPrice: number;
  membershipHalfYearCredits: number;
  membershipAnnualPrice: number;
  membershipAnnualCredits: number;
};

export type MembershipReport = {
  from: string;
  to: string;
  activeMembers: number;
  expiringIn7Days: number;
  usableCreditsOutstanding: number;
  packsSold: number;
  gifts: number;
  cashPending: number;
  paidRevenue: number;
  creditsGranted: number;
  deliveriesWaived: number;
  creditsRestored: number;
  deliveryFeeWaived: number;
  slabMix: { name: string; count: number; amount?: number }[];
  channelMix: { name: string; count: number; amount?: number }[];
};

export type MembershipMember = {
  buyerId: string;
  phone?: string | null;
  lastSlab: string;
  creditsRemaining: number;
  usableCredits: number;
  expiresAt: string;
  active: boolean;
};

export type MembershipPackRevision = {
  id: string;
  versionNo: number;
  sellingEnabled: boolean;
  quarterlyPrice: number;
  quarterlyCredits: number;
  halfYearPrice: number;
  halfYearCredits: number;
  annualPrice: number;
  annualCredits: number;
  changeSummary: string;
  changedBy?: string | null;
  createdAt: string;
};

export type MembershipPurchase = {
  purchaseId: string;
  buyerId: string;
  buyerPhone?: string | null;
  slab: string;
  months: number;
  creditsGranted: number;
  price: number;
  channel: string;
  status: string;
  paidAt?: string | null;
  expiresAtAfter?: string | null;
  createdAt?: string | null;
  note?: string | null;
  sellerPhone?: string | null;
};

function asNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export async function getMembershipSettings(token: string): Promise<MembershipSettings> {
  const all = await getPlatformSettings(token);
  return {
    membershipEnabled: all.membershipEnabled === true,
    membershipQuarterlyPrice: asNum(all.membershipQuarterlyPrice, 0),
    membershipQuarterlyCredits: asNum(all.membershipQuarterlyCredits, 0),
    membershipHalfYearPrice: asNum(all.membershipHalfYearPrice, 0),
    membershipHalfYearCredits: asNum(all.membershipHalfYearCredits, 0),
    membershipAnnualPrice: asNum(all.membershipAnnualPrice, 0),
    membershipAnnualCredits: asNum(all.membershipAnnualCredits, 0),
  };
}

export async function saveMembershipSettings(
  token: string,
  settings: MembershipSettings,
): Promise<MembershipSettings> {
  const saved = await patchPlatformSettings(token, settings);
  return {
    membershipEnabled: saved.membershipEnabled === true,
    membershipQuarterlyPrice: asNum(saved.membershipQuarterlyPrice, 0),
    membershipQuarterlyCredits: asNum(saved.membershipQuarterlyCredits, 0),
    membershipHalfYearPrice: asNum(saved.membershipHalfYearPrice, 0),
    membershipHalfYearCredits: asNum(saved.membershipHalfYearCredits, 0),
    membershipAnnualPrice: asNum(saved.membershipAnnualPrice, 0),
    membershipAnnualCredits: asNum(saved.membershipAnnualCredits, 0),
  };
}

export async function fetchMembershipPackHistory(token: string): Promise<MembershipPackRevision[]> {
  const rows = await apiRequest<Array<Record<string, unknown>>>(
    '/api/v1/platform/membership-pack-history',
    { token },
  );
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    id: String(row.id ?? ''),
    versionNo: asNum(row.versionNo, 0),
    sellingEnabled: row.sellingEnabled === true,
    quarterlyPrice: asNum(row.quarterlyPrice, 0),
    quarterlyCredits: asNum(row.quarterlyCredits, 0),
    halfYearPrice: asNum(row.halfYearPrice, 0),
    halfYearCredits: asNum(row.halfYearCredits, 0),
    annualPrice: asNum(row.annualPrice, 0),
    annualCredits: asNum(row.annualCredits, 0),
    changeSummary: typeof row.changeSummary === 'string' ? row.changeSummary : '',
    changedBy: typeof row.changedBy === 'string' ? row.changedBy : null,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
  }));
}

export async function fetchMembershipReport(
  token: string,
  opts: { from?: string; to?: string },
  request?: { timeoutMs?: number },
): Promise<MembershipReport> {
  const params = new URLSearchParams();
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  const q = params.toString();
  return apiRequest<MembershipReport>(`/api/v1/payments/admin/memberships/report${q ? `?${q}` : ''}`, {
    token,
    timeoutMs: request?.timeoutMs,
  });
}

export async function fetchMembershipMembers(token: string): Promise<MembershipMember[]> {
  return apiRequest<MembershipMember[]>('/api/v1/payments/admin/memberships/members', { token });
}

export async function fetchMembershipPurchases(token: string): Promise<MembershipPurchase[]> {
  return apiRequest<MembershipPurchase[]>('/api/v1/payments/admin/memberships/purchases', { token });
}

export async function fetchPendingCash(token: string): Promise<MembershipPurchase[]> {
  return apiRequest<MembershipPurchase[]>('/api/v1/payments/admin/memberships/pending-cash', { token });
}

export async function giftMembership(
  token: string,
  input: { phone: string; slab: MembershipSlabCode; note?: string },
): Promise<MembershipPurchase> {
  return apiRequest<MembershipPurchase>('/api/v1/payments/admin/memberships/gift', {
    token,
    method: 'POST',
    body: input,
  });
}

export async function confirmMembershipCash(
  token: string,
  input: { purchaseId?: string; phone?: string },
): Promise<MembershipPurchase> {
  return apiRequest<MembershipPurchase>('/api/v1/payments/admin/memberships/cash/confirm', {
    token,
    method: 'POST',
    body: input,
  });
}

export async function cancelMembershipCash(token: string, purchaseId: string): Promise<MembershipPurchase> {
  return apiRequest<MembershipPurchase>(`/api/v1/payments/admin/memberships/cash/${purchaseId}/cancel`, {
    token,
    method: 'POST',
  });
}
