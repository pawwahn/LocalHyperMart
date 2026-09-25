import { apiRequest } from '@/shared/api/http';

export type AdminAuditEntry = {
  id: string;
  screenKey: string;
  action: string;
  changeSummary?: string | null;
  changeLines?: string[] | null;
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

function formatRoleLabel(actorRole?: string | null): string {
  const role = (actorRole || 'ADMIN').replaceAll('_', ' ');
  if (role.toUpperCase() === 'SUPER ADMIN') return 'Super admin';
  return role.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Who made the change (role + short id for traceability). */
export function formatAuditActor(row: AdminAuditEntry): string {
  const label = formatRoleLabel(row.actorRole);
  const id = (row.actorUserId || '').replace(/-/g, '');
  const tail = id.length >= 4 ? id.slice(-4) : '';
  return tail ? `${label} · ID …${tail}` : label;
}

const MONEY_KEYS = new Set([
  'minOrderValue',
  'platformFee',
  'deliveryFee',
  'referralReferrerRewardAmount',
  'referralRefereeRewardAmount',
  'membershipQuarterlyPrice',
  'membershipHalfYearPrice',
  'membershipAnnualPrice',
  'codCharge',
  'scratchRewardMin',
  'scratchRewardMax',
  'scratchMinGoodsAmount',
  'completedOrderAmount',
  'pickupAmount',
  'lastMileAmount',
  'amount',
  'total',
  'subtotal',
  'taxAmount',
  'unitOneTown',
  'unitExtraTown',
  'unitAllTowns',
]);

const SKIP_DIFF_KEYS = new Set(['termsText', 'privacyText', 'refundText']);

const PLATFORM_KEY_ORDER = [
  'referralsEnabled',
  'referralReferrerRewardAmount',
  'referralRefereeRewardAmount',
  'referralShareBaseUrl',
  'referralShareMessageTemplate',
  'deliveryFee',
  'vendorOrderAlertMessage',
  'membershipEnabled',
  'mapsEnabled',
  'maintenanceMode',
  'supportPhone',
  'legalVersion',
];

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
  codEnabled: 'COD',
  upiEnabled: 'UPI / online pay',
  codCharge: 'COD charge',
  status: 'Status',
  referralsEnabled: 'Referrals',
  referralReferrerRewardAmount: 'Referrer reward',
  referralRefereeRewardAmount: 'Referee reward',
  referralShareBaseUrl: 'Referral share URL',
  referralShareMessageTemplate: 'Referral share message',
  deliveryFee: 'Delivery fee',
  vendorOrderAlertMessage: 'Vendor alert',
  mapsEnabled: 'Maps',
  maintenanceMode: 'Maintenance',
  supportPhone: 'Support phone',
  grievanceOfficer: 'Grievance officer',
  membershipEnabled: 'Membership sales',
  membershipQuarterlyPrice: 'Membership 3M price',
  membershipQuarterlyCredits: 'Membership 3M credits',
  membershipHalfYearPrice: 'Membership 6M price',
  membershipHalfYearCredits: 'Membership 6M credits',
  membershipAnnualPrice: 'Membership annual price',
  membershipAnnualCredits: 'Membership annual credits',
  legalVersion: 'Legal version',
  termsUrl: 'Terms URL',
  privacyUrl: 'Privacy URL',
  refundUrl: 'Refund URL',
};

function prettyVal(key: string, raw: unknown): string {
  if (raw == null) return '—';
  if (typeof raw === 'boolean') return raw ? 'on' : 'off';
  if (MONEY_KEYS.has(key) && (typeof raw === 'number' || typeof raw === 'string')) {
    const n = Number(raw);
    if (Number.isFinite(n)) return `₹${n}`;
  }
  if (key === 'referralShareMessageTemplate' || key === 'vendorOrderAlertMessage') {
    const s = String(raw).trim();
    if (s.length > 40) return `${s.slice(0, 37)}…`;
  }
  if (Array.isArray(raw) || (typeof raw === 'object' && raw !== null)) return 'changed';
  const s = String(raw).trim();
  if (s.length > 56) return `${s.slice(0, 53)}…`;
  return s || '—';
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && String(a).trim() !== '' && String(b).trim() !== '') {
    return na === nb;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return Boolean(a) === Boolean(b);
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function isGenericSummary(text: string): boolean {
  const s = text.trim().toLowerCase();
  return s === 'updated platform settings' || s === 'updated settings' || s === '';
}

function splitSummaryLines(summary: string): string[] {
  return summary
    .split(/;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function orderKeys(keys: string[], screenKey: string): string[] {
  if (screenKey !== 'settings') return keys;
  return [...keys].sort((a, b) => {
    const ia = PLATFORM_KEY_ORDER.indexOf(a);
    const ib = PLATFORM_KEY_ORDER.indexOf(b);
    const ra = ia === -1 ? 999 : ia;
    const rb = ib === -1 ? 999 : ib;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}

function diffFromSnapshots(row: AdminAuditEntry, townName?: string | null): string[] {
  const before = row.beforeSnapshot ?? {};
  const after = row.afterSnapshot ?? {};
  const keys = orderKeys(
    [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !SKIP_DIFF_KEYS.has(k)),
    row.screenKey,
  );
  const lines: string[] = [];
  for (const key of keys) {
    if (valuesEqual(before[key], after[key])) continue;
    const label = FIELD_LABELS[key] ?? key;
    lines.push(`${label}: ${prettyVal(key, before[key])} → ${prettyVal(key, after[key])}`);
  }
  const legalChanged =
    !valuesEqual(before.termsText, after.termsText) ||
    !valuesEqual(before.privacyText, after.privacyText) ||
    !valuesEqual(before.refundText, after.refundText);
  if (legalChanged) {
    lines.push(
      `Legal copy: v${prettyVal('legalVersion', before.legalVersion)} → v${prettyVal('legalVersion', after.legalVersion)}`,
    );
  }
  if (lines.length) {
    const town = (townName || '').trim();
    return town ? [`Town: ${town}`, ...lines] : lines;
  }
  return [];
}

export type ParsedAuditChange =
  | { kind: 'field'; label: string; before: string; after: string }
  | { kind: 'text'; text: string };

/** Parse a change line into label + before/after for UI. */
export function parseAuditChangeLine(line: string): ParsedAuditChange {
  const trimmed = line.trim();
  const colonArrow = trimmed.match(/^(.+?):\s*(.+?)\s*→\s*(.+)$/);
  if (colonArrow) {
    return {
      kind: 'field',
      label: colonArrow[1].trim(),
      before: colonArrow[2].trim(),
      after: colonArrow[3].trim(),
    };
  }
  const plainArrow = trimmed.match(/^(.+?)\s+(.+?)\s*→\s*(.+)$/);
  if (plainArrow && !plainArrow[1].includes(':')) {
    return {
      kind: 'field',
      label: plainArrow[1].trim(),
      before: plainArrow[2].trim(),
      after: plainArrow[3].trim(),
    };
  }
  return { kind: 'text', text: trimmed };
}

/** Structured lines: field-level old → new (never only a generic sentence). */
export function formatAuditChangeLines(row: AdminAuditEntry, townName?: string | null): string[] {
  const summaryText = (row.changeSummary || '').trim();
  const fromSnaps = diffFromSnapshots(row, townName);
  if (fromSnaps.length) return fromSnaps;

  const fromApi = row.changeLines?.map((line) => line.trim()).filter(Boolean);
  if (fromApi?.length && !isGenericSummary(fromApi[0]) && !fromApi.every((l) => isGenericSummary(l))) {
    const town = (townName || '').trim();
    if (town && !fromApi.some((l) => l.toLowerCase().includes(town.split(',')[0].trim().toLowerCase()))) {
      return [`Town: ${town}`, ...fromApi];
    }
    return fromApi;
  }

  if (summaryText && !isGenericSummary(summaryText)) {
    const parts = splitSummaryLines(summaryText);
    if (parts.length) return parts;
  }

  if (summaryText) return [summaryText];
  const action = (row.action || 'Change').replaceAll('_', ' ');
  return action ? [action] : [];
}

/** One-line “what changed” — never the full payload. */
export function formatAuditChange(row: AdminAuditEntry, townName?: string | null): string {
  const lines = formatAuditChangeLines(row, townName);
  if (lines.length === 1) return lines[0];
  if (lines.length > 1) return `${lines.length} fields updated`;
  return (row.action || 'Change').replaceAll('_', ' ');
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
