import { apiRequest } from '@/shared/api/http';

export type OrderPayout = {
  subOrderId: string;
  orderId?: string | null;
  orderNumber?: string | null;
  subOrderNumber?: string | null;
  amount?: number | null;
  paid: boolean;
  settlementStatus?: string | null;
  settlementId?: string | null;
  paidAt?: string | null;
  payoutMethod?: string | null;
  transactionReference?: string | null;
  transactionNotes?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
};

export type VendorSettlementLine = {
  id: string;
  orderId?: string | null;
  subOrderId?: string | null;
  orderNumber?: string | null;
  subOrderNumber?: string | null;
  lineType: string;
  amount: number;
  description?: string | null;
};

export type VendorSettlement = {
  id: string;
  townId?: string | null;
  payeeName?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  periodType?: string | null;
  grossAmount: number;
  commissionAmount: number;
  /** Claim chargebacks deducted on this payout (buyer credits clawed back from vendor). */
  claimChargebacksAmount?: number | null;
  /** Admin penalty / other charges deducted on this payout. */
  otherChargesAmount?: number | null;
  netAmount: number;
  status: string;
  payoutMethod?: string | null;
  transactionReference?: string | null;
  paidAt?: string | null;
  lines?: VendorSettlementLine[] | null;
};

/** Claim deductions applied on a settlement row. */
export function settlementClaimAmount(s: VendorSettlement): number {
  const fromApi = Number(s.claimChargebacksAmount);
  if (Number.isFinite(fromApi) && fromApi > 0) return fromApi;
  return (s.lines ?? [])
    .filter((l) => (l.lineType ?? '').toUpperCase() === 'ADJUSTMENT')
    .reduce((sum, l) => sum + Math.abs(Number(l.amount ?? 0)), 0);
}

/** Admin penalty / other charges on a settlement row. */
export function settlementOtherChargesAmount(s: VendorSettlement): number {
  const fromApi = Number(s.otherChargesAmount);
  if (Number.isFinite(fromApi) && fromApi > 0) return fromApi;
  return (s.lines ?? [])
    .filter((l) => {
      const t = (l.lineType ?? '').toUpperCase();
      return t === 'OTHER_CHARGE' || t === 'PENALTY';
    })
    .reduce((sum, l) => sum + Math.abs(Number(l.amount ?? 0)), 0);
}

export async function lookupOrderPayouts(
  token: string,
  vendorId: string,
  subOrderIds: string[],
): Promise<Record<string, OrderPayout>> {
  if (subOrderIds.length === 0) return {};
  const data = await apiRequest<{ items: OrderPayout[] }>(
    '/api/v1/payments/settlements/vendor/me/lookup',
    {
      method: 'POST',
      token,
      vendorId,
      body: { subOrderIds },
    },
  );
  const map: Record<string, OrderPayout> = {};
  for (const item of data.items ?? []) {
    map[item.subOrderId] = item;
  }
  return map;
}

export async function listMySettlements(
  token: string,
  vendorId: string,
): Promise<VendorSettlement[]> {
  const data = await apiRequest<{ items: VendorSettlement[] }>('/api/v1/payments/settlements', {
    token,
    vendorId,
  });
  return data.items ?? [];
}

export type VendorClaimAdjustment = {
  id: string;
  townId?: string | null;
  vendorId: string;
  shopId?: string | null;
  claimId: string;
  orderId: string;
  orderNumber?: string | null;
  orderItemId: string;
  subOrderId: string;
  amount: number;
  reason?: string | null;
  status: 'PENDING' | 'APPLIED' | string;
  appliedSettlementId?: string | null;
  createdAt?: string | null;
};

export async function listMyClaimAdjustments(
  token: string,
  vendorId: string,
): Promise<VendorClaimAdjustment[]> {
  const data = await apiRequest<{ items: VendorClaimAdjustment[] }>(
    '/api/v1/payments/settlements/vendor/me/adjustments',
    { token, vendorId },
  );
  return data.items ?? [];
}

export type SettlementMoneySummary = {
  paidNet: number;
  paidGross: number;
  paidCommission: number;
  paidClaims: number;
  paidOtherCharges: number;
  awaitingSettlementNet: number;
  awaitingSettlementGross: number;
  awaitingSettlementCommission: number;
  paidCount: number;
  awaitingCount: number;
};

export function summarizeSettlements(settlements: VendorSettlement[]): SettlementMoneySummary {
  let paidNet = 0;
  let paidGross = 0;
  let paidCommission = 0;
  let paidClaims = 0;
  let paidOtherCharges = 0;
  let awaitingSettlementNet = 0;
  let awaitingSettlementGross = 0;
  let awaitingSettlementCommission = 0;
  let paidCount = 0;
  let awaitingCount = 0;
  for (const s of settlements) {
    const gross = Number(s.grossAmount ?? 0);
    const commission = Number(s.commissionAmount ?? 0);
    const net = Number(s.netAmount ?? 0);
    const claims = settlementClaimAmount(s);
    const other = settlementOtherChargesAmount(s);
    if (s.status === 'PAID') {
      paidCount += 1;
      paidNet += net;
      paidGross += gross;
      paidCommission += commission;
      paidClaims += claims;
      paidOtherCharges += other;
    } else {
      awaitingCount += 1;
      awaitingSettlementNet += net;
      awaitingSettlementGross += gross;
      awaitingSettlementCommission += commission;
    }
  }
  return {
    paidNet,
    paidGross,
    paidCommission,
    paidClaims,
    paidOtherCharges,
    awaitingSettlementNet,
    awaitingSettlementGross,
    awaitingSettlementCommission,
    paidCount,
    awaitingCount,
  };
}
