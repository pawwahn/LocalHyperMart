import { apiRequest, type PageData } from '@/shared/api/http';

export type AdminClaim = {
  claimId: string;
  orderId: string;
  orderNumber?: string | null;
  orderItemId?: string | null;
  itemName?: string | null;
  shopName?: string | null;
  quantity?: number | null;
  unitCode?: string | null;
  suggestedCreditAmount?: number | null;
  buyerId: string;
  townId: string;
  claimType: string;
  status: string;
  reason: string;
  resolution?: string | null;
  resolvedAmount?: number | null;
  resolutionNote?: string | null;
  createdAt?: string;
  resolvedAt?: string | null;
};

export async function listAdminClaims(
  token: string,
  townId: string,
  opts: { status?: string; page?: number; size?: number } = {},
): Promise<PageData<AdminClaim>> {
  const page = opts.page ?? 0;
  const size = opts.size ?? 25;
  const params = new URLSearchParams({
    townId,
    page: String(page),
    size: String(size),
  });
  if (opts.status) params.set('status', opts.status);
  return apiRequest<PageData<AdminClaim>>(`/api/v1/orders/admin/claims?${params}`, { token });
}

export async function resolveAdminClaim(
  token: string,
  townId: string,
  claimId: string,
  body: { resolution: 'WALLET_CREDIT' | 'NONE'; amount?: number; note?: string },
): Promise<AdminClaim> {
  return apiRequest<AdminClaim>(
    `/api/v1/orders/admin/claims/${claimId}/resolve?townId=${encodeURIComponent(townId)}`,
    { method: 'POST', token, body },
  );
}

export function money(n: number): string {
  return `₹${Number(n ?? 0).toFixed(2)}`;
}

export function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function claimTypeLabel(type: string): string {
  switch (type) {
    case 'WRONG_ITEM':
      return 'Wrong item / qty';
    case 'DAMAGED':
      return 'Damaged';
    case 'MISSING':
      return 'Missing';
    default:
      return type.replace(/_/g, ' ');
  }
}

export function shortOrderNo(orderNumber?: string | null): string {
  if (!orderNumber) return 'Order';
  const parts = orderNumber.split('/');
  return parts[parts.length - 1] || orderNumber;
}
