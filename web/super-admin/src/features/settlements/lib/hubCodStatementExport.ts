import { formatIsoDateRange } from '@hlm-dates/formatDateRange';

export type CodStatementLine = {
  orderId: string;
  orderNumber?: string | null;
  closeDate?: string | null;
  amount: number;
};

function escCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function money2(n: number): string {
  return Number(n || 0).toFixed(2);
}

/** Sum line amounts in paise-safe way (INR, 2 decimals). */
export function sumCodLineAmounts(lines: CodStatementLine[]): number {
  const paise = lines.reduce((s, l) => s + Math.round(Number(l.amount || 0) * 100), 0);
  return paise / 100;
}

export function buildHubCodStatementCsv(input: {
  hubId: string;
  periodStart: string;
  periodEnd: string;
  documentRef?: string;
  totalAmount: number;
  hubBalanceOwed?: number;
  lines: CodStatementLine[];
}): string {
  const lines = [...input.lines].sort((a, b) => {
    const d = (a.closeDate ?? '').localeCompare(b.closeDate ?? '');
    if (d !== 0) return d;
    return (a.orderNumber ?? '').localeCompare(b.orderNumber ?? '');
  });
  const lineSum = sumCodLineAmounts(lines);
  const rows: string[] = [];
  rows.push('KoyaKart Hub COD Statement');
  rows.push(`Hub ID,${escCsv(input.hubId)}`);
  rows.push(`Period (IST),${escCsv(formatIsoDateRange(input.periodStart, input.periodEnd))}`);
  rows.push(`Period start (IST),${escCsv(input.periodStart)}`);
  rows.push(`Period end (IST),${escCsv(input.periodEnd)}`);
  if (input.documentRef) rows.push(`Document ref,${escCsv(input.documentRef)}`);
  rows.push(`Order count,${lines.length}`);
  rows.push(`Line total INR,${money2(lineSum)}`);
  rows.push(`Statement total INR,${money2(input.totalAmount)}`);
  if (input.hubBalanceOwed != null) {
    rows.push(`Hub COD balance owed INR,${money2(input.hubBalanceOwed)}`);
  }
  rows.push('');
  rows.push(['Order number', 'Order ID', 'Close date (IST)', 'Amount INR'].map(escCsv).join(','));
  for (const l of lines) {
    rows.push(
      [
        escCsv(l.orderNumber?.trim() || '—'),
        escCsv(l.orderId),
        escCsv(l.closeDate ?? ''),
        money2(l.amount),
      ].join(','),
    );
  }
  rows.push('');
  rows.push([escCsv('TOTAL'), '', '', money2(lineSum)].join(','));
  return `\uFEFF${rows.join('\r\n')}`;
}

export function downloadHubCodStatementCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
