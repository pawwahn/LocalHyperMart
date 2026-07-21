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

export type VendorSettlement = {
  id: string;
  townId?: string | null;
  payeeName?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  periodType?: string | null;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  status: string;
  payoutMethod?: string | null;
  transactionReference?: string | null;
  paidAt?: string | null;
};

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

export type SettlementMoneySummary = {
  paidNet: number;
  paidGross: number;
  paidCommission: number;
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
  let awaitingSettlementNet = 0;
  let awaitingSettlementGross = 0;
  let awaitingSettlementCommission = 0;
  let paidCount = 0;
  let awaitingCount = 0;
  for (const s of settlements) {
    const gross = Number(s.grossAmount ?? 0);
    const commission = Number(s.commissionAmount ?? 0);
    const net = Number(s.netAmount ?? 0);
    if (s.status === 'PAID') {
      paidCount += 1;
      paidNet += net;
      paidGross += gross;
      paidCommission += commission;
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
    awaitingSettlementNet,
    awaitingSettlementGross,
    awaitingSettlementCommission,
    paidCount,
    awaitingCount,
  };
}
