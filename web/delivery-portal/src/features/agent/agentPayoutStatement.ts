export type AgentPayoutStatement = {
  settlementId: string;
  agentName: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  orderCount: number;
  netAmount: number;
  payoutMethod?: string | null;
  transactionReference?: string | null;
  paidAt?: string | null;
  status: string;
};

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function day(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function agentPayoutStatementHtml(row: AgentPayoutStatement): string {
  const number = `KK-AGT-${row.settlementId.slice(0, 8).toUpperCase()}`;
  const paid = money(row.netAmount);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(number)}</title>
<style>
  body { font-family: Segoe UI, sans-serif; color: #0f172a; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .muted { color: #64748b; font-size: 12px; line-height: 1.45; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th, td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 6px 8px; }
  th { font-size: 11px; text-transform: uppercase; color: #64748b; }
  .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
  .total td { font-size: 15px; font-weight: 800; }
</style></head><body>
  <div class="muted">KoyaKart payout statement</div>
  <h1>${esc(number)}</h1>
  <div>To ${esc(row.agentName || 'Delivery agent')}</div>
  <div class="muted">Period ${esc(day(row.periodStart))} to ${esc(day(row.periodEnd))} · ${row.orderCount} order${row.orderCount === 1 ? '' : 's'}</div>
  <div class="muted">Paid ${esc(day(row.paidAt))} · ${esc(row.payoutMethod || '—')} · Ref ${esc(row.transactionReference || '—')} · ${esc(row.status)}</div>
  <table>
    <thead><tr><th>What</th><th class="num">Amount</th></tr></thead>
    <tbody>
      <tr class="total"><td>Paid to you</td><td class="num">${esc(paid)}</td></tr>
    </tbody>
  </table>
  <p class="muted">Payout record for the delivery agent. GST does not apply to this amount. GST on delivery is charged on the customer’s bill and paid by KoyaKart.</p>
</body></html>`;
}

export function downloadAgentPayoutStatement(row: AgentPayoutStatement): void {
  const html = agentPayoutStatementHtml(row);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `KoyaKart-agent-payout-${row.settlementId.slice(0, 8)}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
