import { apiRequest } from '@/shared/api/http';

export type VolumeSlabTier = {
  minCount: number;
  maxCount: number | null;
  amount: number;
};

export type PerOrderIncentive = {
  enabled: boolean;
  pickupAmount: number;
  lastMileAmount: number;
  completedOrderAmount: number;
};

export type PeriodIncentive = {
  enabled: boolean;
  amount: number;
  minCompletedOrders: number;
};

export type VolumeSlabIncentive = {
  enabled: boolean;
  period: 'DAY' | 'MONTH';
  metric: 'COMPLETED_ORDERS' | 'LAST_MILE' | 'ALL_TRIPS';
  payout: 'PER_UNIT' | 'FLAT_BONUS';
  tiers: VolumeSlabTier[];
};

export type FranchiseTerms = {
  enabled: boolean;
  cadence: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'LIFETIME';
  amount: number;
};

export type PayoutPartyConfig = {
  enabled: boolean;
  perOrder: PerOrderIncentive;
  perDay: PeriodIncentive;
  perMonth: PeriodIncentive;
  slabs: VolumeSlabIncentive;
  franchise: FranchiseTerms;
};

export type TownPayoutConfig = {
  townAdminCanEditAgentRates: boolean;
  canEditAgentRates: boolean;
  canEditHubRates: boolean;
  canEditStructure: boolean;
  agent: PayoutPartyConfig;
  hub: PayoutPartyConfig;
};

export type PayoutEstimate = {
  agentTotal: number;
  hubTotal: number;
};

function asNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (v == null) return fallback;
  return String(v).toLowerCase() === 'true';
}

function emptyPeriod(): PeriodIncentive {
  return { enabled: false, amount: 0, minCompletedOrders: 0 };
}

function emptyPerOrder(): PerOrderIncentive {
  return { enabled: true, pickupAmount: 0, lastMileAmount: 0, completedOrderAmount: 0 };
}

function emptySlabs(): VolumeSlabIncentive {
  return {
    enabled: false,
    period: 'MONTH',
    metric: 'COMPLETED_ORDERS',
    payout: 'PER_UNIT',
    tiers: [{ minCount: 1, maxCount: null, amount: 0 }],
  };
}

function emptyFranchise(): FranchiseTerms {
  return { enabled: false, cadence: 'MONTHLY', amount: 0 };
}

export function emptyParty(): PayoutPartyConfig {
  return {
    enabled: true,
    perOrder: emptyPerOrder(),
    perDay: emptyPeriod(),
    perMonth: emptyPeriod(),
    slabs: emptySlabs(),
    franchise: emptyFranchise(),
  };
}

function parsePeriod(raw: unknown): PeriodIncentive {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: asBool(row.enabled, false),
    amount: Math.max(0, asNum(row.amount, 0)),
    minCompletedOrders: Math.max(0, Math.round(asNum(row.minCompletedOrders, 0))),
  };
}

function parsePerOrder(raw: unknown): PerOrderIncentive {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: asBool(row.enabled, true),
    pickupAmount: Math.max(0, asNum(row.pickupAmount, 0)),
    lastMileAmount: Math.max(0, asNum(row.lastMileAmount, 0)),
    completedOrderAmount: Math.max(0, asNum(row.completedOrderAmount, 0)),
  };
}

function parseSlabs(raw: unknown): VolumeSlabIncentive {
  const row = (raw ?? {}) as Record<string, unknown>;
  const period = String(row.period ?? 'MONTH').toUpperCase() === 'DAY' ? 'DAY' : 'MONTH';
  const metricRaw = String(row.metric ?? 'COMPLETED_ORDERS').toUpperCase();
  const metric: VolumeSlabIncentive['metric'] =
    metricRaw === 'LAST_MILE' || metricRaw === 'ALL_TRIPS' ? metricRaw : 'COMPLETED_ORDERS';
  const payout = String(row.payout ?? 'PER_UNIT').toUpperCase() === 'FLAT_BONUS' ? 'FLAT_BONUS' : 'PER_UNIT';
  const tiersRaw = Array.isArray(row.tiers) ? row.tiers : [];
  const tiers = tiersRaw.map((item) => {
    const t = (item ?? {}) as Record<string, unknown>;
    return {
      minCount: Math.max(0, Math.round(asNum(t.minCount, 1))),
      maxCount: t.maxCount == null || t.maxCount === '' ? null : Math.max(0, Math.round(asNum(t.maxCount, 0))),
      amount: Math.max(0, asNum(t.amount, 0)),
    };
  });
  return {
    enabled: asBool(row.enabled, false),
    period,
    metric,
    payout,
    tiers: tiers.length ? tiers : [{ minCount: 1, maxCount: null, amount: 0 }],
  };
}

