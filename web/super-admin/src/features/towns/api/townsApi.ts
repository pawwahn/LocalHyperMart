import { apiRequest } from '@/shared/api/http';

export type TownVm = {
  id: string;
  displayName: string;
  townCode: string;
  state?: string;
  stateCode: string;
  country?: string;
  countryCode?: string;
  status: string;
  acceptingOrders: boolean;
};

type TownListResponse = { items: TownVm[] };

type TownDetailDto = {
  id: string;
  name: string;
  country: string;
  countryCode: string;
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
  countryCode: string;
  stateCode: string;
  townCode: string;
  pincodes: string[];
  coverageRadiusKm: number;
};

export type GeoStateVm = {
  code: string;
  name: string;
};

export type GeoCountryVm = {
  code: string;
  name: string;
  states: GeoStateVm[];
};

export async function listTowns(token: string): Promise<TownVm[]> {
  const data = await apiRequest<TownListResponse>('/api/v1/towns?includeDisabled=true', { token });
  return data.items ?? [];
}

export async function listCountries(token?: string | null): Promise<GeoCountryVm[]> {
  const data = await apiRequest<{ items: GeoCountryVm[] }>('/api/v1/geo/countries', {
    token: token ?? undefined,
  });
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

export type DeliverySlabVm = {
  minOrderValue: number;
  maxOrderValue: number | null;
  deliveryFee: number;
};

export type TownConfigVm = {
  minOrderValue: number;
  deliveryMode: 'DEFAULT' | 'SLAB';
  deliverySlabs: DeliverySlabVm[];
};

export type UpdateTownConfigInput = {
  minOrderValue?: number;
  deliveryMode: 'DEFAULT' | 'SLAB';
  deliverySlabs: DeliverySlabVm[];
};

function asNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export async function getTownConfig(token: string, townId: string): Promise<TownConfigVm> {
  const data = await apiRequest<Record<string, unknown>>(`/api/v1/towns/${townId}/config`, { token });
  const mode = String(data?.deliveryMode ?? 'DEFAULT').toUpperCase() === 'SLAB' ? 'SLAB' : 'DEFAULT';
  const rawSlabs = Array.isArray(data?.deliverySlabs) ? data.deliverySlabs : [];
  return {
    minOrderValue: asNum(data?.minOrderValue, 199),
    deliveryMode: mode,
    deliverySlabs: rawSlabs.map((s) => {
      const row = (s ?? {}) as Record<string, unknown>;
      return {
        minOrderValue: asNum(row.minOrderValue, 0),
        maxOrderValue: row.maxOrderValue == null || row.maxOrderValue === '' ? null : asNum(row.maxOrderValue),
        deliveryFee: asNum(row.deliveryFee, 0),
      };
    }),
  };
}

export async function updateTownConfig(
  token: string,
  townId: string,
  input: UpdateTownConfigInput,
): Promise<TownConfigVm> {
  await apiRequest(`/api/v1/towns/${townId}/config`, {
    method: 'PUT',
    token,
    body: input,
  });
  return getTownConfig(token, townId);
}
