import { apiRequest } from '@/shared/api/http';

export type CodCandidateItem = {
  orderId: string;
  orderNumber: string;
  amount: number;
  deliveredAt?: string | null;
  alreadyClosed: boolean;
};

export type CodCandidateResponse = {
  townId: string;
  hubId: string;
  agentId: string;
  date: string;
  agentFilterApplied: boolean;
  items: CodCandidateItem[];
};

export type CodCloseDayLine = {
  id: string;
  orderId: string;
  orderNumber: string;
  amount: number;
};

export type CodCloseDayResponse = {
  id: string;
  townId: string;
  hubId: string;
  agentId: string;
  closeDate: string;
  expectedAmount: number;
  receivedAmount: number;
  orderCount: number;
  status: 'MATCHED' | 'DISCREPANCY';
  notes?: string | null;
  createdAt?: string;
  lines: CodCloseDayLine[];
};

export type CodSummaryResponse = {
  townId: string;
  hubId: string;
  date: string;
  closeCount: number;
  orderCount: number;
  expectedAmount: number;
  receivedAmount: number;
  matchedCount: number;
  discrepancyCount: number;
};

export async function fetchCodCandidates(
  token: string,
  params: { townId: string; hubId: string; agentId: string; date: string },
): Promise<CodCandidateResponse> {
  const q = new URLSearchParams({
    townId: params.townId,
    hubId: params.hubId,
    agentId: params.agentId,
    date: params.date,
  });
  return apiRequest<CodCandidateResponse>(`/api/v1/payments/cod/candidates?${q}`, { token });
}

export async function closeCodDay(
  token: string,
  body: {
    agentId: string;
    hubId: string;
    townId: string;
    receivedAmount: number;
    orderIds: string[];
    notes?: string;
    pin: string;
    closeDate?: string;
  },
): Promise<CodCloseDayResponse> {
  return apiRequest<CodCloseDayResponse>('/api/v1/payments/cod/close-day', {
    method: 'POST',
    token,
    body,
  });
}

export async function fetchCodSummary(
  token: string,
  params: { townId: string; hubId: string; date: string },
): Promise<CodSummaryResponse> {
  const q = new URLSearchParams({
    townId: params.townId,
    hubId: params.hubId,
    date: params.date,
  });
  return apiRequest<CodSummaryResponse>(`/api/v1/payments/cod/summary?${q}`, { token });
}

export async function fetchCodCloses(
  token: string,
  params: { townId: string; hubId: string; from: string; to: string },
): Promise<CodCloseDayResponse[]> {
  const q = new URLSearchParams({
    townId: params.townId,
    hubId: params.hubId,
    from: params.from,
    to: params.to,
  });
  const data = await apiRequest<{ items: CodCloseDayResponse[] }>(
    `/api/v1/payments/cod/closes?${q}`,
    { token },
  );
  return data?.items ?? [];
}
