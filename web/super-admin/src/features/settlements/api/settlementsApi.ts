import { apiRequest } from '@/shared/api/http';

export type SettlementCandidate = {
  subOrderId: string;
  orderId: string;
  orderNumber: string;
  subOrderNumber: string;
  placedAt?: string | null;
  /** Payout window day (IST). Commission rate still follows placedAt. */
  deliveredAt?: string | null;
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
  ackReminderCount?: number | null;
  ackRemindedAt?: string | null;
  vendorNotReceivedAt?: string | null;
  vendorNotReceivedNote?: string | null;
  serviceInvoiceNumber?: string | null;
  billSentAt?: string | null;
  vendorPaidAt?: string | null;
  vendorPaymentMethod?: string | null;
  vendorPaymentReference?: string | null;
  vendorPaymentNotes?: string | null;
  vendorPaymentRejectedAt?: string | null;
  vendorPaymentRejectReason?: string | null;
  createdAt?: string | null;
  lines: SettlementLine[];
};

export function settlementClaimAmount(s: SettlementVm): number {
  const fromLines = (s.lines ?? [])
    .filter((l) => (l.lineType ?? '').toUpperCase() === 'ADJUSTMENT')
    .reduce((sum, l) => sum + Math.abs(Number(l.amount ?? 0)), 0);
  if ((s.direction ?? '').toUpperCase() === 'COLLECTION') return Math.max(0, fromLines);
  const fromApi = Number(s.claimChargebacksAmount);
  if (Number.isFinite(fromApi) && fromApi > 0) return fromApi;
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
  /** COLLECTION + markPaid false: issue the bill; vendor pays and admin confirms. */
  sendBill?: boolean;
  payoutMethod?: string;
  transactionReference?: string;
  transactionNotes?: string;
  paidAt?: string;
  otherChargesAmount?: number;
  otherChargesReason?: string;
};

export async function confirmVendorBillPayment(
  token: string,
  settlementId: string,
  input: { transactionNotes?: string } = {},
): Promise<SettlementVm> {
  return apiRequest<SettlementVm>(`/api/v1/payments/settlements/admin/vendor-bills/${settlementId}/confirm`, {
    method: 'POST',
    token,
    body: input,
  });
}

export async function rejectVendorBillPayment(token: string, settlementId: string, reason: string): Promise<SettlementVm> {
  return apiRequest<SettlementVm>(`/api/v1/payments/settlements/admin/vendor-bills/${settlementId}/reject`, {
    method: 'POST',
    token,
    body: { reason },
  });
}

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

export type SubscriptionBill = {
  /** yyyy-MM */
  month: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  /** NOT_SENT → SENT (vendor to pay) → PAYMENT_SUBMITTED (admin to confirm / reject) → PAID; REJECTED → vendor resubmits */
  status: 'NOT_SENT' | 'SENT' | 'PAYMENT_SUBMITTED' | 'REJECTED' | 'PAID' | string;
  rejectedAt?: string | null;
  rejectReason?: string | null;
  settlementId?: string | null;
  billSentAt?: string | null;
  vendorPaidAt?: string | null;
  /** yyyy-MM-dd on the bank statement. Null until admin sets it. */
  bankPaidOn?: string | null;
  vendorPaymentMethod?: string | null;
  vendorPaymentReference?: string | null;
  vendorPaymentNotes?: string | null;
  paidAt?: string | null;
  payoutMethod?: string | null;
  transactionReference?: string | null;
  invoiceNumber?: string | null;
};

export async function sendSubscriptionBill(
  token: string,
  input: { townId: string; vendorId: string; vendorName?: string; month: string },
): Promise<SubscriptionBill> {
  return apiRequest<SubscriptionBill>('/api/v1/payments/settlements/admin/subscription-bills/send', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function rejectSubscriptionPayment(
  token: string,
  settlementId: string,
  reason: string,
): Promise<SubscriptionBill> {
  return apiRequest<SubscriptionBill>(
    `/api/v1/payments/settlements/admin/subscription-bills/${settlementId}/reject`,
    { method: 'POST', token, body: { reason } },
  );
}

export async function correctSubscriptionPayment(
  token: string,
  settlementId: string,
  input: { bankPaidOn: string; payoutMethod: string; transactionReference: string; transactionNotes?: string },
): Promise<SubscriptionBill> {
  return apiRequest<SubscriptionBill>(
    `/api/v1/payments/settlements/admin/subscription-bills/${settlementId}/correct`,
    { method: 'POST', token, body: input },
  );
}

export async function confirmSubscriptionPayment(
  token: string,
  settlementId: string,
  input: { payoutMethod?: string; transactionReference?: string; transactionNotes?: string } = {},
): Promise<SubscriptionBill> {
  return apiRequest<SubscriptionBill>(
    `/api/v1/payments/settlements/admin/subscription-bills/${settlementId}/confirm`,
    { method: 'POST', token, body: input },
  );
}

export async function listSubscriptionBills(token: string, vendorId: string): Promise<SubscriptionBill[]> {
  const data = await apiRequest<{ items: SubscriptionBill[] }>(
    `/api/v1/payments/settlements/admin/subscription-bills?vendorId=${encodeURIComponent(vendorId)}`,
    { token },
  );
  return data.items ?? [];
}

export async function collectSubscriptionBill(
  token: string,
  input: {
    townId: string;
    vendorId: string;
    vendorName?: string;
    month: string;
    payoutMethod: string;
    transactionReference: string;
    transactionNotes?: string;
  },
): Promise<SettlementVm> {
  return apiRequest<SettlementVm>('/api/v1/payments/settlements/admin/subscription-bills', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function correctVendorPayout(
  token: string,
  settlementId: string,
  input: { payoutMethod: string; transactionReference: string; transactionNotes?: string },
): Promise<SettlementVm> {
  return apiRequest<SettlementVm>(`/api/v1/payments/settlements/${settlementId}/correct-payout`, {
    method: 'POST',
    token,
    body: input,
  });
}

export async function remindVendorBill(token: string, settlementId: string): Promise<SettlementVm> {
  return apiRequest<SettlementVm>(`/api/v1/payments/settlements/${settlementId}/remind-bill`, {
    method: 'POST',
    token,
  });
}

export async function remindSettlementAck(token: string, settlementId: string): Promise<SettlementVm> {
  return apiRequest<SettlementVm>(`/api/v1/payments/settlements/${settlementId}/remind-ack`, {
    method: 'POST',
    token,
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
