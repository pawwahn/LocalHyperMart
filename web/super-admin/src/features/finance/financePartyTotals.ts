import type { CompliancePack, FinanceLedgerEntry, FinanceLedgerPartyCashTotal, FinanceLedgerReport } from './api/financeLedgerApi';

export type FinancePartyRow = {
  partyId: string;
  partyName?: string | null;
  inflows: number;
  outflows: number;
  franchiseFees: number;
  codRemittances: number;
  otherInflows: number;
  payouts: number;
  txnCount: number;
  grossSales: number;
  commission: number;
  tdsEstimated: number;
};

function n(v?: number | null): number {
  return Number(v ?? 0);
}

export function emptyPartyRow(id: string, name?: string | null): FinancePartyRow {
  return {
    partyId: id,
    partyName: name ?? null,
    inflows: 0,
    outflows: 0,
    franchiseFees: 0,
    codRemittances: 0,
    otherInflows: 0,
    payouts: 0,
    txnCount: 0,
    grossSales: 0,
    commission: 0,
    tdsEstimated: 0,
  };
}

function mapApiParty(t: FinanceLedgerPartyCashTotal): FinancePartyRow {
  return {
    partyId: t.partyId,
    partyName: t.partyName,
    inflows: n(t.inflows),
    outflows: n(t.outflows),
    franchiseFees: n(t.franchiseFees),
    codRemittances: n(t.codRemittances),
    otherInflows: n(t.otherInflows),
    payouts: n(t.payouts),
    txnCount: t.txnCount ?? 0,
    grossSales: 0,
    commission: 0,
    tdsEstimated: 0,
  };
}

function applyEntry(row: FinancePartyRow, e: FinanceLedgerEntry) {
  const amt = n(e.amount);
  row.txnCount += 1;
  if (e.counterpartyName && !row.partyName) row.partyName = e.counterpartyName;
  if (e.direction === 'IN') {
    row.inflows += amt;
    if (e.category === 'HUB_FRANCHISE_FEE') row.franchiseFees += amt;
    else if (e.category === 'HUB_COD_REMITTANCE') row.codRemittances += amt;
    else row.otherInflows += amt;
  } else {
    row.outflows += amt;
    row.payouts += amt;
  }
}

export function aggregatePartiesFromEntries(entries: FinanceLedgerEntry[], role: string): FinancePartyRow[] {
  const map = new Map<string, FinancePartyRow>();
  for (const e of entries) {
    if (e.counterpartyRole !== role || !e.counterpartyId) continue;
    if (e.paymentRail === 'WALLET') continue;
    const row = map.get(e.counterpartyId) ?? emptyPartyRow(e.counterpartyId, e.counterpartyName);
    applyEntry(row, e);
    map.set(e.counterpartyId, row);
  }
  return [...map.values()];
}

export function resolveHubRows(report: FinanceLedgerReport | null): FinancePartyRow[] {
  if (!report) return [];
  const rows = report.hubCashTotals
    ? report.hubCashTotals.map(mapApiParty)
    : aggregatePartiesFromEntries(report.entries, 'HUB');
  return rows.sort((a, b) => b.inflows - a.inflows || b.outflows - a.outflows);
}

export function resolveVendorRows(
  report: FinanceLedgerReport | null,
  tdsLines?: CompliancePack['tds']['lines'],
): FinancePartyRow[] {
  const map = new Map<string, FinancePartyRow>();
  if (report) {
    const base = report.vendorCashTotals
      ? report.vendorCashTotals.map(mapApiParty)
      : aggregatePartiesFromEntries(report.entries, 'VENDOR');
    for (const r of base) map.set(r.partyId, r);
  }
  for (const line of tdsLines ?? []) {
    const row = map.get(line.vendorId) ?? emptyPartyRow(line.vendorId, line.vendorName);
    if (line.vendorName && !row.partyName) row.partyName = line.vendorName;
    row.grossSales += n(line.grossSales);
    row.commission += n(line.platformCommission);
    row.tdsEstimated += n(line.tdsEstimated);
    map.set(line.vendorId, row);
  }
  return [...map.values()].sort((a, b) => b.outflows - a.outflows || b.grossSales - a.grossSales);
}

export function sumPartyRows(rows: FinancePartyRow[]): FinancePartyRow {
  const total = emptyPartyRow('total', 'Total');
  for (const r of rows) {
    total.inflows += r.inflows;
    total.outflows += r.outflows;
    total.franchiseFees += r.franchiseFees;
    total.codRemittances += r.codRemittances;
    total.otherInflows += r.otherInflows;
    total.payouts += r.payouts;
    total.txnCount += r.txnCount;
    total.grossSales += r.grossSales;
    total.commission += r.commission;
    total.tdsEstimated += r.tdsEstimated;
  }
  return total;
}

export function partyEntries(entries: FinanceLedgerEntry[], partyId: string, role: string): FinanceLedgerEntry[] {
  return entries.filter((e) => e.counterpartyRole === role && e.counterpartyId === partyId);
}
