import { apiRequest } from '@/shared/api/http';

export type HubPaymentReceipt = {
  receiptNumber: string;
  submissionId: string;
  townId: string;
  hubId: string;
  hubName: string;
  status: string;
  statusLabel: string;
  documentTitle: string;
  paymentDate: string;
  totalAmount: number;
  linesTotal: number;
  amountsConsistent: boolean;
  paymentReference: string;
  hubNotes?: string | null;
  adminNotes?: string | null;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  generatedAt?: string | null;
  lines: Array<{
    lineId: string;
    lineType: string;
    lineDescription: string;
    amount: number;
    franchisePeriodStart?: string | null;
    franchisePeriodEnd?: string | null;
    franchiseLabel?: string | null;
    codRemittanceId?: string | null;
    franchiseSettlementId?: string | null;
  }>;
};

export async function fetchHubPaymentReceipt(token: string, submissionId: string): Promise<HubPaymentReceipt> {
  return apiRequest<HubPaymentReceipt>(`/api/v1/payments/hub/me/payment-submissions/${submissionId}/receipt`, {
    token,
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function moneyInr(n: number): string {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatIst(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPayDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
}

function dayLabel(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function lineLabel(line: HubPaymentReceipt['lines'][number]): string {
  if (line.lineType === 'COD_REMITTANCE') return 'COD remittance';
  const start = dayLabel(line.franchisePeriodStart);
  const end = dayLabel(line.franchisePeriodEnd);
  if (start && end) return `Franchise · ${start} – ${end}`;
  return 'Franchise fee';
}

/** Drop the auto-built amount list. Keep only what the hub typed, such as how they paid. */
function payerNote(receipt: HubPaymentReceipt): string {
  const raw = receipt.hubNotes?.trim() ?? '';
  if (!raw) return '';
  const ref = receipt.paymentReference.trim();
  let text = raw
    .replace(/COD remittance\s*·\s*₹[\d,.]+/gi, '')
    .replace(/Franchise\s*·\s*₹[\d,.]+/gi, '')
    .replace(/Franchise monthly[\s\S]*?₹[\d,.]+/gi, '')
    .replace(ref ? new RegExp(`\\bref\\s+${ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') : /$^/, '');
  text = text.replace(/[·|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text;
}

export function hubPaymentReceiptHtml(receipt: HubPaymentReceipt): string {
  const lineRows = receipt.lines
    .map(
      (line) => `<tr>
        <td>${escapeHtml(lineLabel(line))}</td>
        <td class="num">${moneyInr(line.amount)}</td>
      </tr>`,
    )
    .join('');
  const note = payerNote(receipt);
  const adminNote = receipt.adminNotes?.trim() ?? '';
  const mismatch = receipt.amountsConsistent
    ? ''
    : `<p class="warn">Line total ${moneyInr(receipt.linesTotal)} does not match ${moneyInr(receipt.totalAmount)}.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(receipt.receiptNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { background: #fff; color: #0f172a; color-scheme: light; }
    body { font-family: Segoe UI, system-ui, sans-serif; margin: 0; padding: 28px; font-size: 13px; }
    .sheet { max-width: 640px; border-top: 4px solid #0C831F; }
    .brand { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.04em; color: #0C831F; text-transform: uppercase; }
    h1 { margin: 2px 0 0; font-size: 20px; }
    .status { margin: 4px 0 16px; color: #64748b; font-size: 12px; }
    .facts { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; margin: 0 0 16px; }
    .facts dt { margin: 0; color: #64748b; font-size: 12px; }
    .facts dd { margin: 0; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 7px 0; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #64748b; font-weight: 700; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .total td { border-bottom: none; font-weight: 800; font-size: 15px; padding-top: 10px; }
    .note { margin: 12px 0 0; color: #334155; font-size: 12px; }
    .warn { margin: 12px 0 0; color: #b45309; font-weight: 700; font-size: 12px; }
    .foot { margin-top: 18px; color: #94a3b8; font-size: 11px; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <div class="sheet">
    <p class="brand">KoyaKart</p>
    <h1>Payment receipt</h1>
    <p class="status">${escapeHtml(receipt.receiptNumber)} · ${escapeHtml(receipt.statusLabel)}</p>
    <dl class="facts">
      <dt>From</dt><dd>${escapeHtml(receipt.hubName)}</dd>
      <dt>Paid</dt><dd>${escapeHtml(formatPayDate(receipt.paymentDate))}</dd>
      <dt>UTR</dt><dd>${escapeHtml(receipt.paymentReference || '—')}</dd>
      <dt>Confirmed</dt><dd>${escapeHtml(formatIst(receipt.verifiedAt))}</dd>
    </dl>
    <table>
      <thead><tr><th>What</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${lineRows}
        <tr class="total"><td>Total</td><td class="num">${moneyInr(receipt.totalAmount)}</td></tr>
      </tbody>
    </table>
    ${note ? `<p class="note">${escapeHtml(note)}</p>` : ''}
    ${adminNote ? `<p class="note">KoyaKart: ${escapeHtml(adminNote)}</p>` : ''}
    ${mismatch}
    <p class="foot">Hub paid KoyaKart · ${escapeHtml(formatIst(receipt.generatedAt))} IST</p>
  </div>
</body>
</html>`;
}

export function downloadHubPaymentReceiptHtml(receipt: HubPaymentReceipt): void {
  const html = hubPaymentReceiptHtml(receipt);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const safeRef = receipt.paymentReference.replace(/[^\w-]+/g, '_').slice(0, 40);
  const filename = `${receipt.receiptNumber}_${safeRef}.html`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
