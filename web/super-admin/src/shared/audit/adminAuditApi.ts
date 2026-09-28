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
  'mrp',
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
  name: 'Name',
  description: 'Description',
  categoryName: 'Category',
  unitCode: 'Unit',
  mrp: 'MRP',
  hsnCode: 'HSN',
  gstPercent: 'GST %',
  cessPercent: 'Cess %',
  priceIncludesTax: 'Price includes tax',
  countryOfOrigin: 'Country of origin',
  shopName: 'Shop',
  businessName: 'Business',
  ownerName: 'Owner',
  phone: 'Phone',
  address: 'Address',
  gstNumber: 'GST',
  fssaiNumber: 'FSSAI',
  bankAccount: 'Bank account',
  ifsc: 'IFSC',
  disabledReason: 'Disable reason',
  rejectReason: 'Reject reason',
  completedOrderAmount: 'To customer',
  pickupAmount: 'Vendor → hub',
  lastMileAmount: 'Return → shop',
};

const VENDOR_KEY_ORDER = [
  'status',
  'shopName',
  'businessName',
  'ownerName',
  'phone',
  'address',
  'gstNumber',
  'fssaiNumber',
  'bankAccount',
  'ifsc',
  'disabledReason',
  'rejectReason',
];

const CATALOG_KEY_ORDER = [
  'name',
  'categoryName',
  'unitCode',
  'mrp',
  'hsnCode',
  'gstPercent',
  'cessPercent',
  'priceIncludesTax',
  'countryOfOrigin',
  'description',
];

function prettyVal(key: string, raw: unknown): string {
  if (raw == null) return '—';
  if (typeof raw === 'boolean') return raw ? 'on' : 'off';
  if (key === 'status') {
    const status = String(raw).trim().toUpperCase();
    if (status === 'ACTIVE') return 'Active';
    if (status === 'DISABLED') return 'Disabled';
    if (status === 'PENDING') return 'Pending';
    if (status === 'APPROVED') return 'Approved';
    if (status === 'REJECTED') return 'Rejected';
  }
  if (key === 'gstPercent' || key === 'cessPercent') {
    const n = Number(raw);
    if (Number.isFinite(n)) return `${n}%`;
  }
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
  if (s === 'updated platform settings' || s === 'updated settings' || s === '') return true;
  if (/^updated item [^;]+$/.test(s)) return true;
  if (/^updated category [^;]+$/.test(s)) return true;
  if (/^created item [^;]+$/.test(s)) return true;
  if (/^created category [^;]+$/.test(s)) return true;
  return false;
}

