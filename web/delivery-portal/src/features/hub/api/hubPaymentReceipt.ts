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
  return `₹${Number(n || 0).toFixed(2)}`;
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

export function hubPaymentReceiptHtml(receipt: HubPaymentReceipt): string {
  const lineRows = receipt.lines
    .map(
      (l) => `
      <tr>
        <td>${escapeHtml(l.lineDescription)}</td>
        <td class="num">${moneyInr(l.amount)}</td>
        <td class="meta">${escapeHtml(l.lineType === 'FRANCHISE_FEE' && l.franchisePeriodStart && l.franchisePeriodEnd ? `${l.franchisePeriodStart} → ${l.franchisePeriodEnd}` : l.codRemittanceId ? `Remittance ${l.codRemittanceId}` : '—')}</td>
      </tr>`,
    )
    .join('');

  const hubNote = receipt.hubNotes?.trim()
    ? `<p><strong>Hub note:</strong> ${escapeHtml(receipt.hubNotes.trim())}</p>`
    : '';
  const adminNote = receipt.adminNotes?.trim()
    ? `<p><strong>KoyaKart note:</strong> ${escapeHtml(receipt.adminNotes.trim())}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(receipt.receiptNumber)} · KoyaKart</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui,Segoe UI,sans-serif; color: #111; margin: 0; padding: 24px; font-size: 13px; line-height: 1.45; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .sub { color: #555; margin: 0 0 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 20px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #666; font-weight: 700; }
    .val { font-weight: 600; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; vertical-align: top; }
    th { font-size: 11px; text-transform: uppercase; color: #666; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    td.meta { font-size: 11px; color: #555; font-family: ui-monospace,monospace; word-break: break-all; }
    .total { font-size: 18px; font-weight: 800; text-align: right; margin-top: 8px; }
    .ok { color: #15803d; font-size: 11px; font-weight: 700; }
    .foot { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #666; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(receipt.documentTitle)}</h1>
  <p class="sub">Receipt <strong>${escapeHtml(receipt.receiptNumber)}</strong> · ${escapeHtml(receipt.statusLabel)}</p>
  <div class="grid">
    <div><div class="label">Hub</div><div class="val">${escapeHtml(receipt.hubName)}</div></div>
    <div><div class="label">Bank / UTR reference</div><div class="val">${escapeHtml(receipt.paymentReference)}</div></div>
    <div><div class="label">Payment date (IST)</div><div class="val">${escapeHtml(formatPayDate(receipt.paymentDate))}</div></div>
    <div><div class="label">Confirmed by KoyaKart</div><div class="val">${escapeHtml(formatIst(receipt.verifiedAt))}</div></div>
    <div><div class="label">Submitted</div><div class="val">${escapeHtml(formatIst(receipt.submittedAt))}</div></div>
    <div><div class="label">Submission ID</div><div class="val" style="font-family:ui-monospace,monospace;font-size:11px;">${escapeHtml(receipt.submissionId)}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="num">Amount (INR)</th>
        <th>Ledger reference</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows}
    </tbody>
  </table>
  <div class="total">Total ${moneyInr(receipt.totalAmount)}</div>
  ${receipt.amountsConsistent ? '<p class="ok">Line items sum matches total (verified from KoyaKart records).</p>' : '<p style="color:#b45309;font-weight:700;">Line total does not match header total — contact KoyaKart support.</p>'}
  ${hubNote}
  ${adminNote}
  <div class="foot">
    Generated ${escapeHtml(formatIst(receipt.generatedAt))} (IST) · KoyaKart platform · This receipt reflects amounts recorded at confirmation.
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
