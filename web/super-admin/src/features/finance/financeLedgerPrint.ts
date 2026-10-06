import type { CompliancePack, FinanceLedgerEntry } from './api/financeLedgerApi';
import { resolveManagementSummary } from './financeManagementSummary';
import { displayCounterparty, displayEntityLabel } from '@/shared/display/displayNames';
import { resolveHubRows, resolveVendorRows, type FinancePartyRow } from './financePartyTotals';

function esc(s: string | number | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n?: number | null): string {
  return `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MAX_TX_ROWS = 400;

function txRows(entries: FinanceLedgerEntry[]): string {
  const slice = entries.slice(0, MAX_TX_ROWS);
  if (slice.length === 0) {
    return '<tr><td colspan="6">No transactions</td></tr>';
  }
  return slice
    .map(
      (e) => `<tr>
        <td>${esc(e.bookDate)}</td>
        <td>${esc(e.direction)}</td>
        <td>${esc(e.categoryLabel)}</td>
        <td class="right">${esc(money(e.amount))}</td>
        <td>${esc(displayCounterparty(e.counterpartyName, e.counterpartyRole, e.counterpartyId))}</td>
        <td>${esc(e.transactionReference ?? '')}</td>
      </tr>`,
    )
    .join('');
}

function hubRowsHtml(rows: FinancePartyRow[]): string {
  if (rows.length === 0) return '<tr><td colspan="7">No hub cash movements in range</td></tr>';
  return rows
    .map(
      (h) => `<tr>
        <td>${esc(displayEntityLabel(h.partyName, 'Delivery hub', h.partyId))}</td>
        <td class="right">${esc(money(h.inflows))}</td>
        <td class="right">${esc(money(h.outflows))}</td>
        <td class="right">${esc(money(h.codRemittances))}</td>
        <td class="right">${esc(money(h.franchiseFees))}</td>
        <td class="right">${esc(money(h.otherInflows))}</td>
        <td class="right">${esc(money(h.payouts))}</td>
      </tr>`,
    )
    .join('');
}

function vendorRowsHtml(rows: FinancePartyRow[]): string {
  if (rows.length === 0) return '<tr><td colspan="5">No vendor payouts in range</td></tr>';
  return rows
    .map(
      (v) => `<tr>
        <td>${esc(displayEntityLabel(v.partyName, 'Vendor', v.partyId))}</td>
        <td class="right">${esc(money(v.outflows))}</td>
        <td class="right">${esc(money(v.grossSales))}</td>
        <td class="right">${esc(money(v.commission))}</td>
        <td class="right">${esc(money(v.tdsEstimated))}</td>
      </tr>`,
    )
    .join('');
}

export function financeCompliancePrintHtml(
  pack: CompliancePack,
  townLabel: string,
  cashEntries: FinanceLedgerEntry[],
): string {
  const r = pack.cashLedger;
  const a = pack.accrual;
  const g = pack.gst;
  const t = pack.tds;
  const gw = pack.gateway;
  const m = resolveManagementSummary(pack);
  const hubs = resolveHubRows(r);
  const vendors = resolveVendorRows(r, t.lines);
  const truncatedNote = r.truncated
    ? `<p class="warn">Cash transactions list capped at ${MAX_TX_ROWS} rows in PDF; use CSV for full export.</p>`
    : cashEntries.length > MAX_TX_ROWS
      ? `<p class="warn">Showing first ${MAX_TX_ROWS} of ${cashEntries.length} filtered transactions.</p>`
      : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>KoyaKart Finance Report</title>
<style>
  body { font-family: system-ui, Segoe UI, sans-serif; font-size: 11px; color: #111; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 13px; margin: 18px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .muted { color: #555; font-size: 10px; }
  .warn { color: #a60; font-weight: 600; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
  .card { border: 1px solid #ddd; border-radius: 6px; padding: 8px; }
  .card strong { display: block; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; font-size: 10px; }
  .right { text-align: right; }
  @media print { body { margin: 12px; } }
</style></head><body>
  <h1>KoyaKart — Finance &amp; compliance report</h1>
  <p class="muted">${esc(townLabel)} · Period ${esc(pack.from)} → ${esc(pack.to)} (IST) · Generated ${esc(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))}</p>
  <p class="muted">${esc(r.complianceNote ?? '')}</p>

  <h2>1. Cash movement summary</h2>
  <div class="grid">
    <div class="card"><strong>${esc(money(r.totalInflows))}</strong>Total received (IN)</div>
    <div class="card"><strong>${esc(money(r.totalOutflows))}</strong>Total paid out (OUT)</div>
    <div class="card"><strong>${esc(money(r.netCashMovement))}</strong>Net cash movement</div>
    <div class="card"><strong>${esc(money(r.platformReceipts))}</strong>Platform revenue (IN)</div>
    <div class="card"><strong>${esc(money(r.passThroughInflows))}</strong>Pass-through IN</div>
    <div class="card"><strong>${esc(money(r.passThroughOutflows))}</strong>Pass-through OUT</div>
    <div class="card"><strong>${esc(money(r.walletGranted))}</strong>Wallet gifted (scratch / referral / store credit)</div>
    <div class="card"><strong>${esc(money(r.walletScratch))}</strong>Scratch gifts</div>
    <div class="card"><strong>${esc(money(r.walletReferral))}</strong>Referral gifts</div>
    <div class="card"><strong>${esc(money(r.walletStoreCredit))}</strong>Store credit</div>
    <div class="card"><strong>${esc(money(r.walletRedeemed))}</strong>Wallet used on orders</div>
  </div>

  <h2>2. Cash transactions</h2>
  ${truncatedNote}
  <table>
    <thead><tr><th>Date</th><th>In/Out</th><th>Category</th><th class="right">Amount</th><th>Counterparty</th><th>Reference</th></tr></thead>
    <tbody>${txRows(cashEntries)}</tbody>
  </table>

  ${
    m
      ? `<h2>3. P&amp;L summary (management)</h2>
  <p class="muted">${esc(m.note)}</p>
  <div class="grid">
    <div class="card"><strong>${esc(m.platformResultIndicator)}</strong>Platform result (pre-opex)</div>
    <div class="card"><strong>${esc(money(m.netSurplusBeforeOperatingExpenses))}</strong>Net surplus</div>
    <div class="card"><strong>${esc(money(m.estimatedPlatformRevenue))}</strong>Est. platform revenue</div>
    <div class="card"><strong>${esc(money(m.buyerRefunds))}</strong>Buyer refunds</div>
    <div class="card"><strong>${esc(money(m.paymentGatewayFees))}</strong>Gateway fees</div>
    <div class="card"><strong>${esc(money(m.passThroughFloat))}</strong>Pass-through float</div>
    <div class="card"><strong>${esc(money(m.walletGranted))}</strong>Wallet gifts</div>
    <div class="card"><strong>${esc(money(m.walletScratch))}</strong>Scratch</div>
    <div class="card"><strong>${esc(money(m.walletReferral))}</strong>Referrals</div>
    <div class="card"><strong>${esc(money(m.walletStoreCredit))}</strong>Store credit</div>
  </div>`
      : ''
  }

  <h2>${m ? '4' : '3'}. Revenue accrual (delivered orders)</h2>
  <div class="grid">
    <div class="card"><strong>${esc(a.ordersDelivered)}</strong>Orders delivered</div>
    <div class="card"><strong>${esc(money(a.deliveredOrderValue))}</strong>Delivered GMV</div>
    <div class="card"><strong>${esc(money(a.totalEstimatedPlatformRevenue))}</strong>Est. platform revenue</div>
    <div class="card"><strong>${esc(money(a.platformFeesOnDelivered))}</strong>Platform fees</div>
    <div class="card"><strong>${esc(money(a.vendorCommissionEarned))}</strong>Vendor commission</div>
    <div class="card"><strong>${esc(money(a.membershipRevenue))}</strong>Membership</div>
  </div>
  <table>
    <thead><tr><th>Date</th><th class="right">Delivered</th><th class="right">Platform fees</th><th class="right">GMV</th><th class="right">GST</th></tr></thead>
    <tbody>
      ${a.daily
        .map(
          (d) => `<tr>
        <td>${esc(d.date)}</td>
        <td class="right">${d.ordersDelivered}</td>
        <td class="right">${esc(money(d.platformFees))}</td>
        <td class="right">${esc(money(d.deliveredGmv))}</td>
        <td class="right">${esc(money(d.gstTotal))}</td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>

  <h2>${m ? '5' : '4'}. GST (delivered line items)</h2>
  <p class="muted">${esc(g.note)}</p>
  <div class="grid">
    <div class="card"><strong>${esc(money(g.cgstOnDeliveredItems))}</strong>CGST</div>
    <div class="card"><strong>${esc(money(g.sgstOnDeliveredItems))}</strong>SGST</div>
    <div class="card"><strong>${esc(money(g.igstOnDeliveredItems))}</strong>IGST</div>
    <div class="card"><strong>${esc(money(g.totalGstOnDeliveredItems))}</strong>Total GST</div>
  </div>

  <h2>${m ? '6' : '5'}. TDS — vendor settlements (${esc(t.ratePercent)}% estimated)</h2>
  <p class="muted">${esc(t.legalNote)}</p>
  <div class="grid">
    <div class="card"><strong>${esc(money(t.totalGrossSalesFacilitated))}</strong>Gross facilitated</div>
    <div class="card"><strong>${esc(money(t.totalTdsEstimated))}</strong>Est. TDS</div>
    <div class="card"><strong>${esc(money(t.totalPlatformCommission))}</strong>Platform commission</div>
  </div>
  <table>
    <thead><tr><th>Paid date</th><th>Vendor</th><th class="right">Gross</th><th class="right">Commission</th><th class="right">Net</th><th class="right">TDS est.</th></tr></thead>
    <tbody>
      ${t.lines.length === 0 ? '<tr><td colspan="6">No paid vendor settlements in range</td></tr>' : t.lines
        .map(
          (l) => `<tr>
        <td>${esc(l.paidDate ?? '')}</td>
        <td>${esc(l.vendorName ?? l.vendorId)}</td>
        <td class="right">${esc(money(l.grossSales))}</td>
        <td class="right">${esc(money(l.platformCommission))}</td>
        <td class="right">${esc(money(l.netPaid))}</td>
        <td class="right">${esc(money(l.tdsEstimated))}</td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>

  <h2>${m ? '7' : '6'}. Online gateway reconciliation</h2>
  <p class="muted">${esc(gw.note)}</p>
  <div class="grid">
    <div class="card"><strong>${esc(money(gw.appOnlineCollections))}</strong>App collected</div>
    <div class="card"><strong>${esc(money(gw.appOnlineRefunds))}</strong>Refunds</div>
    <div class="card"><strong>${esc(money(gw.importedSettlementNet))}</strong>Bank settled (imported)</div>
    <div class="card"><strong>${esc(money(gw.varianceAppNetVsBankNet))}</strong>Variance</div>
  </div>

  <h2>Hub-wise cash</h2>
  <table>
    <thead><tr><th>Hub</th><th class="right">Received</th><th class="right">Paid out</th><th class="right">COD remitted</th><th class="right">Franchise</th><th class="right">Other IN</th><th class="right">Delivery payout</th></tr></thead>
    <tbody>${hubRowsHtml(hubs)}</tbody>
  </table>

  <h2>Vendor-wise cash</h2>
  <table>
    <thead><tr><th>Vendor</th><th class="right">Paid out</th><th class="right">Gross</th><th class="right">Commission</th><th class="right">Est. TDS</th></tr></thead>
    <tbody>${vendorRowsHtml(vendors)}</tbody>
  </table>

  <p class="muted" style="margin-top:24px">Reconcile with bank statements and Razorpay settlement reports before statutory filing. Computer-generated from KoyaKart payment &amp; order records.</p>
</body></html>`;
}

export function printFinanceCompliancePdf(
  pack: CompliancePack,
  townLabel: string,
  cashEntries: FinanceLedgerEntry[],
): void {
  const html = financeCompliancePrintHtml(pack, townLabel, cashEntries);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.srcdoc = html;
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  const cleanup = () => window.setTimeout(() => frame.remove(), 800);
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      cleanup();
    }
  };
  document.body.appendChild(frame);
}
