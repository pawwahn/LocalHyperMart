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

/** Public list of enabled towns (no auth required). */
export async function listEnabledTowns(): Promise<TownVm[]> {
  const data = await apiRequest<TownListResponse>('/api/v1/towns');
  return data.items ?? [];
}
