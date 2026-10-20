import { apiRequest } from '@/shared/api/http';

export type TownVm = {
  id: string;
  displayName: string;
  townCode: string;
  stateCode: string;
  status: string;
  acceptingOrders: boolean;
  /** Kilometers from the town center inside which GPS may suggest this town. */
  coverageRadiusKm?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type TownDetailVm = TownVm & {
  pincodes?: string[];
};

type TownListResponse = { items: TownVm[] };

/** Public list of enabled towns (no auth required). */
export async function listEnabledTowns(): Promise<TownVm[]> {
  const data = await apiRequest<TownListResponse>('/api/v1/towns');
  return data.items ?? [];
}

export async function getTown(townId: string, token?: string | null): Promise<TownDetailVm> {
  return apiRequest<TownDetailVm>(`/api/v1/towns/${townId}`, { token });
}
