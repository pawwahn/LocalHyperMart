import { apiRequest, type PageData } from '@/shared/api/http';

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
  orderCount?: number;
  codLines: Array<{
    orderId: string;
    orderNumber?: string | null;
    closeDate?: string | null;
    amount: number;
  }>;
};

export type HubCodPreview = {
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  hubBalanceOwedToCompany: number;
  orderCount: number;
  page?: number;
  size?: number;
  codLines: HubPaymentRequest['codLines'];
  warning?: string | null;
};

export async function fetchAdminHubPaymentRequests(
  token: string,
  townId: string,
  hubId: string,
  type: 'COD' | 'FRANCHISE',
): Promise<HubPaymentRequest[]> {
  const q = new URLSearchParams({ townId, hubId, type });
  return apiRequest<HubPaymentRequest[]>(`/api/v1/payments/hub/payment-requests?${q}`, { token });
}

export async function previewHubCodPaymentRequest(
  token: string,
  body: {
    townId: string;
    hubId: string;
    periodKind: string;
    periodStart: string;
    periodEnd?: string;
  },
  page = 0,
  size = 50,
): Promise<HubCodPreview> {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  return apiRequest<HubCodPreview>(`/api/v1/payments/hub/payment-requests/cod/preview?${q}`, {
    method: 'POST',
    token,
    body,
  });
}

export async function fetchHubPaymentRequestLines(
  token: string,
  requestId: string,
  page = 0,
  size = 50,
): Promise<PageData<HubPaymentRequest['codLines'][number]>> {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  return apiRequest<PageData<HubPaymentRequest['codLines'][number]>>(
    `/api/v1/payments/hub/payment-requests/${requestId}/lines?${q}`,
    { token },
  );
}

export async function createHubCodPaymentRequest(
  token: string,
  body: {
    townId: string;
    hubId: string;
    periodKind: string;
    periodStart: string;
    periodEnd?: string;
  },
): Promise<HubPaymentRequest> {
  return apiRequest<HubPaymentRequest>('/api/v1/payments/hub/payment-requests/cod', {
    method: 'POST',
    token,
    body,
  });
}

export async function createHubFranchisePaymentRequest(
  token: string,
  body: { townId: string; hubId: string; billingYear: number; billingMonth: number },
): Promise<HubPaymentRequest> {
  return apiRequest<HubPaymentRequest>('/api/v1/payments/hub/payment-requests/franchise', {
    method: 'POST',
    token,
    body,
  });
}

export async function cancelHubPaymentRequest(token: string, requestId: string): Promise<HubPaymentRequest> {
  return apiRequest<HubPaymentRequest>(`/api/v1/payments/hub/payment-requests/${requestId}/cancel`, {
    method: 'POST',
    token,
    body: {},
  });
}
