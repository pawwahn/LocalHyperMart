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

type TownListResponse = { items: TownVm[]; total?: number; hasMore?: boolean };

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

export async function searchTowns(
  token: string,
  opts: { q?: string; page?: number; size?: number } = {},
): Promise<{ items: TownVm[]; total: number; hasMore: boolean }> {
  const params = new URLSearchParams({ includeDisabled: 'true', size: String(opts.size ?? 80) });
  if (opts.q?.trim()) params.set('q', opts.q.trim());
  if (opts.page != null) params.set('page', String(opts.page));
  const data = await apiRequest<TownListResponse>(`/api/v1/towns?${params}`, { token });
  return {
    items: data.items ?? [],
    total: data.total ?? data.items?.length ?? 0,
    hasMore: Boolean(data.hasMore),
  };
}

export async function listTownsByIds(token: string, ids: string[]): Promise<TownVm[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const out: TownVm[] = [];
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const params = new URLSearchParams({ includeDisabled: 'true' });
    chunk.forEach((id) => params.append('ids', id));
    const data = await apiRequest<TownListResponse>(`/api/v1/towns?${params}`, { token });
    out.push(...(data.items ?? []));
  }
  return out;
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
  themeColor: string;
  bestDealsEnabled: boolean;
  dealPrices: number[];
  platformFee: number;
  scratchCardEnabled: boolean;
  scratchRewardMin: number;
  scratchRewardMax: number;
  scratchMinGoodsAmount: number;
  buyerMembershipEnabled: boolean;
};

export type UpdateTownConfigInput = {
  minOrderValue?: number;
  deliveryMode: 'DEFAULT' | 'SLAB';
  deliverySlabs: DeliverySlabVm[];
  themeColor: string;
  bestDealsEnabled: boolean;
  dealPrices: number[];
  platformFee: number;
  scratchCardEnabled: boolean;
  scratchRewardMin: number;
  scratchRewardMax: number;
  scratchMinGoodsAmount: number;
  buyerMembershipEnabled: boolean;
};

function asDealPrices(v: unknown): number[] {
  const fallback = [19, 29, 49, 99];
  if (!Array.isArray(v) || v.length !== 4) return fallback;
  const nums = v.map((item) => {
    const n = typeof item === 'number' ? item : Number(item);
    return Number.isFinite(n) ? Math.max(1, Math.round(n)) : 0;
  });
  return nums.every((n) => n >= 1) ? nums : fallback;
}

function asHex(v: unknown, fallback: string): string {
  const raw = String(v ?? '').trim();
  const hex = raw.startsWith('#') ? raw : raw ? `#${raw}` : '';
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.toUpperCase() : fallback;
}

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
    themeColor: asHex(data?.themeColor, '#0C831F'),
    bestDealsEnabled: data?.bestDealsEnabled !== false,
    dealPrices: asDealPrices(data?.dealPrices),
    platformFee: Math.max(0, asNum(data?.platformFee, 0)),
    scratchCardEnabled: data?.scratchCardEnabled === true,
    scratchRewardMin: Math.max(0, asNum(data?.scratchRewardMin, 10)),
    scratchRewardMax: Math.max(0, asNum(data?.scratchRewardMax, 50)),
    scratchMinGoodsAmount: Math.max(0, asNum(data?.scratchMinGoodsAmount, 499)),
    buyerMembershipEnabled: data?.buyerMembershipEnabled !== false,
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
