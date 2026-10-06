import { apiRequest } from '@/shared/api/http';

export type HubPaymentRequest = {
  requestId: string;
  townId: string;
  hubId: string;
  requestType: 'COD' | 'FRANCHISE';
  periodKind: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  franchiseLabel?: string | null;
  status: string;
  statusLabel: string;
  documentRef: string;
  submissionId?: string | null;
  issuedAt?: string | null;
  codLines: Array<{
    lineId?: string;
    orderId: string;
    orderNumber?: string | null;
    closeDate?: string | null;
    amount: number;
  }>;
};

export async function fetchHubPaymentRequests(
  token: string,
  type?: 'COD' | 'FRANCHISE',
): Promise<HubPaymentRequest[]> {
  const q = type ? `?type=${type}` : '';
  return apiRequest<HubPaymentRequest[]>(`/api/v1/payments/hub/me/payment-requests${q}`, { token });
}

export type HubCodPreview = {
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  hubBalanceOwedToCompany: number;
  orderCount: number;
  codLines: HubPaymentRequest['codLines'];
  warning?: string | null;
};

export type HubFranchiseDuePreview = {
  billingYear: number;
  billingMonth: number;
  periodStart: string;
  periodEnd: string;
  enabled: boolean;
  alreadyCollected: boolean;
  amount: number;
  label?: string | null;
};

export async function previewHubCodDue(
  token: string,
  body: { periodKind: string; periodStart: string; periodEnd?: string },
): Promise<HubCodPreview> {
  return apiRequest<HubCodPreview>('/api/v1/payments/hub/me/payment-requests/cod/preview', {
    method: 'POST',
    token,
    body,
  });
}

export async function previewHubFranchiseDue(
  token: string,
  year: number,
  month: number,
): Promise<HubFranchiseDuePreview> {
  const q = new URLSearchParams({ year: String(year), month: String(month) });
  return apiRequest<HubFranchiseDuePreview>(`/api/v1/payments/hub/me/franchise-due?${q}`, { token });
}

export async function submitHubPaymentRequest(
  token: string,
  requestId: string,
  body: {
    paymentDate: string;
    paymentReference: string;
    paymentMethod?: string;
    bankName?: string;
    hubNotes?: string;
    totalAmount: number;
  },
): Promise<unknown> {
  return apiRequest(`/api/v1/payments/hub/me/payment-requests/${requestId}/submit`, {
    method: 'POST',
    token,
    body,
  });
}
