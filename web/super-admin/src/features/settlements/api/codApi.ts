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
