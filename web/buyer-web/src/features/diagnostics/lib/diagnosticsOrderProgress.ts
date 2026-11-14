import type { DiagnosticsOrder } from '../api/diagnosticsApi';

export type DiagnosticsTimelineStep = {
  label: string;
  done: boolean;
  current: boolean;
  at?: string | null;
};

const FLOW: Array<{ status: string; label: string }> = [
  { status: 'BOOKED', label: 'Booked' },
  { status: 'ASSIGNED', label: 'Collector assigned' },
  { status: 'COLLECTION_IN_PROGRESS', label: 'On the way' },
  { status: 'REACHED_PATIENT', label: 'Collector arrived' },
  { status: 'PATIENT_CONFIRMED', label: 'Collecting samples' },
  { status: 'SAMPLES_COLLECTED', label: 'Samples collected' },
  { status: 'RECEIVED_AT_LAB', label: 'At lab' },
  { status: 'REPORT_ETA_SET', label: 'Report ETA set' },
  { status: 'REPORT_IN_PROGRESS', label: 'Report in progress' },
  { status: 'REPORT_FINALIZED', label: 'Report ready' },
  { status: 'COMPLETED', label: 'Completed' },
];

function indexOfStatus(status: string): number {
  const upper = status.toUpperCase();
  const idx = FLOW.findIndex((row) => row.status === upper);
  if (idx >= 0) return idx;
  if (upper === 'CANCELLED') return -1;
  return 0;
}

export function buildDiagnosticsBuyerTimeline(order: DiagnosticsOrder): DiagnosticsTimelineStep[] {
  const cur = indexOfStatus(order.status);
  if (cur < 0) {
    return [{ label: order.statusLabel || 'Cancelled', done: true, current: true, at: order.placedAt }];
  }
  const eventAt = new Map<string, string>();
  for (const ev of order.events ?? []) {
    if (ev.toStatus) eventAt.set(ev.toStatus.toUpperCase(), ev.createdAt);
  }
  return FLOW.map((row, i) => ({
    label: row.label,
    done: i < cur || order.status.toUpperCase() === 'COMPLETED',
    current: i === cur,
    at: eventAt.get(row.status) ?? (i === 0 ? order.placedAt : null),
  }));
}

export function diagnosticsReportReady(order: DiagnosticsOrder): boolean {
  const s = order.status.toUpperCase();
  return s === 'REPORT_FINALIZED' || s === 'COMPLETED' || Boolean(order.reportFinalizedAt);
}
