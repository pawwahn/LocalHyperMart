import { orderCountLabel, type CompliancePack, type FinanceLedgerEntry } from './api/financeLedgerApi';
import {
  aggregatePartiesFromEntries,
  emptyPartyRow,
  partyEntries,
  resolveHubRows,
  resolveVendorRows,
  type FinancePartyRow,
} from './financePartyTotals';
import { displayEntityLabel } from '@/shared/display/displayNames';

export type AuditLine = {
  key: string;
  date: string;
  verified?: string | null;
  direction: 'IN' | 'OUT';
  who: string;
  what: string;
  cashIn: number;
  cashOut: number;
  balance: number;
  gross: number | null;
  commission: number | null;
  tds: number | null;
  reference?: string | null;
  period?: string | null;
  detail?: string | null;
  townId?: string | null;
};

export type AuditParty = {
  id: string;
  name: string;
  kind: 'hub' | 'vendor';
  inflows: number;
  outflows: number;
  net: number;
  cod: number;
  franchise: number;
  otherIn: number;
  payouts: number;
  gross: number;
  commission: number;
  tds: number;
  txnCount: number;
  lines: AuditLine[];
};

export type PartyAuditReport = {
  from: string;
  to: string;
  truncated: boolean;
  hubs: AuditParty[];
  vendors: AuditParty[];
  agents: AuditParty[];
};

const GENERIC = new Set([
  'delivery hub',
  'vendor',
  'delivery agent',
  'buyer',
  'buyer wallet',
  'payee',
  'counterparty',
]);

function n(value?: number | null): number {
  return Number(value ?? 0);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function specificName(name?: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed || GENERIC.has(trimmed.toLowerCase())) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return null;
  return trimmed;
}

function sortKey(date: string, id: string): string {
  return `${date}|${id}`;
}

function withBalances(lines: AuditLine[]): AuditLine[] {
  const ordered = [...lines].sort((a, b) => sortKey(a.date, a.key).localeCompare(sortKey(b.date, b.key)));
  let balance = 0;
  return ordered.map((line) => {
    balance = round2(balance + line.cashIn - line.cashOut);
    return { ...line, balance };
  });
}

function nameIndex(pack: CompliancePack): Map<string, string> {
  const map = new Map<string, string>();
  const remember = (id?: string | null, name?: string | null) => {
    const specific = specificName(name);
    if (id && specific && !map.has(id)) map.set(id, specific);
  };
  for (const row of [...(pack.cashLedger.hubCashTotals ?? []), ...(pack.cashLedger.vendorCashTotals ?? [])]) {
    remember(row.partyId, row.partyName);
  }
  for (const entry of pack.cashLedger.entries) remember(entry.counterpartyId, entry.counterpartyName);
  for (const line of pack.payoutRegister?.lines ?? []) remember(line.payeeId, line.payeeName);
  for (const line of pack.tds.lines) remember(line.vendorId, line.vendorName);
  return map;
}

export function mergePartyDirectory(
  report: PartyAuditReport,
  directory: { hubs: NamedParty[]; vendors: NamedParty[]; agents: NamedParty[] },
): PartyAuditReport {
  return {
    ...report,
    hubs: mergeNamed(report.hubs, directory.hubs, 'hub'),
    vendors: mergeNamed(report.vendors, directory.vendors, 'vendor'),
    agents: mergeNamed(report.agents, directory.agents, 'agent'),
  };
}

