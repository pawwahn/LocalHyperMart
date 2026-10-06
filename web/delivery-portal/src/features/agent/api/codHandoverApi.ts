import { apiRequest } from '@/shared/api/http';

export type CodHandoverSummary = {
  handoverDate: string;
  agentId: string;
  pendingCollectTotal: number;
  pendingHubTotal?: number;
  pendingVendorTotal?: number;
  pendingOrderCount: number;
  orders: Array<{
    orderId: string;
    orderNumber: string;
    collectAmount: number;
    deliveredAt?: string | null;
    remittanceStatus: 'PENDING' | 'SUBMITTED' | string;
    custodianType?: 'HUB' | 'VENDOR' | string;
  }>;
  handovers: CodHandover[];
};

export type CodHandover = {
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

const SUMMARY_CACHE_PREFIX = 'hlm.agent.cod-handover.summary.v1';

export function readCachedAgentCodHandoverSummary(agentId: string): CodHandoverSummary | null {
  try {
    const raw = sessionStorage.getItem(`${SUMMARY_CACHE_PREFIX}:${agentId}`);
    if (!raw) return null;
    return JSON.parse(raw) as CodHandoverSummary;
  } catch {
    return null;
  }
}

export function writeCachedAgentCodHandoverSummary(agentId: string, summary: CodHandoverSummary): void {
  try {
    sessionStorage.setItem(`${SUMMARY_CACHE_PREFIX}:${agentId}`, JSON.stringify(summary));
  } catch {
    /* quota / private mode */
  }
}

export async function fetchAgentCodHandoverSummary(token: string): Promise<CodHandoverSummary> {
  return apiRequest<CodHandoverSummary>('/api/v1/payments/agents/me/cod-handover/summary', { token });
}

export async function declareCodHandover(
  token: string,
  body: { handoverDate?: string; orderIds: string[] },
): Promise<CodHandover> {
  return apiRequest<CodHandover>('/api/v1/payments/agents/me/cod-handover/declare', {
    method: 'POST',
    token,
    body,
  });
}
