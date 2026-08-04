import { apiRequest } from '@/shared/api/http';

export type VendorFeeModel =
  | 'NONE'
  | 'PER_ORDER_FLAT'
  | 'COMMISSION_PCT'
  | 'SLAB_COMMISSION'
  | 'MONTHLY_SUBSCRIPTION'
  | 'HYBRID';

export type CommissionSlab = {
  uptoAmount?: number | null;
  percent: number;
};

export type VendorCommercialTerms = {
  id?: string | null;
  vendorId: string;
  feeModel: VendorFeeModel;
  commissionPercent?: number | null;
  perOrderFlatAmount?: number | null;
  monthlySubscriptionAmount?: number | null;
  subscriptionBillingDay?: number | null;
  commissionSlabs?: CommissionSlab[] | null;
  notes?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  current?: boolean;
  lastSubscriptionChargedYm?: string | null;
  updatedAt?: string | null;
};

export type VendorCommercialTermsHistory = {
  current: VendorCommercialTerms;
  history: VendorCommercialTerms[];
};

export type CommercialTermsQuote = {
  vendorId: string;
  feeModel: VendorFeeModel;
  grossAmount: number;
  orderCount: number;
  commissionAmount: number;
  subscriptionAmount: number;
  totalFeeAmount: number;
  suggestedNet: number;
  subscriptionIncluded: boolean;
  appliedSlabLabel?: string | null;
  breakdownLines: string[];
};

export type UpsertCommercialTermsInput = {
  feeModel: VendorFeeModel;
  commissionPercent?: number;
  perOrderFlatAmount?: number;
  monthlySubscriptionAmount?: number;
  subscriptionBillingDay?: number;
  commissionSlabs?: CommissionSlab[];
  notes?: string;
  effectiveFrom?: string;
};

export const FEE_MODEL_OPTIONS: Array<{ id: VendorFeeModel; label: string; help: string }> = [
  { id: 'NONE', label: 'None', help: 'No platform fee on payouts' },
  { id: 'PER_ORDER_FLAT', label: 'Per order (flat ₹)', help: 'Fixed amount × settled orders' },
  { id: 'COMMISSION_PCT', label: '% commission', help: 'Percent of settlement gross' },
  { id: 'SLAB_COMMISSION', label: 'Slab % commission', help: 'Percent by GMV slab on this payout' },
  { id: 'MONTHLY_SUBSCRIPTION', label: 'Monthly subscription', help: 'Fixed monthly fee, once per month' },
  { id: 'HYBRID', label: 'Hybrid', help: 'Monthly subscription + % commission' },
];

export async function getVendorCommercialTerms(
  token: string,
  vendorId: string,
): Promise<VendorCommercialTerms> {
  return apiRequest<VendorCommercialTerms>(`/api/v1/vendors/${vendorId}/commercial-terms`, { token });
}

export async function listVendorCommercialTermsHistory(
  token: string,
  vendorId: string,
): Promise<VendorCommercialTermsHistory> {
  return apiRequest<VendorCommercialTermsHistory>(
    `/api/v1/vendors/${vendorId}/commercial-terms/history`,
    { token },
  );
}

export async function upsertVendorCommercialTerms(
  token: string,
  vendorId: string,
  input: UpsertCommercialTermsInput,
): Promise<VendorCommercialTerms> {
  return apiRequest<VendorCommercialTerms>(`/api/v1/vendors/${vendorId}/commercial-terms`, {
    method: 'PUT',
    token,
    body: input,
  });
}

export async function quoteVendorCommercialTerms(
  token: string,
  vendorId: string,
  input: {
    grossAmount?: number;
    orderCount?: number;
    periodStart?: string;
    periodEnd?: string;
    markSubscriptionCharged?: boolean;
    orderLines?: Array<{ amount: number; placedAt?: string | null; orderDate?: string }>;
  },
): Promise<CommercialTermsQuote> {
  return apiRequest<CommercialTermsQuote>(`/api/v1/vendors/${vendorId}/commercial-terms/quote`, {
    method: 'POST',
    token,
    body: input,
  });
}
