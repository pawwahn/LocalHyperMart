import { apiRequest } from '@/shared/api/http';

export type NamedAmount = { name: string; count: number; amount?: number };

export type HsnGstRow = {
  hsn: string;
  gstPercent: number;
  lines: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  amount: number;
};

export type OpsAssuranceReport = {
  from: string;
  to: string;
  townId?: string | null;
  gstByHsn: HsnGstRow[];
  gstTaxable: number;
  gstCgst: number;
  gstSgst: number;
  gstIgst: number;
  gstCess: number;
  gstTotal: number;
  claimsOpened: number;
  claimsOpen: number;
  claimsResolved: number;
  claimsRejected: number;
  claimsCredited: number;
  claimsByType: NamedAmount[];
  claimsByTown: NamedAmount[];
  ordersPlaced: number;
  deliveredOnTime: number;
  deliveredLate: number;
  stillOpen: number;
  openOverdue: number;
  cancelled: number;
  lateDeliveryRate?: number | null;
  avgDeliveryMinutes?: number | null;
};

export type AgingBucket = { label: string; count: number; amount: number };
export type UnpaidLine = {
  settlementId: string;
  payeeType: string;
  payeeName: string;
  status: string;
  ageDays: number;
  netAmount: number;
  periodEnd?: string | null;
};

export type MoneyAssuranceReport = {
  from: string;
  to: string;
  unpaidPayouts: number;
  unpaidPayoutAmount: number;
  aging: AgingBucket[];
  oldestUnpaid: UnpaidLine[];
  walletLiability: number;
  walletsWithBalance: number;
  walletCreditsInRange: number;
  walletCreditCount: number;
  walletDebitsInRange: number;
  walletDebitCount: number;
  walletScratch?: number;
  walletReferral?: number;
  walletStoreCredit?: number;
  walletCreditsByReason?: NamedAmount[];
};

export type AdRevenueReport = {
  from: string;
  to: string;
  invoiceCount: number;
  paidCount: number;
  issuedCount: number;
  voidCount: number;
  billed: number;
  collected: number;
  outstanding: number;
  taxCollected: number;
  bySlot: NamedAmount[];
  byStatus: NamedAmount[];
};

export type ReferralCandidate = {
  userId: string;
  name: string;
  phone: string;
  code: string;
  referred: number;
  converted: number;
  refereePaid: number;
  earned: number;
  companySpent: number;
  companyPending: number;
};

export type ReferralLine = {
  attributionId: string;
  createdAt: string;
  code: string;
  referrerUserId: string;
  referrerName: string;
  referrerPhone: string;
  refereeUserId: string;
  refereeName: string;
  refereePhone: string;
  refereePaid: boolean;
  refereeAmount: number;
  referrerPaid: boolean;
  referrerAmount: number;
  companySpent: number;
  companyPending: number;
  qualifyingOrderId?: string | null;
  referrerPaidAt?: string | null;
};

export type ReferralReport = {
  from: string;
  to: string;
  programEnabled: boolean;
  referrerRewardAmount: number;
  refereeRewardAmount: number;
  amountsFromWallet: boolean;
  signups: number;
  uniqueReferrers: number;
  converted: number;
  referrerRewarded: number;
  refereeRewarded: number;
  pendingReferrer: number;
  pendingReferee: number;
  spentOnReferrers: number;
  spentOnReferees: number;
  companySpent: number;
  companyPending: number;
  companyIfAllPaid: number;
  candidates: ReferralCandidate[];
  lines: ReferralLine[];
};

function q(opts: { townId?: string; from?: string; to?: string }): string {
  const params = new URLSearchParams();
  if (opts.townId) params.set('townId', opts.townId);
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function fetchOpsAssurance(
  token: string,
  opts: { townId?: string; from?: string; to?: string },
): Promise<OpsAssuranceReport> {
  return apiRequest<OpsAssuranceReport>(`/api/v1/orders/admin/reports/assurance${q(opts)}`, { token });
}

export function fetchMoneyAssurance(
  token: string,
  opts: { townId?: string; from?: string; to?: string },
): Promise<MoneyAssuranceReport> {
  return apiRequest<MoneyAssuranceReport>(`/api/v1/payments/admin/reports/money${q(opts)}`, { token });
}

export function fetchAdRevenue(
  token: string,
  opts: { townId?: string; from?: string; to?: string },
): Promise<AdRevenueReport> {
  return apiRequest<AdRevenueReport>(`/api/v1/platform/ads/revenue-report${q(opts)}`, { token });
}

export function fetchReferralReport(
  token: string,
  opts: { from?: string; to?: string },
): Promise<ReferralReport> {
  return apiRequest<ReferralReport>(`/api/v1/users/admin/referrals/report${q(opts)}`, { token });
}
