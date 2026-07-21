import { apiRequest } from '@/shared/api/http';

export type TownVm = {
  id: string;
  displayName: string;
  townCode: string;
  stateCode: string;
  status: string;
  acceptingOrders: boolean;
};

type TownListResponse = { items: TownVm[] };

type TownDetailDto = {
  id: string;
  name: string;
  state: string;
  displayName: string;
  townCode: string;
  stateCode: string;
  coverageRadiusKm: number;
  status: string;
  acceptingOrders: boolean;
  pincodes: string[];
};

export type CreateTownInput = {
  name: string;
  state: string;
  townCode: string;
  stateCode: string;
  pincodes: string[];
  coverageRadiusKm: number;
};

export async function listTowns(token: string): Promise<TownVm[]> {
  const data = await apiRequest<TownListResponse>('/api/v1/towns?includeDisabled=true', { token });
  return data.items ?? [];
}

export async function createTown(token: string, input: CreateTownInput): Promise<TownDetailDto> {
  return apiRequest<TownDetailDto>('/api/v1/towns', {
    method: 'POST',
    token,
    body: input,
  });
}

export async function updateTownStatus(
  token: string,
  townId: string,
  status: 'ENABLED' | 'DISABLED',
  reason?: string,
): Promise<TownDetailDto> {
  return apiRequest<TownDetailDto>(`/api/v1/towns/${townId}/status`, {
    method: 'PATCH',
    token,
    body: { status, reason },
  });
}
