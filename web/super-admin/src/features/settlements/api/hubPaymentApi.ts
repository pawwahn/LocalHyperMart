import { apiRequest } from '@/shared/api/http';

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
  /** Issued bill number, for example CLX/COD/26-27/0006. */
  documentRef?: string | null;
  lines: Array<{
    lineId: string;
    lineType: string;
    amount: number;
    franchisePeriodStart?: string | null;
    franchisePeriodEnd?: string | null;
    franchiseLabel?: string | null;
  }>;
};

export function isFranchiseOnlySubmission(row: HubPaymentSubmission): boolean {
  return row.lines.length > 0 && row.lines.every((l) => l.lineType === 'FRANCHISE_FEE');
}

export async function fetchHubPaymentSubmissions(
  token: string,
  townId: string,
  hubId?: string,
): Promise<HubPaymentSubmission[]> {
  const q = new URLSearchParams({ townId });
  if (hubId) q.set('hubId', hubId);
  return apiRequest<HubPaymentSubmission[]>(`/api/v1/payments/hub/payment-submissions?${q}`, { token });
}

export async function verifyHubPaymentSubmission(
  token: string,
  submissionId: string,
  adminNotes?: string,
): Promise<HubPaymentSubmission> {
  return apiRequest<HubPaymentSubmission>(`/api/v1/payments/hub/payment-submissions/${submissionId}/verify`, {
    method: 'POST',
    token,
    body: adminNotes ? { adminNotes } : {},
  });
}

export async function rejectHubPaymentSubmission(
  token: string,
  submissionId: string,
  adminNotes: string,
): Promise<HubPaymentSubmission> {
  return apiRequest<HubPaymentSubmission>(`/api/v1/payments/hub/payment-submissions/${submissionId}/reject`, {
    method: 'POST',
    token,
    body: { adminNotes },
  });
}
