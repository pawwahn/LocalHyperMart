import { apiRequest } from '@/shared/api/http';

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
    fromAgentHandover: boolean;
  }>;
  remittances: Array<{
    remittanceId: string;
    remittanceDate: string;
    amount: number;
    reference?: string | null;
    notes?: string | null;
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

export async function recordCodHubRemittance(
  token: string,
  body: {
    townId: string;
    hubId: string;
    remittanceDate?: string;
    amount: number;
    reference?: string;
    notes?: string;
  },
): Promise<CodHubLedger['remittances'][number]> {
  return apiRequest(`/api/v1/payments/cod/hub/remittances`, { method: 'POST', token, body });
}