function mergeNamed(existing: AuditParty[], extras: NamedParty[], kind: AuditParty['kind']): AuditParty[] {
  const map = new Map(existing.map((party) => [party.id, party]));
  for (const extra of extras) {
    const name = extra.name.trim();
    if (!extra.id || !name) continue;
    const current = map.get(extra.id);
    if (!current) {
      map.set(extra.id, blankParty(extra.id, name, kind));
      continue;
    }
    if (specificName(name) && !specificName(current.name)) map.set(extra.id, { ...current, name });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function blankParty(id: string, name: string, kind: AuditParty['kind']): AuditParty {
  return {
    id,
    name,
    kind,
    inflows: 0,
    outflows: 0,
    net: 0,
    cod: 0,
    franchise: 0,
    otherIn: 0,
    payouts: 0,
    gross: 0,
    commission: 0,
    tds: 0,
    txnCount: 0,
    lines: [],
  };
}

export type NamedParty = { id: string; name: string };

function partyName(row: FinancePartyRow, names: Map<string, string>, fallback: string): string {
  return names.get(row.partyId) ?? specificName(row.partyName) ?? displayEntityLabel(row.partyName, fallback, row.partyId);
}

function entryLine(
  entry: FinanceLedgerEntry,
  who: string,
  tds?: CompliancePack['tds']['lines'][number],
): AuditLine {
  const inflow = entry.direction === 'IN';
  const amount = n(entry.amount);
  return {
    key: `${entry.sourceType}-${entry.entryId}`,
    date: entry.bookDate,
    verified: entry.verifiedDate,
    direction: entry.direction,
    who,
    what: entry.categoryLabel,
    cashIn: inflow ? amount : 0,
    cashOut: inflow ? 0 : amount,
    balance: 0,
    gross: tds ? n(tds.grossSales) : null,
    commission: tds ? n(tds.platformCommission) : null,
    tds: tds ? n(tds.tdsEstimated) : null,
    reference: entry.transactionReference,
    period: entry.periodLabel,
    detail: [entry.narrative, orderCountLabel(entry.orderCount)].filter(Boolean).join(' · ') || null,
    townId: entry.townId,
  };
}

export function buildPartyAuditReport(pack: CompliancePack): PartyAuditReport {
  const names = nameIndex(pack);
  const tdsBySettlement = new Map(pack.tds.lines.map((line) => [line.settlementId, line]));
  const seenSettlements = new Set(
    pack.cashLedger.entries.map((entry) => entry.settlementId).filter((id): id is string => !!id),
  );
  const hubs = resolveHubRows(pack.cashLedger).map((row) => {
    const who = partyName(row, names, 'Delivery hub');
    const fromBook = partyEntries(pack.cashLedger.entries, row.partyId, 'HUB').map((entry) =>
      entryLine(entry, who, entry.settlementId ? tdsBySettlement.get(entry.settlementId) : undefined),
    );
    const fromRegister = (pack.payoutRegister?.lines ?? [])
      .filter((line) => line.payeeType === 'HUB' && line.payeeId === row.partyId && !seenSettlements.has(line.settlementId))
      .map((line) => payoutLine(line, who, tdsBySettlement.get(line.settlementId)));
    return partyFromRow(row, 'hub', who, withBalances([...fromBook, ...fromRegister]));
  });
  const vendors = resolveVendorRows(pack.cashLedger, pack.tds.lines).map((row) => {
    const who = partyName(row, names, 'Vendor');
    const fromBook = partyEntries(pack.cashLedger.entries, row.partyId, 'VENDOR').map((entry) =>
      entryLine(entry, who, entry.settlementId ? tdsBySettlement.get(entry.settlementId) : undefined),
    );
    const fromRegister = (pack.payoutRegister?.lines ?? [])
      .filter((line) => line.payeeType === 'VENDOR' && line.payeeId === row.partyId && !seenSettlements.has(line.settlementId))
      .map((line) => payoutLine(line, who, tdsBySettlement.get(line.settlementId)));
    const covered = new Set(
      [...fromBook, ...fromRegister].map((line) => line.key.replace(/^payout-/, '').replace(/^SETTLEMENT-/, '')),
    );
    const fromTds = pack.tds.lines
      .filter((line) => line.vendorId === row.partyId && !seenSettlements.has(line.settlementId) && !covered.has(line.settlementId))
      .map((line) => tdsOnlyLine(line, who));
    return partyFromRow(row, 'vendor', who, withBalances([...fromBook, ...fromRegister, ...fromTds]));
  });
  const agents = resolveAgentRows(pack, seenSettlements).map((row) => {
    const who = partyName(row, names, 'Delivery agent');
    const fromBook = partyEntries(pack.cashLedger.entries, row.partyId, 'DELIVERY_AGENT').map((entry) =>
      entryLine(entry, who),
    );
    const fromRegister = (pack.payoutRegister?.lines ?? [])
      .filter((line) => line.payeeType === 'AGENT' && line.payeeId === row.partyId && !seenSettlements.has(line.settlementId))
      .map((line) => payoutLine(line, who));
    return partyFromRow(row, 'agent', who, withBalances([...fromBook, ...fromRegister]));
  });
  return {
    from: pack.from,
    to: pack.to,
    truncated: !!pack.cashLedger.truncated,
    hubs,
    vendors,
    agents,
  };
}

function resolveAgentRows(pack: CompliancePack, seenSettlements: Set<string>): FinancePartyRow[] {
  const map = new Map<string, FinancePartyRow>();
  for (const row of aggregatePartiesFromEntries(pack.cashLedger.entries, 'DELIVERY_AGENT')) {
    map.set(row.partyId, row);
  }
  for (const line of pack.payoutRegister?.lines ?? []) {
    if (line.payeeType !== 'AGENT' || !line.payeeId) continue;
    const row = map.get(line.payeeId) ?? emptyPartyRow(line.payeeId, line.payeeName);
    if (!map.has(line.payeeId)) map.set(line.payeeId, row);
    else if (specificName(line.payeeName) && !specificName(row.partyName)) row.partyName = line.payeeName;
    if (seenSettlements.has(line.settlementId)) continue;
    const amount = n(line.netAmount);
    row.txnCount += 1;
    if (line.direction === 'COLLECTION') row.inflows += amount;
    else {
      row.outflows += amount;
      row.payouts += amount;
    }
  }
  return [...map.values()].sort((a, b) => b.outflows - a.outflows || (a.partyName ?? '').localeCompare(b.partyName ?? ''));
}

function partyFromRow(row: FinancePartyRow, kind: 'hub' | 'vendor' | 'agent', name: string, lines: AuditLine[]): AuditParty {
  const inflows = n(row.inflows);
  const outflows = n(row.outflows);
  return {
    id: row.partyId,
    name,
    kind,
    inflows,
    outflows,
    net: round2(inflows - outflows),
    cod: n(row.codRemittances),
    franchise: n(row.franchiseFees),
    otherIn: n(row.otherInflows),
    payouts: n(row.payouts),
    gross: n(row.grossSales),
    commission: n(row.commission),
    tds: n(row.tdsEstimated),
    txnCount: row.txnCount || lines.length,
    lines,
  };
}

function payoutLine(
  line: NonNullable<CompliancePack['payoutRegister']>['lines'][number],
  who: string,
  tds?: CompliancePack['tds']['lines'][number],
): AuditLine {
  const inflow = line.direction === 'COLLECTION';
  const amount = n(line.netAmount);
  const what = line.franchiseFee
    ? 'Hub franchise fee received'
    : line.payeeType === 'VENDOR'
      ? inflow
        ? 'Vendor fees received'
        : 'Vendor goods payout'
      : line.payeeType === 'AGENT'
        ? 'Delivery agent payout'
        : 'Hub delivery commission payout';
  return {
    key: `payout-${line.settlementId}`,
    date: line.paidDate ?? '',
    direction: inflow ? 'IN' : 'OUT',
    who,
    what,
    cashIn: inflow ? amount : 0,
    cashOut: inflow ? 0 : amount,
    balance: 0,
    gross: tds ? n(tds.grossSales) : inflow ? null : n(line.grossAmount),
    commission: tds ? n(tds.platformCommission) : n(line.commissionAmount),
    tds: tds ? n(tds.tdsEstimated) : null,
    reference: line.transactionReference,
    period: line.periodLabel,
    detail: null,
    townId: line.townId,
  };
}

function tdsOnlyLine(line: CompliancePack['tds']['lines'][number], who: string): AuditLine {
  const net = n(line.netPaid);
  return {
    key: `tds-${line.settlementId}`,
    date: line.paidDate ?? '',
    direction: 'OUT',
    who,
    what: 'Vendor goods payout',
    cashIn: 0,
    cashOut: net,
    balance: 0,
    gross: n(line.grossSales),
    commission: n(line.platformCommission),
    tds: n(line.tdsEstimated),
    reference: line.transactionReference,
    period: null,
    detail: null,
    townId: null,
  };
}

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function moneyCell(value: number | null | undefined): number | '' {
  if (value == null || Number.isNaN(value)) return '';
  return round2(value);
}

export function partyAuditCsv(report: PartyAuditReport, townLabel: string, townName: (id?: string | null) => string): string {
  const rows: Array<Array<string | number | null | undefined>> = [
    ['KoyaKart party audit report'],
    ['Town', townLabel],
    ['From', report.from],
    ['To', report.to],
  ];
  if (report.hubs.length === 0) {
    rows.push([]);
  } else rows.push(
    [],
    ['HUB SUMMARY'],
    ['Hub', 'Received', 'Paid out', 'Net', 'COD remitted', 'Franchise', 'Other received', 'Delivery payout', 'Transactions'],
    ...report.hubs.map((hub) => [
      hub.name,
      moneyCell(hub.inflows),
      moneyCell(hub.outflows),
      moneyCell(hub.net),
      moneyCell(hub.cod),
      moneyCell(hub.franchise),
      moneyCell(hub.otherIn),
      moneyCell(hub.payouts),
      hub.txnCount,
    ]),
    [],
    ['HUB LINES'],
    ['Hub', 'Date', 'Verified', 'Received from / Paid to', 'Town', 'What', 'Cash in', 'Cash out', 'Balance', 'Reference', 'Period', 'Detail'],
  );
  for (const hub of report.hubs) {
    for (const line of hub.lines) {
      rows.push([
        hub.name,
        line.date,
        line.verified ?? '',
        `${line.direction === 'IN' ? 'Received from' : 'Paid to'} ${line.who}`,
        townName(line.townId),
        line.what,
        moneyCell(line.cashIn),
        moneyCell(line.cashOut),
        moneyCell(line.balance),
        line.reference ?? '',
        line.period ?? '',
        line.detail ?? '',
      ]);
    }
  }
  if (report.vendors.length > 0) rows.push(
    [],
    ['VENDOR SUMMARY'],
    ['Vendor', 'Paid out', 'Fees received', 'Net', 'Gross facilitated', 'Commission', 'Est. TDS', 'Transactions'],
    ...report.vendors.map((vendor) => [
      vendor.name,
      moneyCell(vendor.outflows),
      moneyCell(vendor.inflows),
      moneyCell(vendor.net),
      moneyCell(vendor.gross),
      moneyCell(vendor.commission),
      moneyCell(vendor.tds),
      vendor.txnCount,
    ]),
    [],
    ['VENDOR LINES'],
    ['Vendor', 'Date', 'Verified', 'Received from / Paid to', 'Town', 'What', 'Gross', 'Commission', 'Est. TDS', 'Cash in', 'Cash out', 'Balance', 'Reference', 'Period', 'Detail'],
  );
  for (const vendor of report.vendors) {
    for (const line of vendor.lines) {
      rows.push([
        vendor.name,
        line.date,
        line.verified ?? '',
        `${line.direction === 'IN' ? 'Received from' : 'Paid to'} ${line.who}`,
        townName(line.townId),
        line.what,
        moneyCell(line.gross),
        moneyCell(line.commission),
        moneyCell(line.tds),
        moneyCell(line.cashIn),
        moneyCell(line.cashOut),
        moneyCell(line.balance),
        line.reference ?? '',
        line.period ?? '',
        line.detail ?? '',
      ]);
    }
  }
  if (report.agents.length > 0) {
    rows.push(
      [],
      ['DELIVERY AGENT SUMMARY'],
      ['Delivery agent', 'Paid out', 'Received', 'Net', 'Transactions'],
      ...report.agents.map((agent) => [
        agent.name,
        moneyCell(agent.outflows),
        moneyCell(agent.inflows),
        moneyCell(agent.net),
        agent.txnCount,
      ]),
      [],
      ['DELIVERY AGENT LINES'],
      ['Delivery agent', 'Date', 'Verified', 'Received from / Paid to', 'Town', 'What', 'Cash in', 'Cash out', 'Balance', 'Reference', 'Period', 'Detail'],
    );
    for (const agent of report.agents) {
      for (const line of agent.lines) {
        rows.push([
          agent.name,
          line.date,
          line.verified ?? '',
          `${line.direction === 'IN' ? 'Received from' : 'Paid to'} ${line.who}`,
          townName(line.townId),
          line.what,
          moneyCell(line.cashIn),
          moneyCell(line.cashOut),
          moneyCell(line.balance),
          line.reference ?? '',
          line.period ?? '',
          line.detail ?? '',
        ]);
      }
    }
  }
  return `\uFEFF${rows.map((row) => row.map(csvEscape).join(',')).join('\n')}`;
}

function esc(value: string | number | null | undefined): string {
  if (value == null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inr(value?: number | null): string {
  return `₹${n(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function hubSummaryHtml(hubs: AuditParty[]): string {
  if (hubs.length === 0) return '<p class="muted">No hub movements in this period.</p>';
  const body = hubs
    .map(
      (hub) => `<tr>
        <td>${esc(hub.name)}</td>
        <td class="right">${esc(inr(hub.inflows))}</td>
        <td class="right">${esc(inr(hub.outflows))}</td>
        <td class="right">${esc(inr(hub.net))}</td>
        <td class="right">${esc(inr(hub.cod))}</td>
        <td class="right">${esc(inr(hub.franchise))}</td>
        <td class="right">${esc(inr(hub.otherIn))}</td>
        <td class="right">${esc(inr(hub.payouts))}</td>
        <td class="right">${hub.txnCount}</td>
      </tr>`,
    )
    .join('');
  return `<table><thead><tr>
    <th>Hub</th><th class="right">Received</th><th class="right">Paid out</th><th class="right">Net</th>
    <th class="right">COD</th><th class="right">Franchise</th><th class="right">Other in</th><th class="right">Commission</th><th class="right">Txns</th>
  </tr></thead><tbody>${body}</tbody></table>`;
}

function agentSummaryHtml(agents: AuditParty[]): string {
  const body = agents
    .map(
      (agent) => `<tr>
        <td>${esc(agent.name)}</td>
        <td class="right">${esc(inr(agent.outflows))}</td>
        <td class="right">${esc(inr(agent.inflows))}</td>
        <td class="right">${esc(inr(agent.net))}</td>
        <td class="right">${agent.txnCount}</td>
      </tr>`,
    )
    .join('');
  return `<table><thead><tr>
    <th>Delivery agent</th><th class="right">Paid out</th><th class="right">Received</th><th class="right">Net</th><th class="right">Txns</th>
  </tr></thead><tbody>${body}</tbody></table>`;
}

function vendorSummaryHtml(vendors: AuditParty[]): string {
  if (vendors.length === 0) return '<p class="muted">No vendor movements in this period.</p>';
  const body = vendors
    .map(
      (vendor) => `<tr>
        <td>${esc(vendor.name)}</td>
        <td class="right">${esc(inr(vendor.outflows))}</td>
        <td class="right">${esc(inr(vendor.inflows))}</td>
        <td class="right">${esc(inr(vendor.net))}</td>
        <td class="right">${esc(inr(vendor.gross))}</td>
        <td class="right">${esc(inr(vendor.commission))}</td>
        <td class="right">${esc(inr(vendor.tds))}</td>
        <td class="right">${vendor.txnCount}</td>
      </tr>`,
    )
    .join('');
  return `<table><thead><tr>
    <th>Vendor</th><th class="right">Paid out</th><th class="right">Fees received</th><th class="right">Net</th>
    <th class="right">Gross</th><th class="right">Commission</th><th class="right">Est. TDS</th><th class="right">Txns</th>
  </tr></thead><tbody>${body}</tbody></table>`;
}

function linesHtml(parties: AuditParty[], vendor: boolean, townName: (id?: string | null) => string): string {
  const chunks: string[] = [];
  for (const party of parties) {
    if (party.lines.length === 0) continue;
    const body = party.lines
      .map((line) => {
        const partyCell = `${line.direction === 'IN' ? 'Received from' : 'Paid to'} ${line.who}`;
        const extra = vendor
          ? `<td class="right">${line.gross == null ? '' : esc(inr(line.gross))}</td><td class="right">${line.commission == null ? '' : esc(inr(line.commission))}</td><td class="right">${line.tds == null ? '' : esc(inr(line.tds))}</td>`
          : '';
        return `<tr>
          <td>${esc(line.date)}</td>
          <td>${esc(line.verified ?? '')}</td>
          <td>${esc(partyCell)}</td>
          <td>${esc(townName(line.townId))}</td>
          <td>${esc(line.what)}</td>
          ${extra}
          <td class="right">${line.cashIn ? esc(inr(line.cashIn)) : ''}</td>
          <td class="right">${line.cashOut ? esc(inr(line.cashOut)) : ''}</td>
          <td class="right">${esc(inr(line.balance))}</td>
          <td>${esc(line.reference ?? '')}</td>
          <td>${esc(line.period ?? '')}</td>
        </tr>`;
      })
      .join('');
    const vendorHeads = vendor ? '<th class="right">Gross</th><th class="right">Commission</th><th class="right">Est. TDS</th>' : '';
    chunks.push(`<h3>${esc(party.name)}</h3><table><thead><tr>
      <th>Date</th><th>Verified</th><th>Received from / Paid to</th><th>Town</th><th>What</th>
      ${vendorHeads}
      <th class="right">Cash in</th><th class="right">Cash out</th><th class="right">Balance</th><th>Reference</th><th>Period</th>
    </tr></thead><tbody>${body}</tbody></table>`);
  }
  return chunks.join('') || '<p class="muted">No lines in this period.</p>';
}

export function printPartyAuditReport(report: PartyAuditReport, townLabel: string, townName: (id?: string | null) => string): void {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>KoyaKart vendor and hub audit report</title>
<style>
  body { font-family: system-ui, Segoe UI, sans-serif; font-size: 11px; color: #111; margin: 18px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  h2 { font-size: 13px; margin: 16px 0 6px; border-bottom: 1px solid #ccc; }
  h3 { font-size: 12px; margin: 10px 0 4px; }
  .muted { color: #555; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 8px; }
  th, td { border: 1px solid #ddd; padding: 3px 5px; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; }
  .right { text-align: right; white-space: nowrap; }
  @media print { body { margin: 10px; } h2 { break-before: page; } h2:first-of-type { break-before: auto; } }
</style></head><body>
  <h1>KoyaKart — Party audit report</h1>
  <p class="muted">${esc(townLabel)} · ${esc(report.from)} → ${esc(report.to)} (IST)</p>
  <p class="muted">Net is cash received minus cash paid for that party. Balance on each line is the outstanding with that party after the line.</p>
  ${report.hubs.length === 0 ? '' : `<h2>Hubs</h2>${hubSummaryHtml(report.hubs)}${linesHtml(report.hubs, false, townName)}`}
  ${report.vendors.length === 0 ? '' : `<h2>Vendors</h2>${vendorSummaryHtml(report.vendors)}${linesHtml(report.vendors, true, townName)}`}
  ${report.agents.length === 0 ? '' : `<h2>Delivery agents</h2>${agentSummaryHtml(report.agents)}${linesHtml(report.agents, false, townName)}`}
</body></html>`;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.srcdoc = html;
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      window.setTimeout(() => frame.remove(), 800);
    }
  };
  document.body.appendChild(frame);
}
