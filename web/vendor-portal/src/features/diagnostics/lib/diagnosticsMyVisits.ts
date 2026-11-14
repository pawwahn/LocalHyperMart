import { isVendorVisibleDiagnosticsBooking, type DiagnosticsVendorOrder } from '../api/diagnosticsApi';

export type MyVisitsPane = 'collect' | 'handed' | 'history';

/** Report shared with patient (finalized or completed). */
export function isDiagnosticsVisitHistory(status: string | null | undefined): boolean {
  const s = String(status ?? '').toUpperCase();
  return s === 'REPORT_FINALIZED' || s === 'COMPLETED';
}

/** Bag at lab; report still in progress — not yet shared with patient. */
export function isDiagnosticsVisitHandedOver(status: string | null | undefined): boolean {
  const s = String(status ?? '').toUpperCase();
  if (isDiagnosticsVisitHistory(s)) return false;
  return s === 'RECEIVED_AT_LAB' || s === 'REPORT_ETA_SET' || s === 'REPORT_IN_PROGRESS';
}

export function isDiagnosticsVisitYetToCollect(status: string | null | undefined): boolean {
  const s = String(status ?? '').toUpperCase();
  if (!s || /CANCEL/i.test(s)) return false;
  if (isDiagnosticsVisitHistory(s) || isDiagnosticsVisitHandedOver(s)) return false;
  return /^(ASSIGNED|COLLECTION_IN_PROGRESS|REACHED_PATIENT|PATIENT_CONFIRMED|SAMPLES_COLLECTED|BOOKED|AWAITING_PAYMENT)/.test(s);
}

export function filterOrdersAssignedToStaff(
  orders: DiagnosticsVendorOrder[],
  staffId: string | null | undefined,
): DiagnosticsVendorOrder[] {
  if (!staffId) return [];
  return orders.filter(
    (o) =>
      isVendorVisibleDiagnosticsBooking(o)
      && o.assignedStaffId
      && o.assignedStaffId === staffId,
  );
}

export function splitMyVisitOrders(orders: DiagnosticsVendorOrder[]): {
  toCollect: DiagnosticsVendorOrder[];
  handedOver: DiagnosticsVendorOrder[];
  history: DiagnosticsVendorOrder[];
} {
  const toCollect: DiagnosticsVendorOrder[] = [];
  const handedOver: DiagnosticsVendorOrder[] = [];
  const history: DiagnosticsVendorOrder[] = [];
  for (const order of orders) {
    if (/CANCEL/i.test(order.status)) continue;
    if (isDiagnosticsVisitHistory(order.status)) {
      history.push(order);
    } else if (isDiagnosticsVisitHandedOver(order.status)) {
      handedOver.push(order);
    } else if (isDiagnosticsVisitYetToCollect(order.status)) {
      toCollect.push(order);
    }
  }
  const byPlaced = (a: DiagnosticsVendorOrder, b: DiagnosticsVendorOrder) =>
    String(b.placedAt ?? '').localeCompare(String(a.placedAt ?? ''));
  toCollect.sort(byPlaced);
  handedOver.sort(byPlaced);
  history.sort(byPlaced);
  return { toCollect, handedOver, history };
}

/** Local calendar day (IST) when the report was shared / finalized. */
export function visitHistoryDayKey(order: DiagnosticsVendorOrder): string | null {
  const raw =
    order.reportFinalizedAt
    ?? (order.events ?? [])
        .slice()
        .reverse()
        .find((e) => String(e.eventType ?? '').toUpperCase() === 'FINALIZE')?.createdAt
    ?? order.slotStart;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return y && m && day ? `${y}-${m}-${day}` : null;
}

export function monthBounds(anchorYmd: string): { from: string; to: string } {
  const [y, m] = anchorYmd.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

export function shiftMonth(anchorYmd: string, delta: number): string {
  const [y, m] = anchorYmd.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
