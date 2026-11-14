import type { DiagnosticsOrder } from '../api/diagnosticsApi';

export type DiagnosticsReportAttachment = NonNullable<DiagnosticsOrder['reportAttachments']>[number];

/** Lab-uploaded final report file to show instead of the platform-generated PDF. */
export function primaryFinalReportAttachment(order: DiagnosticsOrder): DiagnosticsReportAttachment | null {
  const finals = (order.reportAttachments ?? []).filter((a) => String(a.kind).toUpperCase() === 'FINAL');
  if (finals.length === 0) return null;
  const pdf = finals.find((a) => String(a.contentType ?? '').toLowerCase().includes('pdf'));
  return pdf ?? finals[finals.length - 1];
}

export function isPdfReportAttachment(att: DiagnosticsReportAttachment): boolean {
  return String(att.contentType ?? '').toLowerCase().includes('pdf');
}
