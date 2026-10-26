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

export type TownDetailDto = {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  state: string;
  displayName: string;
  townCode: string;
  stateCode: string;
  coverageRadiusKm: number;
  latitude?: number | null;
  longitude?: number | null;
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
  latitude?: number | null;
  longitude?: number | null;
};

export type TownCoverageInput = {
  coverageRadiusKm: number;
  pincodes: string[];
  latitude?: number | null;
  longitude?: number | null;
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

export async function getTown(token: string, townId: string): Promise<TownDetailDto> {
  return apiRequest<TownDetailDto>(`/api/v1/towns/${townId}`, { token });
}

export async function updateTownCoverage(
  token: string,
  townId: string,
  input: TownCoverageInput,
): Promise<TownDetailDto> {
  return apiRequest<TownDetailDto>(`/api/v1/towns/${townId}/coverage`, {
    method: 'PATCH',
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

export type ScratchServiceKey = 'GROCERY' | 'LAUNDRY' | 'BEAUTY';

export type ScratchPrepayModeFilter = 'BOTH' | 'FULL' | 'PARTIAL';

export type ScratchServiceRuleVm = {
  enabled: boolean;
  rewardMin: number;
  rewardMax: number;
  minOrderAmount: number;
  prepayModeFilter?: ScratchPrepayModeFilter;
  issueAfterRating?: boolean;
  /** Glam: offer scratch when buyer pays full at booking. */
  fullPayScratchEnabled?: boolean;
  partialPrepayEnabled?: boolean;
  partialRewardMin?: number;
  partialRewardMax?: number;
  partialMinPrepayAmount?: number;
  /** Buyer promo only; payout still uses rewardMax. 0 = show rewardMax. */
  rewardDisplayMax?: number;
  partialRewardDisplayMax?: number;
};

export function scratchPromoDisplayMax(display: number | undefined, payoutMax: number): number {
  const d = Math.round(Number(display));
  if (Number.isFinite(d) && d >= 1) return d;
  return Math.round(Number(payoutMax) || 0);
}

export const SCRATCH_SERVICE_KEYS: ScratchServiceKey[] = ['GROCERY', 'LAUNDRY', 'BEAUTY'];

export function defaultScratchByService(): Record<ScratchServiceKey, ScratchServiceRuleVm> {
  return {
    GROCERY: { enabled: false, rewardMin: 10, rewardMax: 50, minOrderAmount: 499 },
    LAUNDRY: { enabled: false, rewardMin: 10, rewardMax: 50, minOrderAmount: 499 },
    BEAUTY: {
      enabled: false,
      rewardMin: 10,
      rewardMax: 50,
      minOrderAmount: 499,
      prepayModeFilter: 'BOTH',
      issueAfterRating: true,
      fullPayScratchEnabled: true,
      partialPrepayEnabled: false,
      partialRewardMin: 10,
      partialRewardMax: 50,
      partialMinPrepayAmount: 499,
      rewardDisplayMax: 0,
      partialRewardDisplayMax: 0,
    },
  };
}

export function deriveBeautyPrepayFilter(
  fullPayScratchEnabled: boolean,
  partialPrepayEnabled: boolean,
): ScratchPrepayModeFilter {
  if (fullPayScratchEnabled && partialPrepayEnabled) return 'BOTH';
  if (fullPayScratchEnabled) return 'FULL';
  if (partialPrepayEnabled) return 'PARTIAL';
  return 'FULL';
}

function asBoolFlag(v: unknown, fallback = false): boolean {
  if (v === true || v === 1 || v === '1') return true;
  if (v === false || v === 0 || v === '0') return false;
  if (typeof v === 'string' && v.trim().toLowerCase() === 'true') return true;
  if (typeof v === 'string' && v.trim().toLowerCase() === 'false') return false;
  return fallback;
}

function asPrepayFilter(v: unknown, fallback: ScratchPrepayModeFilter): ScratchPrepayModeFilter {
  const raw = String(v ?? '').trim().toUpperCase();
  if (raw === 'FULL' || raw === 'PARTIAL' || raw === 'BOTH') return raw;
  return fallback;
}

function asScratchRule(row: unknown, fallback: ScratchServiceRuleVm): ScratchServiceRuleVm {
  const r = (row ?? {}) as Record<string, unknown>;
  const prepayModeFilter = asPrepayFilter(r.prepayModeFilter, fallback.prepayModeFilter ?? 'BOTH');
  const partialPrepayEnabled =
    prepayModeFilter === 'PARTIAL' || prepayModeFilter === 'BOTH'
      ? true
      : asBoolFlag(r.partialPrepayEnabled, false);
  const fullPayScratchEnabled =
    asBoolFlag(r.fullPayScratchEnabled, prepayModeFilter !== 'PARTIAL');
  return {
    enabled: asBoolFlag(r.enabled, fallback.enabled),
    rewardMin: Math.max(0, asNum(r.rewardMin, fallback.rewardMin)),
    rewardMax: Math.max(0, asNum(r.rewardMax, fallback.rewardMax)),
    minOrderAmount: Math.max(0, asNum(r.minOrderAmount, fallback.minOrderAmount)),
    prepayModeFilter,
    issueAfterRating: r.issueAfterRating === true || (r.issueAfterRating == null && fallback.issueAfterRating === true),
    fullPayScratchEnabled,
    partialPrepayEnabled,
    partialRewardMin: Math.max(0, asNum(r.partialRewardMin, fallback.partialRewardMin ?? 10)),
    partialRewardMax: Math.max(0, asNum(r.partialRewardMax, fallback.partialRewardMax ?? 50)),
    partialMinPrepayAmount: Math.max(0, asNum(r.partialMinPrepayAmount, fallback.partialMinPrepayAmount ?? 499)),
    rewardDisplayMax: Math.max(0, asNum(r.rewardDisplayMax, fallback.rewardDisplayMax ?? 0)),
    partialRewardDisplayMax: Math.max(0, asNum(r.partialRewardDisplayMax, fallback.partialRewardDisplayMax ?? 0)),
  };
}

export function parseScratchByService(data: Record<string, unknown> | null | undefined): Record<ScratchServiceKey, ScratchServiceRuleVm> {
  const base = defaultScratchByService();
  const raw = data?.scratchByService;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const map = raw as Record<string, unknown>;
    for (const key of SCRATCH_SERVICE_KEYS) {
      base[key] = asScratchRule(map[key], base[key]);
    }
    return base;
  }
  base.GROCERY = {
    enabled: data?.scratchCardEnabled === true,
    rewardMin: Math.max(0, asNum(data?.scratchRewardMin, 10)),
    rewardMax: Math.max(0, asNum(data?.scratchRewardMax, 50)),
    minOrderAmount: Math.max(0, asNum(data?.scratchMinGoodsAmount, 499)),
  };
  return base;
}

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
  scratchByService: Record<ScratchServiceKey, ScratchServiceRuleVm>;
  buyerMembershipEnabled: boolean;
  codEnabled: boolean;
  upiEnabled: boolean;
  codCharge: number;
  deliveryWindowStart: string;
  deliveryWindowEnd: string;
  laundryEnabled: boolean;
  beautyEnabled: boolean;
  beautyMinPrepayAmount: number;
  beautyParlourPaymentFee: number;
  buyerCancelOrderEnabled: boolean;
  buyerCancelItemsEnabled: boolean;
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
  scratchByService: Record<ScratchServiceKey, ScratchServiceRuleVm>;
  buyerMembershipEnabled: boolean;
  codEnabled: boolean;
  upiEnabled: boolean;
  codCharge: number;
  deliveryWindowStart: string;
  deliveryWindowEnd: string;
  laundryEnabled: boolean;
  beautyEnabled: boolean;
  beautyMinPrepayAmount?: number;
  beautyParlourPaymentFee?: number;
  buyerCancelOrderEnabled: boolean;
  buyerCancelItemsEnabled: boolean;
};

function asWindow(v: unknown, fallback: string): string {
  const raw = String(v ?? '').trim().slice(0, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : fallback;
}

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
    scratchByService: parseScratchByService(data),
    buyerMembershipEnabled: data?.buyerMembershipEnabled !== false,
    codEnabled: data?.codEnabled !== false,
    upiEnabled: data?.upiEnabled !== false,
    codCharge: Math.max(0, asNum(data?.codCharge, 0)),
    deliveryWindowStart: asWindow(data?.deliveryWindowStart, '17:00'),
    deliveryWindowEnd: asWindow(data?.deliveryWindowEnd, '19:00'),
    laundryEnabled: data?.laundryEnabled === true,
    beautyEnabled: data?.beautyEnabled === true,
    beautyMinPrepayAmount: Math.max(0, asNum(data?.beautyMinPrepayAmount, 0)),
    beautyParlourPaymentFee: Math.max(0, asNum(data?.beautyParlourPaymentFee, 0)),
    buyerCancelOrderEnabled: data?.buyerCancelOrderEnabled !== false,
    buyerCancelItemsEnabled: data?.buyerCancelItemsEnabled !== false,
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

/** Merge-update one town flag without dropping other settings. */
export async function setTownBeautyEnabled(
  token: string,
  townId: string,
  beautyEnabled: boolean,
): Promise<TownConfigVm> {
  await apiRequest(`/api/v1/towns/${townId}/config/features`, {
    method: 'PATCH',
    token,
    body: { beautyEnabled },
  });
  return getTownConfig(token, townId);
}

export function townConfigToUpdateInput(cfg: TownConfigVm): UpdateTownConfigInput {
  return {
    minOrderValue: cfg.minOrderValue,
    deliveryMode: cfg.deliveryMode,
    deliverySlabs: cfg.deliverySlabs,
    themeColor: cfg.themeColor,
    bestDealsEnabled: cfg.bestDealsEnabled,
    dealPrices: cfg.dealPrices,
    platformFee: cfg.platformFee,
    scratchCardEnabled: cfg.scratchCardEnabled,
    scratchRewardMin: cfg.scratchRewardMin,
    scratchRewardMax: cfg.scratchRewardMax,
    scratchMinGoodsAmount: cfg.scratchMinGoodsAmount,
    scratchByService: cfg.scratchByService,
    buyerMembershipEnabled: cfg.buyerMembershipEnabled,
    codEnabled: cfg.codEnabled,
    upiEnabled: cfg.upiEnabled,
    codCharge: cfg.codCharge,
    deliveryWindowStart: cfg.deliveryWindowStart,
    deliveryWindowEnd: cfg.deliveryWindowEnd,
    laundryEnabled: cfg.laundryEnabled,
    beautyEnabled: cfg.beautyEnabled,
    beautyMinPrepayAmount: cfg.beautyMinPrepayAmount,
    beautyParlourPaymentFee: cfg.beautyParlourPaymentFee,
    buyerCancelOrderEnabled: cfg.buyerCancelOrderEnabled,
    buyerCancelItemsEnabled: cfg.buyerCancelItemsEnabled,
  };
}

export async function saveTownBeautyPaymentRules(
  token: string,
  townId: string,
  rules: { beautyMinPrepayAmount: number; beautyParlourPaymentFee: number },
): Promise<TownConfigVm> {
  const current = await getTownConfig(token, townId);
  return updateTownConfig(token, townId, {
    ...townConfigToUpdateInput(current),
    beautyMinPrepayAmount: Math.max(0, rules.beautyMinPrepayAmount),
    beautyParlourPaymentFee: Math.max(0, rules.beautyParlourPaymentFee),
  });
}

export async function setTownLaundryEnabled(
  token: string,
  townId: string,
  laundryEnabled: boolean,
): Promise<TownConfigVm> {
  await apiRequest(`/api/v1/towns/${townId}/config/features`, {
    method: 'PATCH',
    token,
    body: { laundryEnabled },
  });
  return getTownConfig(token, townId);
}
