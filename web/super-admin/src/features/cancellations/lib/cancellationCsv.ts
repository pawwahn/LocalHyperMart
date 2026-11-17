import type { AdminCancellationRow } from '../api/cancellationsApi';
import { initiatorLabel, verticalLabel } from '../api/cancellationsApi';

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToLine(r: AdminCancellationRow): string {
  const cells = [
    r.kind,
    verticalLabel(r.vertical),
    r.occurredAt ?? '',
    r.orderNumber,
    r.orderStatus,
    r.buyerPhone ?? r.buyerId,
    r.counterpartyName ?? '',
    initiatorLabel(r.initiatedBy),
    r.summary ?? '',
    r.reason ?? '',
    String(r.cancelledAmount ?? 0),
    String(r.amountCollected ?? 0),
    (r.actionHints ?? []).join(' | '),
  ];
  return cells.map((c) => csvEscape(String(c))).join(',');
}

export function cancellationsToCsv(rows: AdminCancellationRow[]): string {
  const header = [
    'kind',
    'service',
    'occurredAt',
    'orderNumber',
    'orderStatus',
    'buyer',
    'counterparty',
    'initiatedBy',
    'summary',
    'reason',
    'lostAmount',
    'amountCollected',
    'actionHints',
  ].join(',');
  return [header, ...rows.map(rowToLine)].join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}