function splitSummaryLines(summary: string): string[] {
  return summary
    .split(/;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function orderKeys(keys: string[], screenKey: string): string[] {
  if (screenKey === 'vendors') {
    return [...keys].sort((a, b) => {
      const ia = VENDOR_KEY_ORDER.indexOf(a);
      const ib = VENDOR_KEY_ORDER.indexOf(b);
      const ra = ia === -1 ? 999 : ia;
      const rb = ib === -1 ? 999 : ib;
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b);
    });
  }
  if (screenKey === 'catalog') {
    return [...keys].sort((a, b) => {
      const ia = CATALOG_KEY_ORDER.indexOf(a);
      const ib = CATALOG_KEY_ORDER.indexOf(b);
      const ra = ia === -1 ? 999 : ia;
      const rb = ib === -1 ? 999 : ib;
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b);
    });
  }
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

function hasFieldLevelLines(lines: string[]): boolean {
  return lines.some((l) => l.includes('→'));
}

/** Older vendor rows stored only “Approved P Mart”. Turn those into old → new when the action is known. */
function vendorLegacyLines(row: AdminAuditEntry): string[] | null {
  if (row.screenKey !== 'vendors') return null;
  if (row.beforeSnapshot && Object.keys(row.beforeSnapshot).length && row.afterSnapshot && Object.keys(row.afterSnapshot).length) {
    return null;
  }
  const action = (row.action || '').toUpperCase();
  const summary = (row.changeSummary || '').trim();
  if (action === 'APPROVE_VENDOR') return ['Status: Pending → Approved'];
  if (action === 'REJECT_VENDOR') return ['Status: Pending → Rejected'];
  if (action === 'UPDATE_VENDOR_STATUS') {
    const matched = summary.match(/→\s*(ACTIVE|DISABLED)\b/i);
    if (!matched) return null;
    const next = matched[1].toUpperCase() === 'ACTIVE' ? 'Active' : 'Disabled';
    const prev = next === 'Active' ? 'Disabled' : 'Active';
    return [`Status: ${prev} → ${next}`];
  }
  return null;
}

/** Older billing rows stored only “P Mart terms from 2026-09-28”. */
function vendorBillingLegacyLines(row: AdminAuditEntry): string[] | null {
  if (row.screenKey !== 'vendor-billing') return null;
  if (row.changeLines?.some((line) => line.includes('→'))) return null;
  const summary = (row.changeSummary || '').trim();
  const matched = summary.match(/^(.+?) terms from (\d{4}-\d{2}-\d{2})$/);
  if (!matched) return null;
  return [`Starts from: — → ${matched[2]}`];
}

/** Short title above the field diffs, such as “Approved P Mart”. */
export function formatAuditHeadline(row: AdminAuditEntry, lines: string[]): string | null {
  const summary = (row.changeSummary || '').trim();
  if (!summary) return null;
  const head = summary.split(';')[0].trim();
  if (!head || head.includes('→')) return null;
  if (/ terms from \d{4}-\d{2}-\d{2}$/.test(head) && lines.some((line) => line.includes('→'))) return null;
  if (lines.length === 1 && lines[0] === head) return null;
  if (lines.includes(head)) return null;
  return head;
}

/** Structured lines: field-level old → new (never only a generic sentence). */
export function formatAuditChangeLines(row: AdminAuditEntry, townName?: string | null): string[] {
  const summaryText = (row.changeSummary || '').trim();
  const fromApi = row.changeLines?.map((line) => line.trim()).filter(Boolean) ?? [];
  if (fromApi.length && hasFieldLevelLines(fromApi)) {
    const town = (townName || '').trim();
    if (town && !fromApi.some((l) => l.toLowerCase().includes(town.split(',')[0].trim().toLowerCase()))) {
      return [`Town: ${town}`, ...fromApi];
    }
    return fromApi;
  }

  const fromSnaps = diffFromSnapshots(row, townName);
  if (fromSnaps.length) return fromSnaps;

  const legacy = vendorLegacyLines(row);
  if (legacy?.length) return legacy;

  const billingLegacy = vendorBillingLegacyLines(row);
  if (billingLegacy?.length) return billingLegacy;

  if (fromApi.length && !isGenericSummary(fromApi[0]) && !fromApi.every((l) => isGenericSummary(l))) {
    const town = (townName || '').trim();
    if (town && !fromApi.some((l) => l.toLowerCase().includes(town.split(',')[0].trim().toLowerCase()))) {
      return [`Town: ${town}`, ...fromApi];
    }
    return fromApi;
  }

  if (summaryText && !isGenericSummary(summaryText)) {
    const semi = summaryText.indexOf(';');
    if (semi > 0) {
      const tail = summaryText
        .slice(semi + 1)
        .split(/;\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (tail.length) return tail;
    }
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
  params?: {
    townId?: string;
    page?: number;
    size?: number;
    from?: string;
    to?: string;
    q?: string;
    actions?: string[];
    prefixes?: string[];
  },
): Promise<AdminAuditPage> {
  const q = new URLSearchParams();
  q.set('screen', screen);
  q.set('page', String(params?.page ?? 0));
  q.set('size', String(params?.size ?? 25));
  if (params?.townId) q.set('townId', params.townId);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.q?.trim()) q.set('q', params.q.trim());
  if (params?.actions?.length) q.set('action', params.actions.join(','));
  if (params?.prefixes?.length) q.set('prefix', params.prefixes.join(','));
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
