import { apiRequest } from '@/shared/api/http';

export type HubPaymentPayable = {
  hubId: string;
  townId: string;
  codOwedToCompany: number;
  codPayable: boolean;
  codPendingVerification: boolean;
  franchiseEnabled: boolean;
  franchiseAmount: number;
  franchisePeriodStart?: string | null;
  franchisePeriodEnd?: string | null;
  franchiseLabel?: string | null;
  franchisePayable: boolean;
  franchisePendingVerification: boolean;
  suggestedTotal: number;
  hasPendingSubmission: boolean;
  pendingStatusLabel?: string | null;
};

export type HubPaymentSubmission = {
  submissionId: string;
  townId: string;
  hubId: string;
  status: string;
  statusLabel: string;
  paymentDate: string;
  totalAmount: number;
  paymentReference: string;
  hubNotes?: string | null;
  adminNotes?: string | null;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  rejectedAt?: string | null;
  editable?: boolean;
  lines: Array<{
    lineId: string;
    lineType: string;
    amount: number;
    franchisePeriodStart?: string | null;
    franchisePeriodEnd?: string | null;
    franchiseLabel?: string | null;
  }>;
};

export async function fetchHubPaymentPayable(token: string): Promise<HubPaymentPayable> {
  return apiRequest<HubPaymentPayable>('/api/v1/payments/hub/me/payment-payable', { token });
}

export async function fetchHubPaymentSubmissions(token: string): Promise<HubPaymentSubmission[]> {
  return apiRequest<HubPaymentSubmission[]>('/api/v1/payments/hub/me/payment-submissions', { token });
}

export async function submitHubPlatformPayment(
  token: string,
  body: {
    paymentDate: string;
    paymentReference: string;
    hubNotes?: string;
    totalAmount: number;
    includeCod: boolean;
    includeFranchise: boolean;
  },
): Promise<HubPaymentSubmission> {
  return apiRequest<HubPaymentSubmission>('/api/v1/payments/hub/me/payment-submissions', {
    method: 'POST',
    token,
    body,
  });
}

export async function updateHubPaymentSubmission(
  token: string,
  submissionId: string,
  body: {
    paymentDate: string;
    paymentReference: string;
    hubNotes?: string;
  },
): Promise<HubPaymentSubmission> {
  return apiRequest<HubPaymentSubmission>(`/api/v1/payments/hub/me/payment-submissions/${submissionId}`, {
    method: 'PATCH',
    token,
    body,
  });
}
