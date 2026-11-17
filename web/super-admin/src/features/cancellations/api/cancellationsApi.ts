import { apiRequest, type PageData } from '@/shared/api/http';

export type CancellationKind = 'FULL' | 'PARTIAL';
export type CancellationVertical = 'GROCERY' | 'BEAUTY' | 'LAUNDRY' | 'DIAGNOSTICS';
export type CancellationInitiator = 'BUYER' | 'VENDOR' | 'PLATFORM' | 'UNKNOWN';

export type AdminCancellationRow = {
  kind: CancellationKind;
  vertical: CancellationVertical;
  orderId: string;
  orderNumber: string;
  townId: string;
  buyerId: string;
  buyerPhone?: string | null;
  vendorId?: string | null;
  shopId?: string | null;
  counterpartyName?: string | null;
  orderStatus: string;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  orderTotal: number;
  cancelledAmount: number;
  platformFee: number;
  amountCollected: number;
  occurredAt?: string | null;
  reason?: string | null;
  initiatedBy: CancellationInitiator;
  summary?: string | null;
  actionHints: string[];
  adminPath?: string | null;
  vendorPenaltySent?: boolean;
};

export function verticalLabel(v: CancellationVertical): string {
  switch (v) {
    case 'GROCERY':
      return 'Grocery / shop';
    case 'BEAUTY':
      return 'Glam';
    case 'LAUNDRY':
      return 'Laundry';
    case 'DIAGNOSTICS':
      return 'Diagnostics';
    default:
      return v;
  }
}

export function initiatorLabel(v: CancellationInitiator): string {
  switch (v) {
    case 'BUYER':
      return 'Buyer';
    case 'VENDOR':
      return 'Vendor';
    case 'PLATFORM':
      return 'Platform';
    default:
      return 'Unknown';
  }
}

export async function listAdminCancellations(
  token: string,
  params: {
    townId: string;
    kind: CancellationKind;
    vertical?: CancellationVertical;
    initiatedBy?: CancellationInitiator;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
  },
): Promise<PageData<AdminCancellationRow>> {
  const q = new URLSearchParams();
  q.set('townId', params.townId);
  q.set('kind', params.kind);
  if (params.vertical) q.set('vertical', params.vertical);
  if (params.initiatedBy) q.set('initiatedBy', params.initiatedBy);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 25));
  return apiRequest<PageData<AdminCancellationRow>>(`/api/v1/orders/admin/cancellations?${q}`, { token });
}

export type AdminBuyerCancelRisk = {
  buyerId: string;
  buyerPhone?: string | null;
  fullCancelCount: number;
  partialCancelCount: number;
  vendorRejectEvents: number;
  totalLostAmount: number;
  lastOccurredAt?: string | null;
  riskLevel: string;
  summary?: string | null;
};

export type AdminVendorCancelRisk = {
  vendorId: string;
  vendorName?: string | null;
  fullVendorCancelCount: number;
  shopRejectCount: number;
  buyerBagCancelCount: number;
  totalLostAmount: number;
  lastOccurredAt?: string | null;
  riskLevel: string;
  summary?: string | null;
};

export async function exportAdminCancellations(
  token: string,
  params: {
    townId: string;
    kind: CancellationKind;
    vertical?: CancellationVertical;
    initiatedBy?: CancellationInitiator;
    from?: string;
    to?: string;
  },
): Promise<AdminCancellationRow[]> {
  const q = new URLSearchParams();
  q.set('townId', params.townId);
  q.set('kind', params.kind);
  if (params.vertical) q.set('vertical', params.vertical);
  if (params.initiatedBy) q.set('initiatedBy', params.initiatedBy);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  return apiRequest<AdminCancellationRow[]>(`/api/v1/orders/admin/cancellations/export?${q}`, { token });
}

export async function listBuyerCancelRisks(
  token: string,
  params: { townId: string; from?: string; to?: string; page?: number; size?: number },
): Promise<PageData<AdminBuyerCancelRisk>> {
  const q = new URLSearchParams();
  q.set('townId', params.townId);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 25));
  return apiRequest<PageData<AdminBuyerCancelRisk>>(`/api/v1/orders/admin/cancellations/buyer-risk?${q}`, { token });
}

export async function listVendorCancelRisks(
  token: string,
  params: { townId: string; from?: string; to?: string; page?: number; size?: number },
): Promise<PageData<AdminVendorCancelRisk>> {
  const q = new URLSearchParams();
  q.set('townId', params.townId);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 25));
  return apiRequest<PageData<AdminVendorCancelRisk>>(`/api/v1/orders/admin/cancellations/vendor-risk?${q}`, { token });
}