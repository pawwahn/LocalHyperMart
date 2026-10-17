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
  /** PAYOUT = KoyaKart pays vendor; COLLECTION = vendor pays fees on shop-held cash. */
  direction?: string | null;
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
  /** Stored series, e.g. KK/26-27/OCT/0001. */
  serviceInvoiceNumber?: string | null;
  /** Set when the vendor confirmed the money reached them. */
  vendorAcknowledgedAt?: string | null;
  ackReminderCount?: number | null;
  ackRemindedAt?: string | null;
  vendorNotReceivedAt?: string | null;
  vendorNotReceivedNote?: string | null;
  /** Subscription bills only. */
  billSentAt?: string | null;
  vendorPaidAt?: string | null;
  vendorPaymentMethod?: string | null;
  vendorPaymentReference?: string | null;
  vendorPaymentNotes?: string | null;
  transactionNotes?: string | null;
  vendorPaymentRejectedAt?: string | null;
  vendorPaymentRejectReason?: string | null;
  lines?: VendorSettlementLine[] | null;
};

/** Pay a bill KoyaKart sent you (commission on cash kept in your shop / extra charge). */
export async function payVendorBill(
  token: string,
  vendorId: string,
  settlementId: string,
  input: { payoutMethod: string; transactionReference: string; transactionNotes?: string },
): Promise<VendorSettlement> {
  return apiRequest<VendorSettlement>(`/api/v1/payments/settlements/vendor/me/bills/${settlementId}/pay`, {
    method: 'POST',
    token,
    vendorId,
    body: input,
  });
}

/** COLLECTION bill sent to the vendor and not yet confirmed paid. */
export function isOpenVendorBill(s: VendorSettlement): boolean {
  return (
    (s.direction ?? '').toUpperCase() === 'COLLECTION' &&
    !(s.lines ?? []).some((l) => (l.lineType ?? '').toUpperCase() === 'SUBSCRIPTION') &&
    s.status !== 'PAID' &&
    !!s.billSentAt
  );
}

/** Shop-fee bills KoyaKart reminded you to pay, still unpaid. */
export async function fetchBillReminders(token: string, vendorId: string): Promise<VendorSettlement[]> {
  const data = await apiRequest<{ items: VendorSettlement[] }>(
    '/api/v1/payments/settlements/vendor/me/bill-reminders',
    { token, vendorId },
  );
  return data.items ?? [];
}

/** Paid payouts KoyaKart asked you to confirm, still not acknowledged. */
export async function fetchAckReminders(token: string, vendorId: string): Promise<VendorSettlement[]> {
  const data = await apiRequest<{ items: VendorSettlement[] }>(
    '/api/v1/payments/settlements/vendor/me/ack-reminders',
    { token, vendorId },
  );
  return data.items ?? [];
}

/** Monthly subscription — billed on its own, never netted against order payouts or COD commission. */
export type SubscriptionBill = {
  month: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  /** SENT (pay now) → PAYMENT_SUBMITTED (KoyaKart to confirm) → PAID; REJECTED → fix and pay again */
  status: 'SENT' | 'PAYMENT_SUBMITTED' | 'REJECTED' | 'PAID' | string;
  rejectedAt?: string | null;
  rejectReason?: string | null;
  settlementId?: string | null;
  billSentAt?: string | null;
  vendorPaidAt?: string | null;
  vendorPaymentMethod?: string | null;
  vendorPaymentReference?: string | null;
  vendorPaymentNotes?: string | null;
  paidAt?: string | null;
  payoutMethod?: string | null;
  transactionReference?: string | null;
  invoiceNumber?: string | null;
};

export async function fetchMySubscriptionBills(token: string, vendorId: string): Promise<SubscriptionBill[]> {
  const data = await apiRequest<{ items: SubscriptionBill[] }>(
    '/api/v1/payments/settlements/vendor/me/subscription-bills',
    { token, vendorId },
  );
  return data.items ?? [];
}

export async function paySubscriptionBill(
  token: string,
  vendorId: string,
  settlementId: string,
  input: { payoutMethod: string; transactionReference: string; transactionNotes?: string },
): Promise<SubscriptionBill> {
  return apiRequest<SubscriptionBill>(
    `/api/v1/payments/settlements/vendor/me/subscription-bills/${settlementId}/pay`,
    { method: 'POST', token, vendorId, body: input },
  );
}

export const PAYOUT_ACKED_EVENT = 'hlm:payout-acked';

/** Nav badge refresh after the shop confirms a payout or submits a bill. */
export const PAYOUT_ACTION_EVENT = 'hlm:payout-action';

/** Settlements and subscriptions the shop still has to confirm or pay. */
export function countVendorPayoutActions(
  settlements: VendorSettlement[],
  subscriptions: SubscriptionBill[],
): number {
  const settlementActions = settlements.filter((s) => {
    if (isSubscriptionSettlement(s)) return false;
    if (isOpenVendorBill(s)) return !s.vendorPaidAt;
    if (isCollectionSettlement(s)) return false;
    return s.status === 'PAID' && !s.vendorAcknowledgedAt && !s.vendorNotReceivedAt;
  }).length;
  const subscriptionActions = subscriptions.filter(
    (b) => b.status === 'SENT' || b.status === 'REJECTED',
  ).length;
  return settlementActions + subscriptionActions;
}

