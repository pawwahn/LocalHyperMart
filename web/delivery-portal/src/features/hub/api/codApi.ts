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

export type CodHandoverPending = {
  handoverId: string;
  agentId: string;
  handoverDate: string;
  custodianType: string;
  hubId?: string | null;
  vendorId?: string | null;
  declaredAmount: number;
  status: string;
  lines: Array<{
    orderId: string;
    orderNumber: string;
    collectAmount: number;
    vendorAllocations?: Array<{
      subOrderId: string;
      vendorId: string;
      subOrderNumber?: string | null;
      goodsSubtotal: number;
      allocatedCash: number;
    }>;
  }>;
};

export type CodCustodianReceivables = {
  date: string;
  townId: string;
  hubId?: string | null;
  vendorId?: string | null;
  totalStillWithAgents: number;
  ordersStillWithAgents: number;
  totalDeclaredAwaitingConfirm: number;
  handoversAwaitingConfirm: number;
  agents: Array<{
    agentId: string;
    agentName: string;
    stillWithAgentAmount: number;
    stillWithAgentOrderCount: number;
    declaredAwaitingAmount: number;
    declaredAwaitingOrderCount: number;
    stillWithAgentOrders: Array<{
      orderId: string;
      orderNumber: string;
      collectAmount: number;
      deliveredAt?: string | null;
    }>;
    declaredAwaitingConfirm: Array<{
      handoverId: string;
      declaredAmount: number;
      lines: Array<{
        orderId: string;
        orderNumber: string;
        collectAmount: number;
      }>;
    }>;
  }>;
};

export async function fetchCodCustodianReceivables(
  token: string,
  params: { townId: string; date: string; hubId?: string; vendorId?: string },
): Promise<CodCustodianReceivables> {
  const q = new URLSearchParams({ townId: params.townId, date: params.date });
  if (params.hubId) q.set('hubId', params.hubId);
  if (params.vendorId) q.set('vendorId', params.vendorId);
  return apiRequest<CodCustodianReceivables>(`/api/v1/payments/cod/custodian/receivables?${q}`, { token });
}

export type CodCustodianPendingDetail = {
  lookbackFrom: string;
  lookbackTo: string;
  townId: string;
  hubId?: string | null;
  vendorId?: string | null;
  totalStillWithAgents: number;
  ordersStillWithAgents: number;
  totalDeclaredAwaitingConfirm: number;
  handoversAwaitingConfirm: number;
  days: Array<{
    date: string;
    stillWithAgentsAmount: number;
    stillWithAgentsOrderCount: number;
    declaredAwaitingAmount: number;
    declaredAwaitingOrderCount: number;
    agents: Array<{
      agentId: string;
      agentName: string;
      stillWithAgentAmount: number;
      stillWithAgentOrderCount: number;
      declaredAwaitingAmount: number;
      declaredAwaitingOrderCount: number;
      stillWithAgentOrders: Array<{
        orderId: string;
        orderNumber: string;
        collectAmount: number;
        deliveredAt?: string | null;
      }>;
      declaredAwaiting: Array<{
        handoverId: string;
        agentId: string;
        agentName: string;
        handoverDate: string;
        declaredAmount: number;
        lines: Array<{
          orderId: string;
          orderNumber: string;
          collectAmount: number;
          deliveredAt?: string | null;
        }>;
      }>;
    }>;
  }>;
  declaredAwaitingHandovers: Array<{
    handoverId: string;
    agentId: string;
    agentName: string;
    handoverDate: string;
    declaredAmount: number;
    lines: Array<{
      orderId: string;
      orderNumber: string;
      collectAmount: number;
      deliveredAt?: string | null;
    }>;
  }>;
};

export async function fetchCodCustodianPendingDetail(
  token: string,
  params: { townId: string; hubId?: string; vendorId?: string },
): Promise<CodCustodianPendingDetail> {
  const q = new URLSearchParams({ townId: params.townId });
  if (params.hubId) q.set('hubId', params.hubId);
  if (params.vendorId) q.set('vendorId', params.vendorId);
  return apiRequest<CodCustodianPendingDetail>(
    `/api/v1/payments/cod/custodian/receivables/pending-detail?${q}`,
    { token },
  );
}

export async function fetchPendingCodHandovers(
  token: string,
  params: { townId: string; hubId?: string; vendorId?: string; date: string },
): Promise<CodHandoverPending[]> {
  const q = new URLSearchParams({
    townId: params.townId,
    date: params.date,
  });
  if (params.hubId) q.set('hubId', params.hubId);
  if (params.vendorId) q.set('vendorId', params.vendorId);
  return apiRequest<CodHandoverPending[]>(`/api/v1/payments/cod/handovers/pending?${q}`, { token });
}

export async function confirmCodHandover(
  token: string,
  body: {
    handoverId: string;
    receivedAmount: number;
    pin?: string;
    notes?: string;
    vendorId?: string;
  },
): Promise<CodCloseDayResponse> {
  return apiRequest<CodCloseDayResponse>('/api/v1/payments/cod/handovers/confirm', {
    method: 'POST',
    token,
    body,
  });
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
