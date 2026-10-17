import type { SettlementVm } from './api/settlementsApi';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function when(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function day(iso?: string | null): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

function statementNumber(settlement: SettlementVm): string {
  return settlement.serviceInvoiceNumber?.trim() || `KK-HUB-${settlement.id.slice(0, 8).toUpperCase()}`;
}

export function payoutStatementFileName(number: string): string {
  const safe = number.replace(/[^\w.-]+/g, '-');
  return `KoyaKart-payout-statement-${safe}.html`;
}

/** Company copy of the hub payout statement. Same number, period, lines, amount, and reference as the hub download. */
export function downloadHubPayoutStatement(settlement: SettlementVm): void {
  const number = statementNumber(settlement);
  const hubName = settlement.payeeName?.trim() || 'Hub';
  const lines = settlement.lines ?? [];
  const total = Number(settlement.netAmount ?? 0);
  const rows = lines.length
    ? lines
        .map(
          (line) => `<tr>
        <td>${esc(line.orderNumber || '—')}</td>
        <td>${esc(line.description || 'Delivery payout')}</td>
        <td class="num">${esc(money(Number(line.amount ?? 0)))}</td>
      </tr>`,
        )
        .join('')
    : `<tr><td colspan="3">No order lines on this payout.</td></tr>`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(number)}</title>
<style>
  body { font-family: Segoe UI, sans-serif; color: #0f172a; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .muted { color: #64748b; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th, td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 6px 8px; }
  th { font-size: 11px; text-transform: uppercase; color: #64748b; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .total { margin-top: 12px; font-size: 16px; font-weight: 800; text-align: right; }
</style></head><body>
  <div class="muted">KoyaKart payout statement</div>
  <h1>${esc(number)}</h1>
  <div>Paid to ${esc(hubName)}</div>
  <div class="muted">Period ${esc(day(settlement.periodStart))} to ${esc(day(settlement.periodEnd))}</div>
  <div class="muted">Paid ${esc(when(settlement.paidAt))} · ${esc(settlement.payoutMethod || '—')} · Ref ${esc(settlement.transactionReference || '—')}</div>
  ${settlement.transactionNotes ? `<div class="muted">${esc(settlement.transactionNotes)}</div>` : ''}
  <table>
    <thead><tr><th>Order</th><th>What</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">KoyaKart paid ${esc(money(total))}</div>
  <p class="muted">Payout statement, not a tax invoice. Company copy of the statement the hub downloads for this bill number.</p>
</body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = payoutStatementFileName(number);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
