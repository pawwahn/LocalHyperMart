import { apiRequest } from '@/shared/api/http';

export type VendorAgentDto = {
  agentId: string;
  userId?: string;
  name: string;
  phone: string;
  status: string;
  agentType?: string;
};

export type CreateVendorAgentInput = {
  name: string;
  phone: string;
  password: string;
  govtIdType?: string;
  govtIdNumber?: string;
  reference1Name?: string;
  reference1Phone?: string;
  reference2Name?: string;
  reference2Phone?: string;
};

type ShopScope = {
  token: string;
  vendorId: string;
  shopId: string;
  townId: string;
};

export async function fetchVendorDeliveryAgents(scope: ShopScope): Promise<VendorAgentDto[]> {
  const list = await apiRequest<VendorAgentDto[]>('/api/v1/delivery/vendor/agents', {
    token: scope.token,
    vendorId: scope.vendorId,
    shopId: scope.shopId,
    townId: scope.townId,
  });
  return list ?? [];
}

export async function createVendorDeliveryAgent(
  scope: ShopScope,
  input: CreateVendorAgentInput,
): Promise<VendorAgentDto> {
  return apiRequest<VendorAgentDto>('/api/v1/delivery/vendor/agents', {
    method: 'POST',
    token: scope.token,
    vendorId: scope.vendorId,
    shopId: scope.shopId,
    townId: scope.townId,
    body: input,
  });
}
