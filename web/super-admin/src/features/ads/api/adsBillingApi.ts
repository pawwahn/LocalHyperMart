import { apiRequest, type PageData } from '@/shared/api/http';
import type { TownAdSlot } from './adsApi';

export type AdBillPeriod = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
export type AdTownScope = 'ONE_TOWN' | 'MULTI_TOWN' | 'ALL_TOWNS';
export type AdInvoiceStatus = 'ISSUED' | 'PAID' | 'VOID';

export type AdPeriodRate = {
  oneTown: number;
  extraTown: number;
  allTowns: number;
};

export type AdSlotRate = {
  day: AdPeriodRate;
  week: AdPeriodRate;
  month: AdPeriodRate;
  year: AdPeriodRate;
};

export type AdRateCard = {
  id: string;
  taxPercent: number;
  notes?: string | null;
  homeHero: AdSlotRate;
  homeMidGrid: AdSlotRate;
  cartUpsell: AdSlotRate;
};

export type AdInvoiceTown = {
  id: string;
  name: string;
  townCode: string;
};

export type AdInvoiceConflict = {
  invoiceId: string;
  invoiceNumber: string;
  advertiserName: string;
  fromDate: string;
  toDate: string;
  status: string;
  slotLabel?: string;
  allTowns?: boolean;
  bookingPhase?: AdBookingPhase;
};

export type AdBookingPhase = 'LIVE' | 'PREORDER' | 'ENDED';

export type AdQuote = {
  slot: TownAdSlot;
  slotIndex: number;
  slotLabel: string;
  period: AdBillPeriod;
  townScope: AdTownScope;
  allTowns: boolean;
  townIds: string[];
  towns: AdInvoiceTown[];
  townCount: number;
  enabledTownCount: number;
  fromDate: string;
  toDate: string;
  calendarDays: number;
  billableUnits: number;
  unitOneTown: number;
  unitExtraTown: number;
  unitAllTowns: number;
  unitRate: number;
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  breakdown: string;
  conflicts: AdInvoiceConflict[];
  available?: boolean;
  nextFreeFrom?: string | null;
  nextFreeTo?: string | null;
};

export type AdInvoice = {
  id: string;
  invoiceNumber: string;
  status: AdInvoiceStatus;
  advertiserName: string;
  advertiserPhone: string;
  advertiserGstin?: string | null;
  notes?: string | null;
  slot: TownAdSlot;
  slotIndex: number;
  slotLabel: string;
  period: AdBillPeriod;
  townScope: AdTownScope;
  allTowns: boolean;
  townIds: string[];
  towns: AdInvoiceTown[];
  townCount: number;
  fromDate: string;
  toDate: string;
  calendarDays: number;
  billableUnits: number;
  unitOneTown: number;
  unitExtraTown: number;
  unitAllTowns: number;
  unitRate: number;
  taxPercent: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  breakdown: string;
  paidAt?: string | null;
  paidMethod?: string | null;
  paidReference?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  issuedAt: string;
  bookingPhase?: AdBookingPhase;
};

export type AdOccupancyBooking = {
  invoiceId: string;
  invoiceNumber: string;
  advertiserName: string;
  status: AdInvoiceStatus;
  slot: TownAdSlot;
  slotIndex: number;
  slotLabel: string;
  fromDate: string;
  toDate: string;
  allTowns: boolean;
  towns: AdInvoiceTown[];
  bookingPhase: AdBookingPhase;
};

export type AdOccupancy = {
  fromDate: string;
  toDate: string;
  townId?: string | null;
  townName?: string | null;
  bookings: AdOccupancyBooking[];
};

export type QuoteInput = {
  slot: TownAdSlot;
  slotIndex?: number;
  period: AdBillPeriod;
  townScope: AdTownScope;
  townIds?: string[];
  fromDate: string;
  toDate: string;
};

export type CreateInvoiceInput = QuoteInput & {
  advertiserName: string;
  advertiserPhone: string;
  advertiserGstin?: string;
  notes?: string;
};

export const AD_PAY_METHODS = ['UPI', 'NEFT', 'IMPS', 'RTGS', 'CASH', 'CHEQUE', 'OTHER'] as const;

