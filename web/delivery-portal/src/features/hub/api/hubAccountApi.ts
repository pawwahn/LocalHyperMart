import { apiRequest } from '@/shared/api/http';

export type HubPayout = {
  settlementId: string;
  kind: string;
  status: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  amount: number;
  reference?: string | null;
  recordedAt?: string | null;
  orderCount: number;
  payoutMethod?: string | null;
  invoiceNumber?: string | null;
  acknowledgedAt?: string | null;
  notReceivedAt?: string | null;
};

export type HubPayoutBill = {
  id: string;
  payeeName?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  netAmount?: number | null;
  status?: string | null;
  payoutMethod?: string | null;
  transactionReference?: string | null;
  transactionNotes?: string | null;
  paidAt?: string | null;
  serviceInvoiceNumber?: string | null;
  vendorAcknowledgedAt?: string | null;
  lines?: Array<{
    orderNumber?: string | null;
    amount?: number | null;
    description?: string | null;
  }>;
};

export type HubCommissionOrder = {
  orderId: string;
  orderNumber: string;
  deliveredAt?: string | null;
  amount: number;
  pickupCompleted: boolean;
  lastMileCompleted: boolean;
  settled?: boolean;
  reference?: string | null;
  paidAt?: string | null;
};

export type HubAccountSummary = {
  hubId: string;
  hubName?: string | null;
  townId: string;
  from: string;
  to: string;
  hubPayoutModel: string;
  commissionEnabled: boolean;
  pickupRate: number;
  lastMileRate: number;
  completedOrderRate: number;
  deliveredOrdersInRange: number;
  payableOrderCount: number;
  unpaidOrderCount: number;
  commissionEarned: number;
  commissionPaid: number;
  commissionDue: number;
  earnedOrderCount?: number;
  paidOrderCount?: number;
  earnedOrders?: HubCommissionOrder[];
  paidOrders?: HubCommissionOrder[];
  unpaidOrders: HubCommissionOrder[];
  payoutsFromPlatform: HubPayout[];
  franchiseEnabled: boolean;
  franchiseAmount: number;
  franchiseCollected: boolean;
  franchiseLabel?: string | null;
  codStillWithAgents: number;
  codDeclaredAwaitingConfirm: number;
  handoversAwaitingConfirm: number;
  codConfirmedAtHubAllTime: number;
  codRemittedToCompanyAllTime: number;
  codOwedToCompany: number;
  codPendingVerification?: boolean;
  franchisePendingVerification?: boolean;
  hasPendingPaymentSubmission?: boolean;
  pendingPaymentStatusLabel?: string | null;
  pendingPaymentTotal?: number | null;
  payableToPlatformNow?: number;
  recentPaymentSubmissions?: import('./hubPaymentApi').HubPaymentSubmission[];
  collectionsByPlatform: Array<{
    settlementId: string;
    kind: string;
    status: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    amount: number;
    reference?: string | null;
    recordedAt?: string | null;
    orderCount: number;
  }>;
};

/** Money actually received — same total as "Payouts already received". */
export function payoutsReceivedTotal(data: Pick<HubAccountSummary, 'payoutsFromPlatform'>): number {
  return (data.payoutsFromPlatform ?? []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

export async function fetchHubAccountSummary(
  token: string,
  from?: string,
  to?: string,
): Promise<HubAccountSummary> {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  const suffix = q.toString() ? `?${q}` : '';
  return apiRequest<HubAccountSummary>(`/api/v1/payments/hub/me/account-summary${suffix}`, { token });
}

export function fetchHubPayout(token: string, settlementId: string): Promise<HubPayoutBill> {
  return apiRequest<HubPayoutBill>(`/api/v1/payments/hub/me/payouts/${settlementId}`, { token });
}

export function acknowledgeHubPayout(token: string, settlementId: string): Promise<HubPayoutBill> {
  return apiRequest<HubPayoutBill>(`/api/v1/payments/hub/me/payouts/${settlementId}/acknowledge`, {
    method: 'POST',
    token,
  });
}

export function reportHubPayoutNotReceived(
  token: string,
  settlementId: string,
  note: string,
): Promise<HubPayoutBill> {
  return apiRequest<HubPayoutBill>(`/api/v1/payments/hub/me/payouts/${settlementId}/not-received`, {
    method: 'POST',
    token,
    body: { note },
  });
}
