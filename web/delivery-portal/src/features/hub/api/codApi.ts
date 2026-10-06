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
  agentName?: string | null;
  agentPhone?: string | null;
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
  agentName?: string | null;
  agentPhone?: string | null;
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

export type CodCustodianOutstanding = {
  lookbackFrom: string;
  lookbackTo: string;
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
  }>;
};

export async function fetchCodCustodianOutstanding(
  token: string,
  params: { townId: string; hubId?: string; vendorId?: string },
): Promise<CodCustodianOutstanding> {
  const q = new URLSearchParams({ townId: params.townId });
  if (params.hubId) q.set('hubId', params.hubId);
  if (params.vendorId) q.set('vendorId', params.vendorId);
  return apiRequest<CodCustodianOutstanding>(
    `/api/v1/payments/cod/custodian/receivables/outstanding?${q}`,
    { token, timeoutMs: 45_000 },
  );
}

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
      agentPhone?: string | null;
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
        agentPhone?: string | null;
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
    agentPhone?: string | null;
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

/** Default for calendar / day views (matches payment-service DEFAULT_PENDING_LOOKBACK_DAYS). */
export const COD_DEFAULT_LOOKBACK_DAYS = 31;

/** Wider window for hub “By agent” — still by delivery date, not literally every order ever. */
export const COD_AGENT_LOOKBACK_DAYS = 365;

/** Last N IST calendar days ending today (inclusive). */
export function pendingCodRangeIst(days = COD_DEFAULT_LOOKBACK_DAYS): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  const fmt = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return { from: fmt(from), to: fmt(to) };
}

export async function fetchCodCustodianPendingDetail(
  token: string,
  params: { townId: string; hubId?: string; vendorId?: string; from?: string; to?: string },
): Promise<CodCustodianPendingDetail> {
  const range = params.from && params.to ? { from: params.from, to: params.to } : pendingCodRangeIst();
  const q = new URLSearchParams({ townId: params.townId, from: range.from, to: range.to });
  if (params.hubId) q.set('hubId', params.hubId);
  if (params.vendorId) q.set('vendorId', params.vendorId);
  return apiRequest<CodCustodianPendingDetail>(
    `/api/v1/payments/cod/custodian/receivables/pending-detail?${q}`,
    { token, timeoutMs: 45_000 },
  );
}

/** Unsettled hub COD for one agent view — wider delivery-date window than day/calendar. */
export async function fetchCodCustodianPendingDetailByAgent(
  token: string,
  params: { townId: string; hubId: string },
): Promise<CodCustodianPendingDetail> {
  const range = pendingCodRangeIst(COD_AGENT_LOOKBACK_DAYS);
  return fetchCodCustodianPendingDetail(token, { ...params, ...range });
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

export type CodHubLedger = {
  townId: string;
  hubId: string;
  from: string;
  to: string;
  totalReceivedAllTime: number;
  totalRemittedAllTime: number;
  balanceOwedToCompany: number;
  totalReceivedInRange: number;
  totalRemittedInRange: number;
  receipts: Array<{
    closeDayId: string;
    agentId: string;
    agentName: string;
    closeDate: string;
    receivedAmount: number;
    orderCount: number;
    status: string;
    confirmedAt?: string;
    fromAgentHandover: boolean;
  }>;
  remittances: Array<{
    remittanceId: string;
    remittanceDate: string;
    amount: number;
    reference?: string | null;
    notes?: string | null;
    recordedAt?: string;
  }>;
};

export async function fetchCodHubLedger(
  token: string,
  params: { townId: string; hubId: string; from?: string; to?: string },
): Promise<CodHubLedger> {
  const q = new URLSearchParams({ townId: params.townId, hubId: params.hubId });
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  return apiRequest<CodHubLedger>(`/api/v1/payments/cod/hub/ledger?${q}`, { token });
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
