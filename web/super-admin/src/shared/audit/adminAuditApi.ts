import { apiRequest } from '@/shared/api/http';

export type AdminAuditEntry = {
  id: string;
  screenKey: string;
  action: string;
  changeSummary?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  townId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  createdAt: string;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
};

function whenFull(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatAuditWhen(iso?: string | null): string {
  return whenFull(iso);
}

export function formatAuditActor(row: AdminAuditEntry): string {
  const role = (row.actorRole || 'ADMIN').replaceAll('_', ' ');
  if (role.toUpperCase() === 'SUPER ADMIN') return 'Super admin';
  return role.replace(/\b\w/g, (c) => c.toUpperCase());
}

const MONEY_KEYS = new Set([
  'minOrderValue',
  'platformFee',
  'scratchRewardMin',
  'scratchRewardMax',
  'scratchMinGoodsAmount',
  'completedOrderAmount',
  'pickupAmount',
  'lastMileAmount',
  'amount',
]);

const FIELD_LABELS: Record<string, string> = {
  minOrderValue: 'Min order',
  platformFee: 'Platform fee',
  deliveryMode: 'Delivery',
  themeColor: 'Theme',
  bestDealsEnabled: 'Best deals',
  buyerMembershipEnabled: 'Buyer membership',
  scratchCardEnabled: 'Scratch card',
  scratchRewardMin: 'Scratch min',
  scratchRewardMax: 'Scratch max',
  scratchMinGoodsAmount: 'Scratch goods min',
  dealPrices: 'Deal prices',
  deliverySlabs: 'Delivery slabs',
  status: 'Status',
};

function prettyVal(key: string, raw: unknown): string {
  if (raw == null) return '—';
  if (typeof raw === 'boolean') return raw ? 'on' : 'off';
  if (MONEY_KEYS.has(key) && (typeof raw === 'number' || typeof raw === 'string')) {
    const n = Number(raw);
    if (Number.isFinite(n)) return `₹${n}`;
  }
  if (Array.isArray(raw) || (typeof raw === 'object' && raw !== null)) return 'changed';
  return String(raw);
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** One-line “what changed” — never the full payload. */
export function formatAuditChange(row: AdminAuditEntry, townName?: string | null): string {
  const summary = (row.changeSummary || '').trim();
  const generic = !summary || /^updated settings$/i.test(summary);
  let change = summary;
  if (generic && (row.beforeSnapshot || row.afterSnapshot)) {
    const before = row.beforeSnapshot ?? {};
    const after = row.afterSnapshot ?? {};
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    const parts: string[] = [];
    for (const key of keys) {
      if (same(before[key], after[key])) continue;
      const label = FIELD_LABELS[key] ?? key;
      parts.push(`${label} ${prettyVal(key, before[key])} → ${prettyVal(key, after[key])}`);
    }
    if (parts.length) change = parts.join(', ');
  }
  if (!change) change = (row.action || 'Change').replaceAll('_', ' ');
  const town = (townName || '').trim();
  if (town && !change.toLowerCase().includes(town.split(',')[0].trim().toLowerCase())) {
    return `${town} · ${change}`;
  }
  return change;
}

export type AdminAuditPage = {
  items: AdminAuditEntry[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export async function listAdminAudit(
  token: string,
  screen: string,
  params?: { townId?: string; page?: number; size?: number; from?: string; to?: string; q?: string },
): Promise<AdminAuditPage> {
  const q = new URLSearchParams();
  q.set('screen', screen);
  q.set('page', String(params?.page ?? 0));
  q.set('size', String(params?.size ?? 25));
  if (params?.townId) q.set('townId', params.townId);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.q?.trim()) q.set('q', params.q.trim());
  const data = await apiRequest<AdminAuditPage>(
    `/api/v1/platform/admin-audit?${q.toString()}`,
    { token },
  );
  const items = data.items ?? [];
  return {
    items,
    page: data.page ?? 0,
    size: data.size ?? items.length,
    totalElements: data.totalElements ?? items.length,
    totalPages: Math.max(data.totalPages ?? 1, 1),
  };
}