export function money(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '₹0';
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function periodLabel(period: AdBillPeriod): string {
  if (period === 'DAY') return 'Per day';
  if (period === 'WEEK') return 'Per week';
  if (period === 'MONTH') return 'Per month';
  return 'Per year';
}

export function scopeLabel(scope: AdTownScope): string {
  return scope === 'ONE_TOWN' ? 'One town' : scope === 'MULTI_TOWN' ? 'Multiple towns' : 'All towns';
}

export function statusLabel(status: AdInvoiceStatus): string {
  return status === 'ISSUED' ? 'Unpaid' : status === 'PAID' ? 'Paid' : 'Void';
}

export function bookingPhaseLabel(phase?: AdBookingPhase | null): string {
  if (phase === 'PREORDER') return 'Pre-order';
  if (phase === 'ENDED') return 'Ended';
  return 'Live';
}

export function isoToday(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

export function monthBounds(year: number, monthIndex: number): { from: string; to: string } {
  const from = new Date(year, monthIndex, 1);
  const to = new Date(year, monthIndex + 1, 0);
  const fmt = (d: Date) => {
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
  };
  return { from: fmt(from), to: fmt(to) };
}

export const AD_SLOT_ROWS: { slot: TownAdSlot; slotIndex: number; label: string }[] = [
  { slot: 'HOME_HERO', slotIndex: 0, label: 'Main ad' },
  { slot: 'HOME_MID_GRID', slotIndex: 1, label: 'Mid 1' },
  { slot: 'HOME_MID_GRID', slotIndex: 2, label: 'Mid 2' },
  { slot: 'HOME_MID_GRID', slotIndex: 3, label: 'Mid 3' },
  { slot: 'HOME_MID_GRID', slotIndex: 4, label: 'Mid 4' },
  { slot: 'HOME_MID_GRID', slotIndex: 5, label: 'Mid 5' },
  { slot: 'CART_UPSELL', slotIndex: 0, label: 'Cart ad' },
];

export async function fetchAdRates(token: string): Promise<AdRateCard> {
  return apiRequest<AdRateCard>('/api/v1/platform/ads/rates', { token });
}

export async function saveAdRates(token: string, body: Omit<AdRateCard, 'id'>): Promise<AdRateCard> {
  return apiRequest<AdRateCard>('/api/v1/platform/ads/rates', { token, method: 'PUT', body });
}

export async function quoteAdBill(token: string, body: QuoteInput): Promise<AdQuote> {
  return apiRequest<AdQuote>('/api/v1/platform/ads/quotes', { token, method: 'POST', body });
}

export async function fetchAdOccupancy(
  token: string,
  params: { from: string; to: string; townId?: string; slot?: TownAdSlot },
): Promise<AdOccupancy> {
  const q = new URLSearchParams();
  q.set('from', params.from);
  q.set('to', params.to);
  if (params.townId) q.set('townId', params.townId);
  if (params.slot) q.set('slot', params.slot);
  const data = await apiRequest<AdOccupancy>(`/api/v1/platform/ads/occupancy?${q}`, { token });
  return { ...data, bookings: data.bookings ?? [] };
}

export async function listAdInvoices(
  token: string,
  params: {
    status?: AdInvoiceStatus | '';
    slot?: TownAdSlot | '';
    q?: string;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
  } = {},
): Promise<PageData<AdInvoice>> {
  const q = new URLSearchParams();
  q.set('page', String(params.page ?? 0));
  q.set('size', String(params.size ?? 25));
  if (params.status) q.set('status', params.status);
  if (params.slot) q.set('slot', params.slot);
  if (params.q?.trim()) q.set('q', params.q.trim());
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  const data = await apiRequest<PageData<AdInvoice>>(`/api/v1/platform/ads/invoices?${q}`, { token });
  const items = data.items ?? [];
  return {
    items,
    page: data.page ?? 0,
    size: data.size ?? items.length,
    totalElements: data.totalElements ?? items.length,
    totalPages: Math.max(data.totalPages ?? 1, 1),
  };
}

export async function createAdInvoice(token: string, body: CreateInvoiceInput): Promise<AdInvoice> {
  return apiRequest<AdInvoice>('/api/v1/platform/ads/invoices', { token, method: 'POST', body });
}

export async function fetchAdInvoice(token: string, id: string): Promise<AdInvoice> {
  return apiRequest<AdInvoice>(`/api/v1/platform/ads/invoices/${id}`, { token });
}

export async function payAdInvoice(
  token: string,
  id: string,
  body: { method: string; reference: string },
): Promise<AdInvoice> {
  return apiRequest<AdInvoice>(`/api/v1/platform/ads/invoices/${id}/pay`, { token, method: 'POST', body });
}

export async function voidAdInvoice(token: string, id: string, reason: string): Promise<AdInvoice> {
  return apiRequest<AdInvoice>(`/api/v1/platform/ads/invoices/${id}/void`, {
    token,
    method: 'POST',
    body: { reason },
  });
}

function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function adInvoiceHtml(inv: AdInvoice): string {
  const towns = inv.allTowns
    ? 'All towns'
    : inv.towns?.length
      ? inv.towns.map((t) => t.name).join(', ')
      : '—';
  const paid =
    inv.status === 'PAID'
      ? `${esc(inv.paidMethod)} · ${esc(inv.paidReference)} · ${inv.paidAt ? new Date(inv.paidAt).toLocaleString('en-IN') : ''}`
      : inv.status === 'VOID'
        ? `Void · ${esc(inv.voidReason)}`
        : 'Unpaid';
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(inv.invoiceNumber)}</title>
<style>
  html, body { background: #fff; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 20px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #555; font-size: 12px; }
  .row { display: flex; justify-content: space-between; gap: 24px; margin: 16px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
  th { background: #f4f4f4; }
  .right { text-align: right; }
  .stamp { font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
    border: 2px solid ${inv.status === 'PAID' ? '#047857' : inv.status === 'VOID' ? '#b91c1c' : '#92400e'};
    color: ${inv.status === 'PAID' ? '#047857' : inv.status === 'VOID' ? '#b91c1c' : '#92400e'};
    padding: 6px 10px; display: inline-block; }
  .totals td { border: none; }
  @media print { body { margin: 12mm; } }
</style></head><body>
  <div class="row">
    <div>
      <h1>HyperLocalMart</h1>
      <div class="muted">Advertisement invoice</div>
    </div>
    <div class="right">
      <div><strong>${esc(inv.invoiceNumber)}</strong></div>
      <div class="muted">Issued ${esc(inv.issuedAt ? new Date(inv.issuedAt).toLocaleString('en-IN') : '')}</div>
      <div class="stamp">${esc(statusLabel(inv.status))}</div>
    </div>
  </div>
  <div class="row">
    <div>
      <strong>Bill to</strong><br>
      ${esc(inv.advertiserName)}<br>
      ${esc(inv.advertiserPhone)}
      ${inv.advertiserGstin ? `<br>GSTIN ${esc(inv.advertiserGstin)}` : ''}
    </div>
    <div class="right">
      <strong>Run</strong><br>
      ${esc(fmtDate(inv.fromDate))} – ${esc(fmtDate(inv.toDate))}<br>
      ${esc(inv.calendarDays)} day${inv.calendarDays === 1 ? '' : 's'}
    </div>
  </div>
  <table>
    <thead><tr><th>Placement</th><th>Towns</th><th>Period</th><th class="right">Units</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
    <tbody>
      <tr>
        <td>${esc(inv.slotLabel)}</td>
        <td>${esc(towns)}</td>
        <td>${esc(periodLabel(inv.period))}</td>
        <td class="right">${esc(inv.billableUnits)}</td>
        <td class="right">${esc(money(inv.unitRate))}</td>
        <td class="right">${esc(money(inv.subtotal))}</td>
      </tr>
    </tbody>
  </table>
  <table class="totals" style="width:280px;margin-left:auto;border:none">
    <tr><td>Subtotal</td><td class="right">${esc(money(inv.subtotal))}</td></tr>
    <tr><td>GST ${esc(inv.taxPercent)}%</td><td class="right">${esc(money(inv.taxAmount))}</td></tr>
    <tr><td><strong>Total</strong></td><td class="right"><strong>${esc(money(inv.total))}</strong></td></tr>
  </table>
  <p class="muted">${esc(inv.breakdown)}</p>
  <p><strong>Payment</strong><br>${paid}</p>
  ${inv.notes ? `<p><strong>Notes</strong><br>${esc(inv.notes)}</p>` : ''}
  <p class="muted">This is a computer-generated invoice.</p>
</body></html>`;
}

export function printAdInvoice(inv: AdInvoice): void {
  const html = adInvoiceHtml(inv);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.srcdoc = html;
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  const cleanup = () => {
    window.setTimeout(() => frame.remove(), 800);
  };
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      cleanup();
    }
  };
  document.body.appendChild(frame);
}
