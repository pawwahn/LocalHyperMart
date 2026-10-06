import { apiRequest } from '@/shared/api/http';

export type FinanceLedgerEntry = {
  entryId: string;
  sourceType: string;
  bookDate: string;
  occurredAt?: string | null;
  direction: 'IN' | 'OUT';
  category: string;
  categoryLabel: string;
  cashNature: 'OPERATING' | 'PASS_THROUGH';
  amount: number;
  currency: string;
  counterpartyRole: string;
  counterpartyName?: string | null;
  counterpartyId?: string | null;
  townId?: string | null;
  paymentRail?: string | null;
  transactionReference?: string | null;
  narrative?: string | null;
  orderNumbers?: string | null;
  periodLabel?: string | null;
  settlementId?: string | null;
  orderId?: string | null;
};

export type FinanceLedgerDaily = {
  date: string;
  inflows: number;
  outflows: number;
  net: number;
  entries: number;
};

export type FinanceLedgerCategoryTotal = {
  category: string;
  categoryLabel: string;
  direction: 'IN' | 'OUT';
  cashNature: 'OPERATING' | 'PASS_THROUGH';
  entryCount: number;
  amount: number;
};

export type FinanceLedgerTownCashTotal = {
  townId: string;
  inflows: number;
  outflows: number;
  platformReceipts: number;
  passThroughInflows: number;
  passThroughOutflows: number;
};

export type FinanceLedgerPartyCashTotal = {
  partyId: string;
  partyName?: string | null;
  inflows: number;
  outflows: number;
  franchiseFees: number;
  codRemittances: number;
  otherInflows: number;
  payouts: number;
  txnCount: number;
};

export type FinanceLedgerReport = {
  from: string;
  to: string;
  townId?: string | null;
  townName?: string | null;
  totalInflows: number;
  totalOutflows: number;
  netCashMovement: number;
  passThroughInflows: number;
  passThroughOutflows: number;
  platformReceipts: number;
  operatingOutflows?: number;
  walletGranted?: number;
  walletRedeemed?: number;
  walletScratch?: number;
  walletReferral?: number;
  walletStoreCredit?: number;
  entryCount: number;
  truncated: boolean;
  complianceNote: string;
  daily: FinanceLedgerDaily[];
  categoryTotals?: FinanceLedgerCategoryTotal[];
  townCashTotals?: FinanceLedgerTownCashTotal[];
  hubCashTotals?: FinanceLedgerPartyCashTotal[];
  vendorCashTotals?: FinanceLedgerPartyCashTotal[];
  entries: FinanceLedgerEntry[];
};

export async function fetchFinanceLedger(
  token: string,
  opts: { from: string; to: string; townId?: string },
): Promise<FinanceLedgerReport> {
  const params = new URLSearchParams({ from: opts.from, to: opts.to });
  if (opts.townId) params.set('townId', opts.townId);
  return apiRequest<FinanceLedgerReport>(`/api/v1/payments/admin/finance-ledger?${params}`, { token });
}

export type CompliancePack = {
  from: string;
  to: string;
  townId?: string | null;
  cashLedger: FinanceLedgerReport;
  accrual: {
    ordersDelivered: number;
    deliveredOrderValue: number;
    platformFeesOnDelivered: number;
    deliveryFeesOnDelivered: number;
    codFeesOnDelivered: number;
    vendorCommissionEarned: number;
    membershipRevenue: number;
    totalEstimatedPlatformRevenue: number;
    daily: Array<{
      date: string;
      ordersDelivered: number;
      platformFees: number;
      deliveredGmv: number;
      gstTotal: number;
    }>;
  };
  gst: {
    cgstOnDeliveredItems: number;
    sgstOnDeliveredItems: number;
    igstOnDeliveredItems: number;
    totalGstOnDeliveredItems: number;
    orderLevelTaxAmount: number;
    note: string;
  };
  tds: {
    ratePercent: number;
    legalNote: string;
    totalGrossSalesFacilitated: number;
    totalTdsEstimated: number;
    totalNetPaidToVendors: number;
    totalPlatformCommission: number;
    lines: Array<{
      settlementId: string;
      paidDate?: string | null;
      vendorName?: string | null;
      vendorId: string;
      grossSales: number;
      platformCommission: number;
      netPaid: number;
      tdsEstimated: number;
      transactionReference?: string | null;
    }>;
  };
  gateway: {
    appOnlineCollections: number;
    appOnlineRefunds: number;
    appNetOnline: number;
    importedSettlementGross: number;
    importedSettlementFees: number;
    importedSettlementNet: number;
    varianceAppNetVsBankNet: number;
    note: string;
    byDay: Array<{ date: string; appCollected: number; bankSettledNet: number; variance: number }>;
    batches: Array<{
      id: string;
      settlementDate: string;
      utrReference: string;
      grossAmount: number;
      feeAmount: number;
      netAmount: number;
      paymentCount?: number | null;
      notes?: string | null;
    }>;
  };
  /** Current API field (avoids JSON key `management`). */
  managementSummary?: {
    estimatedPlatformRevenue: number;
    platformCashReceipts: number;
    buyerRefunds: number;
    paymentGatewayFees: number;
    netSurplusBeforeOperatingExpenses: number;
    passThroughFloat: number;
    netCashMovement: number;
    walletGranted?: number;
    walletScratch?: number;
    walletReferral?: number;
    walletStoreCredit?: number;
    platformResultIndicator: 'SURPLUS' | 'SHORTFALL' | 'BREAK_EVEN';
    note: string;
  };
  /** @deprecated older builds */
  management?: CompliancePack['managementSummary'];
  payoutRegister?: {
    vendorPayouts: number;
    agentPayouts: number;
    hubDeliveryPayouts: number;
    franchiseFeesCollected: number;
    otherCollectionsFromHubs: number;
    vendorFeesCollected?: number;
    lines: Array<{
      settlementId: string;
      paidDate?: string | null;
      payeeType: string;
      direction: string;
      payeeName?: string | null;
      payeeId: string;
      townId: string;
      grossAmount: number;
      commissionAmount: number;
      netAmount: number;
      periodLabel?: string | null;
      transactionReference?: string | null;
      franchiseFee: boolean;
    }>;
  };
  refundRegister?: {
    refundCount: number;
    totalRefunded: number;
    lines: Array<{
      refundId: string;
      refundDate: string;
      orderId: string;
      paymentId: string;
      townId?: string | null;
      amount: number;
      reason?: string | null;
      gatewayReference?: string | null;
    }>;
  };
};

export async function fetchCompliancePack(
  token: string,
  opts: { from: string; to: string; townId?: string },
): Promise<CompliancePack> {
  const params = new URLSearchParams({ from: opts.from, to: opts.to });
  if (opts.townId) params.set('townId', opts.townId);
  return apiRequest<CompliancePack>(`/api/v1/payments/admin/finance-ledger/compliance-pack?${params}`, { token });
}

export async function recordGatewaySettlement(
  token: string,
  body: {
    settlementDate: string;
    utrReference: string;
    grossAmount: number;
    feeAmount: number;
    netAmount: number;
    paymentCount?: number;
    notes?: string;
  },
): Promise<CompliancePack['gateway']['batches'][number]> {
  return apiRequest(`/api/v1/payments/admin/finance-ledger/gateway-settlements`, {
    method: 'POST',
    token,
    body,
  });
}
