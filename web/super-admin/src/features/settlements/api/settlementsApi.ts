import { apiRequest } from '@/shared/api/http';

export type SettlementCandidate = {
  subOrderId: string;
  orderId: string;
  orderNumber: string;
  subOrderNumber: string;
  placedAt?: string | null;
  status: string;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  /** COD only: hub recorded agent remittance (close-day). */
  codRemittedToHub?: boolean | null;
  vendorAgentDelivery?: boolean;
  /** WITH_AGENT | AT_HUB | WITH_VENDOR | DECLARED_TO_VENDOR */
  codCashLocation?: string | null;
  codDeliveringAgentId?: string | null;
  codDeliveringAgentName?: string | null;
  codDeliveringAgentPhone?: string | null;
  subtotal: number;
  alreadySettled: boolean;
};

export type PendingSettlementClaim = {
  claimId: string;
  orderNumber?: string | null;
  amount: number;
  reason?: string | null;
};

export type SettlementCandidates = {
  vendorId: string;
  townId: string;
  from: string;
  to: string;
  pendingClaimChargebacks?: number | null;
  pendingClaimCount?: number | null;
  pendingClaims?: PendingSettlementClaim[] | null;
  items: SettlementCandidate[];
};

export type SettlementLine = {
  id: string;
  orderId: string;
  subOrderId: string;
  orderNumber?: string | null;
  subOrderNumber?: string | null;
  lineType: string;
  amount: number;
  description?: string | null;
};

export type SettlementVm = {
  id: string;
  townId: string;
  payeeType: string;
  direction?: string | null;
  payeeId: string;
  payeeName?: string | null;
  periodStart: string;
  periodEnd: string;
  periodType: string;
  grossAmount: number;
  commissionAmount: number;
  claimChargebacksAmount?: number | null;
  otherChargesAmount?: number | null;
  netAmount: number;
  status: string;
  payoutMethod?: string | null;
  transactionReference?: string | null;
  transactionNotes?: string | null;
  paidAt?: string | null;
  vendorAcknowledgedAt?: string | null;
  createdAt?: string | null;
  lines: SettlementLine[];
};

export function settlementClaimAmount(s: SettlementVm): number {
  const fromApi = Number(s.claimChargebacksAmount);
  if (Number.isFinite(fromApi) && fromApi > 0) return fromApi;
  const fromLines = (s.lines ?? [])
    .filter((l) => (l.lineType ?? '').toUpperCase() === 'ADJUSTMENT')
    .reduce((sum, l) => sum + Math.abs(Number(l.amount ?? 0)), 0);
  return Math.max(0, fromLines);
}

export function settlementOtherChargesAmount(s: SettlementVm): number {
  const fromApi = Number(s.otherChargesAmount);
  if (Number.isFinite(fromApi) && fromApi > 0) return fromApi;
  return (s.lines ?? [])
    .filter((l) => {
      const t = (l.lineType ?? '').toUpperCase();
      return t === 'OTHER_CHARGE' || t === 'PENALTY';
    })
    .reduce((sum, l) => sum + Math.abs(Number(l.amount ?? 0)), 0);
}

export type CreateSettlementInput = {
  townId: string;
  vendorId: string;
  vendorName?: string;
  periodStart: string;
  periodEnd: string;
  periodType: 'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM';
  direction?: 'PAYOUT' | 'COLLECTION';
  subOrderIds: string[];
  commissionAmount?: number;
  markPaid?: boolean;
  payoutMethod?: string;
  transactionReference?: string;
  transactionNotes?: string;
  paidAt?: string;
  otherChargesAmount?: number;
  otherChargesReason?: string;
};

function money(value: number | null | undefined): string {
  return `₹${Number(value ?? 0).toFixed(2)}`;
}

export function formatMoney(value: number | null | undefined): string {
  return money(value);
}

export async function fetchSettlementCandidates(
  token: string,
  params: { townId: string; vendorId: string; from: string; to: string },
): Promise<SettlementCandidates> {
  const q = new URLSearchParams(params);
  return apiRequest<SettlementCandidates>(`/api/v1/payments/settlements/candidates?${q}`, { token });
}

export type DeliveryPayeeType = 'HUB' | 'AGENT';

export type DeliveryFranchiseDue = {
  enabled: boolean;
  cadence: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  alreadyCollected: boolean;
  label: string;
};

export type DeliverySettlementCandidate = {
  orderId: string;
  orderNumber: string;
  deliveredAt?: string | null;
  paymentStatus?: string | null;
  vendorAgentDelivery?: boolean;
  lastMileCompleted: boolean;
  pickupCompleted: boolean;
  amount: number;
  alreadySettled: boolean;
  skipReason?: string | null;
};

export type DeliverySettlementCandidates = {
  townId: string;
  payeeId: string;
  payeeType: string;
  from: string;
  to: string;
  hubPayoutModel: string;
  franchise?: DeliveryFranchiseDue | null;
  items: DeliverySettlementCandidate[];
};

export type CreateDeliverySettlementInput = {
  townId: string;
  payeeType: DeliveryPayeeType;
  payeeId: string;
  payeeName?: string;
  periodStart: string;
  periodEnd: string;
  periodType: 'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM';
  kind: 'PER_ORDER' | 'FRANCHISE';
  orderIds?: string[];
  markPaid?: boolean;
  payoutMethod?: string;
  transactionReference?: string;
  transactionNotes?: string;
};

export async function listSettlements(
  token: string,
  params?: { townId?: string; payeeId?: string; status?: string; payeeType?: string },
): Promise<SettlementVm[]> {
  const q = new URLSearchParams();
  q.set('payeeType', params?.payeeType ?? 'VENDOR');
  if (params?.townId) q.set('townId', params.townId);
  if (params?.payeeId) q.set('payeeId', params.payeeId);
  if (params?.status) q.set('status', params.status);
  const data = await apiRequest<{ items: SettlementVm[] }>(
    `/api/v1/payments/settlements?${q.toString()}`,
    { token },
  );
  return data.items ?? [];
}

export async function createSettlement(
  token: string,
  input: CreateSettlementInput,
): Promise<SettlementVm> {
  return apiRequest<SettlementVm>('/api/v1/payments/settlements', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function fetchDeliverySettlementCandidates(
  token: string,
  params: { townId: string; payeeType: DeliveryPayeeType; payeeId: string; from: string; to: string },
): Promise<DeliverySettlementCandidates> {
  const q = new URLSearchParams(params);
  return apiRequest<DeliverySettlementCandidates>(
    `/api/v1/payments/settlements/delivery-candidates?${q}`,
    { token },
  );
}

export async function createDeliverySettlement(
  token: string,
  input: CreateDeliverySettlementInput,
): Promise<SettlementVm> {
  return apiRequest<SettlementVm>('/api/v1/payments/settlements/delivery', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function markSettlementPaid(
  token: string,
  settlementId: string,
  input: {
    payoutMethod: string;
    transactionReference?: string;
    transactionNotes?: string;
    paidAt?: string;
  },
): Promise<SettlementVm> {
  return apiRequest<SettlementVm>(`/api/v1/payments/settlements/${settlementId}/mark-paid`, {
    method: 'POST',
    token,
    body: input,
  });
}
