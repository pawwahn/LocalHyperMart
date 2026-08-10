import { apiRequest } from '@/shared/api/http';

export type SettlementCandidate = {
  subOrderId: string;
  orderId: string;
  orderNumber: string;
  subOrderNumber: string;
  placedAt?: string | null;
  status: string;
  paymentStatus?: string | null;
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

export async function listSettlements(
  token: string,
  params?: { townId?: string; payeeId?: string; status?: string },
): Promise<SettlementVm[]> {
  const q = new URLSearchParams();
  q.set('payeeType', 'VENDOR');
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
