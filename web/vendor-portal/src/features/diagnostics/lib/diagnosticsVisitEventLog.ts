import type { DiagnosticsVendorOrder } from '../api/diagnosticsApi';

const EVENT_LABEL: Record<string, string> = {
  PLACED: 'Order placed',
  PAY: 'Payment received',
  PAYMENT_START_FAILED: 'Payment failed',
  START_COLLECTION: 'Visit started',
  REACH_PATIENT: 'Reached patient',
  CONFIRM_PATIENT: 'Patient confirmed',
  SAMPLE_PHOTO: 'Sample photo',
  REMOVE_SAMPLE_PHOTO: 'Photo removed',
  SAMPLES_COLLECTED: 'Samples collected',
  RECEIVED_AT_LAB: 'Handed over to lab',
  MARK_COD_RECEIVED: 'COD received',
  ASSIGN: 'Collection agent assigned',
  SET_REPORT_ETA: 'Report ETA set',
  UPDATE_RESULTS: 'Results updated',
  FINALIZE: 'Report finalized',
  CONFIRM_SAMPLES_RECEIVED: 'Samples confirmed at bench',
  ADD_REPORT_ATTACHMENT: 'Report file uploaded',
  REMOVE_REPORT_ATTACHMENT: 'Report file removed',
  COMPLETE: 'Visit completed',
  ADD_SAMPLE_PHOTO: 'Sample photo',
};

export type VisitLogPhase = 'book' | 'field' | 'lab' | 'report';

export function parseHandoffNameFromNote(note: string | null | undefined): string | null {
  if (!note?.trim()) return null;
  const m = /^Handed to\s+(.+?)(?:\s+\([^)]+\))?(?:\s+at\s+|$)/i.exec(note.trim());
  if (m) return m[1].trim();
  const loose = /^Handed to\s+(.+)/i.exec(note.trim());
  if (!loose) return null;
  return loose[1].replace(/\s+at\s+.+$/i, '').trim() || null;
}

function isPhotoUploadEvent(type: string): boolean {
  return type === 'SAMPLE_PHOTO' || type === 'ADD_SAMPLE_PHOTO';
}

/** Visit timeline: keep the first sample-photo upload only (later photos stay as thumbs). */
export function timelineEvents(
  events: DiagnosticsVendorOrder['events'],
): NonNullable<DiagnosticsVendorOrder['events']> {
  const out: NonNullable<DiagnosticsVendorOrder['events']> = [];
  let sawPhoto = false;
  for (const ev of events ?? []) {
    const type = String(ev.eventType ?? '').toUpperCase();
    if (isPhotoUploadEvent(type)) {
      if (sawPhoto) continue;
      sawPhoto = true;
    }
    out.push(ev);
  }
  return out;
}

export function visitEventPhase(eventType: string): VisitLogPhase {
  const type = eventType.toUpperCase();
  if (type === 'PLACED' || type === 'PAY' || type === 'PAYMENT_START_FAILED' || type === 'ASSIGN') {
    return 'book';
  }
  if (
    type === 'START_COLLECTION' ||
    type === 'REACH_PATIENT' ||
    type === 'CONFIRM_PATIENT' ||
    type === 'SAMPLE_PHOTO' ||
    type === 'ADD_SAMPLE_PHOTO' ||
    type === 'REMOVE_SAMPLE_PHOTO' ||
    type === 'SAMPLES_COLLECTED' ||
    type === 'MARK_COD_RECEIVED'
  ) {
    return 'field';
  }
  if (type === 'RECEIVED_AT_LAB') return 'lab';
  return 'report';
}

export const VISIT_LOG_PHASE_LABEL: Record<VisitLogPhase, string> = {
  book: 'Booking',
  field: 'Home visit',
  lab: 'Lab hand-off',
  report: 'Report',
};

export function eventDisplayLabel(
  ev: { eventType?: string; note?: string | null },
  orderHandoffName: string | null,
): string {
  const type = String(ev.eventType ?? '').toUpperCase();
  if (type === 'RECEIVED_AT_LAB') {
    const who = parseHandoffNameFromNote(ev.note) || orderHandoffName;
    return who ? `Handed over to ${who}` : 'Handed over to lab';
  }
  return (
    EVENT_LABEL[type] ??
    type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function formatVisitEventWhen(iso: string | null | undefined, compact?: boolean): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', compact
    ? { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }
    : {
        day: '2-digit',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      });
}