export async function reportPayoutNotReceived(
  token: string,
  vendorId: string,
  settlementId: string,
  note?: string,
): Promise<VendorSettlement> {
  return apiRequest<VendorSettlement>(
    `/api/v1/payments/settlements/${settlementId}/not-received`,
    { method: 'POST', token, vendorId, body: { note: note?.trim() || undefined } },
  );
}

export async function acknowledgeSettlement(
  token: string,
  vendorId: string,
  settlementId: string,
): Promise<VendorSettlement> {
  return apiRequest<VendorSettlement>(
    `/api/v1/payments/settlements/${settlementId}/acknowledge`,
    { method: 'POST', token, vendorId },
  );
}

/** Claim deductions applied on a settlement row. */
export function settlementClaimAmount(s: VendorSettlement): number {
  const fromLines = (s.lines ?? [])
    .filter((l) => (l.lineType ?? '').toUpperCase() === 'ADJUSTMENT')
    .reduce((sum, l) => sum + Math.abs(Number(l.amount ?? 0)), 0);
  if (isCollectionSettlement(s)) return fromLines;
  const fromApi = Number(s.claimChargebacksAmount);
  if (Number.isFinite(fromApi) && fromApi > 0) return fromApi;
  return fromLines;
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

export type CashHolderRole = 'PLATFORM' | 'VENDOR' | 'VENDOR_AGENT' | 'HUB_ADMIN' | 'HUB_AGENT' | 'UNKNOWN' | string;

export type OrderCashHolder = {
  subOrderId: string;
  orderId?: string | null;
  paymentMethod?: string | null;
  vendorAgentDelivery?: boolean;
  codCashLocation?: string | null;
  holderRole: CashHolderRole;
  holderLabel: string;
  holderDetail?: string | null;
  agentName?: string | null;
  hubName?: string | null;
};

export async function lookupOrderCashHolders(
  token: string,
  vendorId: string,
  subOrderIds: string[],
): Promise<Record<string, OrderCashHolder>> {
  if (subOrderIds.length === 0) return {};
  const data = await apiRequest<{ items: OrderCashHolder[] }>(
    '/api/v1/payments/settlements/vendor/me/cash-holders',
    {
      method: 'POST',
      token,
      vendorId,
      body: { subOrderIds },
    },
  );
  const map: Record<string, OrderCashHolder> = {};
  for (const item of data.items ?? []) {
    map[item.subOrderId] = item;
  }
  return map;
}

export function inferredCashHolder(row: {
  subOrderId: string;
  paymentMethod?: string | null;
  vendorAgentDelivery?: boolean;
}): OrderCashHolder {
  const pay = (row.paymentMethod ?? '').toUpperCase();
  if (pay !== 'COD') {
    return {
      subOrderId: row.subOrderId,
      paymentMethod: row.paymentMethod,
      vendorAgentDelivery: Boolean(row.vendorAgentDelivery),
      codCashLocation: 'ONLINE',
      holderRole: 'PLATFORM',
      holderLabel: 'App',
      holderDetail: 'UPI / online',
    };
  }
  if (row.vendorAgentDelivery) {
    return {
      subOrderId: row.subOrderId,
      paymentMethod: row.paymentMethod,
      vendorAgentDelivery: true,
      codCashLocation: 'WITH_AGENT',
      holderRole: 'VENDOR_AGENT',
      holderLabel: 'Shop agent',
      holderDetail: 'Still with your rider',
    };
  }
  return {
    subOrderId: row.subOrderId,
    paymentMethod: row.paymentMethod,
    vendorAgentDelivery: false,
    codCashLocation: 'WITH_AGENT',
    holderRole: 'HUB_AGENT',
    holderLabel: 'Hub agent',
    holderDetail: 'Still with hub rider',
  };
}

export function resolveCashHolder(
  row: {
    subOrderId: string;
    paymentMethod?: string | null;
    vendorAgentDelivery?: boolean;
  },
  api?: OrderCashHolder | null,
): OrderCashHolder {
  if (api && api.holderRole && api.holderRole !== 'UNKNOWN') {
    return api;
  }
  return inferredCashHolder(row);
}

export type VendorFeeQuote = {
  feeModel?: string | null;
  grossAmount: number;
  commissionAmount: number;
  subscriptionAmount: number;
  totalFeeAmount: number;
  suggestedNet: number;
  appliedSlabLabel?: string | null;
  breakdownLines?: string[] | null;
  lineFees?: number[] | null;
};

/** Estimated KoyaKart fee on unpaid bags, using the fee terms active on each order day. */
export async function quoteMyFees(
  token: string,
  vendorId: string,
  lines: Array<{ amount: number; placedAt?: string | null }>,
  opts?: { includeSubscription?: boolean },
): Promise<VendorFeeQuote> {
  return apiRequest<VendorFeeQuote>('/api/v1/vendors/me/commercial-terms/quote', {
    method: 'POST',
    token,
    vendorId,
    body: {
      includeSubscription: opts?.includeSubscription ?? false,
      orderLines: lines.map((l) => ({ amount: Math.max(0, Number(l.amount || 0)), placedAt: l.placedAt || undefined })),
    },
  });
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

/** Vendor paid KoyaKart (shop-held COD commission or monthly subscription) — not money paid out. */
export function isCollectionSettlement(s: VendorSettlement): boolean {
  return (s.direction ?? '').toUpperCase() === 'COLLECTION';
}

export function isSubscriptionSettlement(s: VendorSettlement): boolean {
  return (s.lines ?? []).some((l) => (l.lineType ?? '').toUpperCase() === 'SUBSCRIPTION');
}

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
    if (isCollectionSettlement(s)) continue;
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
