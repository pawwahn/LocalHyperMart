import { apiRequest } from '@/shared/api/http';

export type CodCustodianReceivables = {
  date: string;
  townId: string;
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
      lines: Array<{ orderId: string; orderNumber: string; collectAmount: number }>;
    }>;
  }>;
};

export async function fetchCodCustodianReceivables(
  token: string,
  params: { townId: string; vendorId: string; date: string },
): Promise<CodCustodianReceivables> {
  const q = new URLSearchParams({
    townId: params.townId,
    vendorId: params.vendorId,
    date: params.date,
  });
  return apiRequest<CodCustodianReceivables>(`/api/v1/payments/cod/custodian/receivables?${q}`, {
    token,
    timeoutMs: 45_000,
  });
}

export type CodCustodianOutstanding = {
  lookbackFrom: string;
  lookbackTo: string;
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
  }>;
};

export type CodCustodianPendingDetail = {
  lookbackFrom: string;
  lookbackTo: string;
  townId: string;
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
  }>;
};

export async function fetchCodCustodianPendingDetail(
  token: string,
  params: { townId: string; vendorId: string; from: string; to: string },
): Promise<CodCustodianPendingDetail> {
  const q = new URLSearchParams({
    townId: params.townId,
    vendorId: params.vendorId,
    from: params.from,
    to: params.to,
  });
  return apiRequest<CodCustodianPendingDetail>(
    `/api/v1/payments/cod/custodian/receivables/pending-detail?${q}`,
    { token, timeoutMs: 45_000 },
  );
}

export async function fetchCodCustodianOutstanding(
  token: string,
  params: { townId: string; vendorId: string },
): Promise<CodCustodianOutstanding> {
  const q = new URLSearchParams({
    townId: params.townId,
    vendorId: params.vendorId,
  });
  return apiRequest<CodCustodianOutstanding>(
    `/api/v1/payments/cod/custodian/receivables/outstanding?${q}`,
    { token, timeoutMs: 45_000 },
  );
}

export type CodHandoverPending = {
  handoverId: string;
  agentId: string;
  agentName?: string | null;
  agentPhone?: string | null;
  handoverDate: string;
  custodianType: string;
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

export async function fetchPendingCodHandovers(
  token: string,
  params: { townId: string; vendorId: string; date: string },
): Promise<CodHandoverPending[]> {
  const q = new URLSearchParams({
    townId: params.townId,
    vendorId: params.vendorId,
    date: params.date,
  });
  return apiRequest<CodHandoverPending[]>(`/api/v1/payments/cod/handovers/pending?${q}`, { token });
}

export async function confirmCodHandover(
  token: string,
  body: {
    handoverId: string;
    receivedAmount: number;
    vendorId: string;
    pin?: string;
    notes?: string;
  },
): Promise<unknown> {
  return apiRequest('/api/v1/payments/cod/handovers/confirm', {
    method: 'POST',
    token,
    body,
  });
}
