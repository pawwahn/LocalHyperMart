import { apiRequest } from '@/shared/api/http';

export type VendorAgentDeliveryConfig = {
  enabled: boolean;
  vendorAgentPayoutAmount: number;
  hubPayoutAmount: number;
};

function asNum(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function getVendorAgentDeliveryConfig(
  token: string,
  townId: string,
): Promise<VendorAgentDeliveryConfig> {
  const data = await apiRequest<Record<string, unknown>>(
    `/api/v1/platform/towns/${townId}/vendor-agent-delivery-config`,
    { token },
  );
  return {
    enabled: Boolean(data.enabled),
    vendorAgentPayoutAmount: asNum(data.vendorAgentPayoutAmount),
    hubPayoutAmount: asNum(data.hubPayoutAmount),
  };
}

export async function saveVendorAgentDeliveryConfig(
  token: string,
  townId: string,
  config: VendorAgentDeliveryConfig,
): Promise<VendorAgentDeliveryConfig> {
  const data = await apiRequest<Record<string, unknown>>(
    `/api/v1/platform/towns/${townId}/vendor-agent-delivery-config`,
    { method: 'PUT', token, body: config },
  );
  return {
    enabled: Boolean(data.enabled),
    vendorAgentPayoutAmount: asNum(data.vendorAgentPayoutAmount),
    hubPayoutAmount: asNum(data.hubPayoutAmount),
  };
}
