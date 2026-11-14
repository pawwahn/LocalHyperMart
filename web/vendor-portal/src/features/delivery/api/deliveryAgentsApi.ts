import { apiRequest } from '@/shared/api/http';

export type VendorAgentDto = {
  agentId: string;
  userId?: string;
  name: string;
  phone: string;
  status: string;
  agentType?: string;
  govtIdType?: string | null;
  govtIdNumber?: string | null;
  reference1Name?: string | null;
  reference1Phone?: string | null;
  reference2Name?: string | null;
  reference2Phone?: string | null;
  labTitle?: string | null;
  collectionCapable?: boolean | null;
};

export type UpdateVendorAgentInput = {
  name: string;
  govtIdType?: string;
  govtIdNumber?: string;
  reference1Name?: string;
  reference1Phone?: string;
  reference2Name?: string;
  reference2Phone?: string;
  labTitle?: string;
  collectionCapable?: boolean;
};

export type AgentAvailabilityStatus = 'ACTIVE' | 'INACTIVE';

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
  labTitle?: string;
  collectionCapable?: boolean;
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

export async function updateVendorDeliveryAgent(
  scope: ShopScope,
  agentId: string,
  input: UpdateVendorAgentInput,
): Promise<VendorAgentDto> {
  return apiRequest<VendorAgentDto>(`/api/v1/delivery/vendor/agents/${agentId}`, {
    method: 'PUT',
    token: scope.token,
    vendorId: scope.vendorId,
    shopId: scope.shopId,
    townId: scope.townId,
    body: input,
  });
}

export async function updateVendorDeliveryAgentStatus(
  scope: ShopScope,
  agentId: string,
  status: AgentAvailabilityStatus,
): Promise<VendorAgentDto> {
  return apiRequest<VendorAgentDto>(`/api/v1/delivery/vendor/agents/${agentId}/status`, {
    method: 'PATCH',
    token: scope.token,
    vendorId: scope.vendorId,
    shopId: scope.shopId,
    townId: scope.townId,
    body: { status },
  });
}
