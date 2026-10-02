import { apiRequest } from '@/shared/api/http';

export type MembershipSlabOffer = {
  code: string;
  label: string;
  months: number;
  price: number;
  credits: number;
  purchasable: boolean;
};

export type MembershipMine = {
  active: boolean;
  creditsRemaining: number;
  usableCredits: number;
  expiresAt?: string | null;
  lastSlab?: string | null;
  pendingCashPurchaseId?: string | null;
};

export type MembershipCatalog = {
  platformEnabled: boolean;
  townSells: boolean;
  canPurchase: boolean;
  blockReason?: string | null;
  mine: MembershipMine;
  slabs: MembershipSlabOffer[];
};

export type MembershipPurchase = {
  purchaseId: string;
  slab: string;
  creditsGranted: number;
  price: number;
  channel: string;
  status: string;
  expiresAtAfter?: string | null;
  checkout?: {
    keyId?: string | null;
    gatewayOrderId: string;
    amountPaise: number;
    currency: string;
    name: string;
    description?: string | null;
    prefillContact?: string | null;
    logoUrl?: string | null;
  } | null;
};

export async function fetchMembershipCatalog(token: string, townId?: string): Promise<MembershipCatalog> {
  const q = townId ? `?townId=${encodeURIComponent(townId)}` : '';
  return apiRequest<MembershipCatalog>(`/api/v1/payments/memberships/catalog${q}`, { token });
}

export function cheapestPurchasable(catalog: MembershipCatalog | null): MembershipSlabOffer | null {
  if (!catalog) return null;
  const priced = catalog.slabs.filter((s) => s.purchasable && s.price > 0 && s.credits > 0);
  if (priced.length === 0) return null;
  return [...priced].sort((a, b) => a.price - b.price)[0] ?? null;
}

export async function fetchMyMembership(token: string): Promise<MembershipMine> {
  return apiRequest<MembershipMine>('/api/v1/payments/memberships/me', { token });
}

export async function fetchMembershipPurchase(
  token: string,
  purchaseId: string,
): Promise<MembershipPurchase> {
  return apiRequest<MembershipPurchase>(`/api/v1/payments/memberships/purchases/${purchaseId}`, {
    token,
    timeoutMs: 10_000,
  });
}

export async function purchaseMembership(
  token: string,
  input: { slab: string; channel: 'ONLINE' | 'CASH'; townId: string },
  idempotencyKey: string,
): Promise<MembershipPurchase> {
  return apiRequest<MembershipPurchase>('/api/v1/payments/memberships/purchase', {
    token,
    method: 'POST',
    body: input,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

export async function confirmMembershipPayment(
  token: string,
  input: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
): Promise<MembershipPurchase> {
  return apiRequest<MembershipPurchase>('/api/v1/payments/memberships/confirm', {
    token,
    method: 'POST',
    body: input,
  });
}
