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
  /** Inclusive end date. Omit or empty for open-ended. */
  effectiveTo?: string | null;
};

export const FEE_MODEL_OPTIONS: Array<{
  id: VendorFeeModel;
  label: string;
  help: string;
  /** Shown in the main picker; others sit under Advanced. */
  primary?: boolean;
}> = [
  { id: 'NONE', label: 'No fee', help: 'Nothing deducted on payout', primary: true },
  { id: 'COMMISSION_PCT', label: 'Simple %', help: 'One % on payout total', primary: true },
  { id: 'PER_ORDER_FLAT', label: '₹ per order', help: 'Fixed ₹ for each settled order', primary: true },
  { id: 'MONTHLY_SUBSCRIPTION', label: 'Monthly fee', help: 'Fixed ₹ once each month', primary: true },
  {
    id: 'HYBRID',
    label: 'Monthly + %',
    help: 'Monthly fee plus a simple %',
    primary: false,
  },
  {
    id: 'SLAB_COMMISSION',
    label: 'Tiered %',
    help: 'Different % for small / medium / large payout totals',
    primary: false,
  },
];

export const PRIMARY_FEE_MODELS = FEE_MODEL_OPTIONS.filter((m) => m.primary);
export const ADVANCED_FEE_MODELS = FEE_MODEL_OPTIONS.filter((m) => !m.primary);

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