function parseFranchise(raw: unknown): FranchiseTerms {
  const row = (raw ?? {}) as Record<string, unknown>;
  const cadenceRaw = String(row.cadence ?? 'MONTHLY').toUpperCase();
  const cadence: FranchiseTerms['cadence'] =
    cadenceRaw === 'QUARTERLY' || cadenceRaw === 'YEARLY' || cadenceRaw === 'LIFETIME'
      ? cadenceRaw
      : 'MONTHLY';
  return {
    enabled: asBool(row.enabled, false),
    cadence,
    amount: Math.max(0, asNum(row.amount, 0)),
  };
}

function parseParty(raw: unknown): PayoutPartyConfig {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: asBool(row.enabled, true),
    perOrder: parsePerOrder(row.perOrder),
    perDay: parsePeriod(row.perDay),
    perMonth: parsePeriod(row.perMonth),
    slabs: parseSlabs(row.slabs),
    franchise: parseFranchise(row.franchise),
  };
}

export function parsePayoutConfig(raw: unknown): TownPayoutConfig {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    townAdminCanEditAgentRates: asBool(row.townAdminCanEditAgentRates, false),
    canEditAgentRates: asBool(row.canEditAgentRates, false),
    canEditHubRates: asBool(row.canEditHubRates, false),
    canEditStructure: asBool(row.canEditStructure, false),
    agent: parseParty(row.agent),
    hub: parseParty(row.hub),
  };
}

export async function getTownPayoutConfig(token: string, townId: string): Promise<TownPayoutConfig> {
  const data = await apiRequest<unknown>(`/api/v1/towns/${townId}/delivery-payout-config`, { token });
  return parsePayoutConfig(data);
}

export async function saveTownPayoutConfig(
  token: string,
  townId: string,
  cfg: TownPayoutConfig,
): Promise<TownPayoutConfig> {
  const data = await apiRequest<unknown>(`/api/v1/towns/${townId}/delivery-payout-config`, {
    method: 'PUT',
    token,
    body: cfg,
  });
  return parsePayoutConfig(data);
}

export async function patchTownAgentRates(
  token: string,
  townId: string,
  agent: PayoutPartyConfig,
): Promise<TownPayoutConfig> {
  const data = await apiRequest<unknown>(`/api/v1/towns/${townId}/delivery-payout-config/agent-rates`, {
    method: 'PATCH',
    token,
    body: {
      perOrder: {
        pickupAmount: agent.perOrder.pickupAmount,
        lastMileAmount: agent.perOrder.lastMileAmount,
        completedOrderAmount: agent.perOrder.completedOrderAmount,
      },
      perDay: {
        amount: agent.perDay.amount,
        minCompletedOrders: agent.perDay.minCompletedOrders,
      },
      perMonth: {
        amount: agent.perMonth.amount,
        minCompletedOrders: agent.perMonth.minCompletedOrders,
      },
      slabAmounts: agent.slabs.tiers.map((t) => t.amount),
    },
  });
  return parsePayoutConfig(data);
}

export async function estimateTownPayout(
  token: string,
  townId: string,
  input: { completedOrders: number; pickups: number; lastMiles: number; qualifyingDays: number },
): Promise<PayoutEstimate> {
  const params = new URLSearchParams({
    completedOrders: String(input.completedOrders),
    pickups: String(input.pickups),
    lastMiles: String(input.lastMiles),
    qualifyingDays: String(input.qualifyingDays),
  });
  const data = await apiRequest<Record<string, unknown>>(
    `/api/v1/towns/${townId}/delivery-payout-config/estimate?${params}`,
    { token },
  );
  return {
    agentTotal: Math.max(0, asNum(data?.agentTotal, 0)),
    hubTotal: Math.max(0, asNum(data?.hubTotal, 0)),
  };
}
