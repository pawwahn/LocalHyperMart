import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import {
  fetchCompliancePack,
  recordGatewaySettlement,
  type CompliancePack,
  type FinanceLedgerEntry,
  type FinanceLedgerReport,
} from '../api/financeLedgerApi';
import { printFinanceCompliancePdf } from '../financeLedgerPrint';
import { resolveManagementSummary } from '../financeManagementSummary';
import {
  partyEntries,
  resolveHubRows,
  resolveVendorRows,
  sumPartyRows,
  type FinancePartyRow,
} from '../financePartyTotals';
import {
  displayCounterparty,
  displayEntityLabel,
  displayPayeeLabel,
  looksLikeUuid,
} from '@/shared/display/displayNames';
import { PNL_SUMMARY_TIPS } from '../pnlSummaryTips';
import { GMV_TIPS } from '@/shared/glossary/gmv';
import { MEMBERSHIP_DELIVERY_TIPS } from '@/shared/glossary/membershipDeliveryTips';
import {
  isoIstDate,
  rangeForReportPreset,
  REPORT_DATE_PRESET_OPTIONS,
  type ReportDatePreset,
} from '@/shared/dates/istReportPresets';
type ViewTab = 'transactions' | 'daily';
type MainTab =
  | 'cash'
  | 'pnl'
  | 'revenue'
  | 'categories'
  | 'payouts'
  | 'refunds'
  | 'towns'
  | 'hubs'
  | 'vendors'
  | 'gst'
  | 'tds'
  | 'gateway';

function money(n?: number | null): string {
  return `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function filterPartyRows(rows: FinancePartyRow[], query: string): FinancePartyRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => (r.partyName ?? '').toLowerCase().includes(q));
}

export function FinanceLedgerPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const initial = rangeForReportPreset('month');
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState('');
  const [preset, setPreset] = useState<ReportDatePreset>('month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [mainTab, setMainTab] = useState<MainTab>('cash');
  const [tab, setTab] = useState<ViewTab>('transactions');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'IN' | 'OUT'>('all');
  const [natureFilter, setNatureFilter] = useState<'all' | 'OPERATING' | 'PASS_THROUGH' | 'WALLET'>('all');
  const [compliance, setCompliance] = useState<CompliancePack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rzpDate, setRzpDate] = useState(isoIstDate());
  const [rzpUtr, setRzpUtr] = useState('');
  const [rzpGross, setRzpGross] = useState('');
  const [rzpFee, setRzpFee] = useState('');
  const [rzpNet, setRzpNet] = useState('');
  const [rzpSaving, setRzpSaving] = useState(false);
  const [partyQuery, setPartyQuery] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);

  const report: FinanceLedgerReport | null = compliance?.cashLedger ?? null;

  const managementSummary = useMemo(
    () => (compliance ? resolveManagementSummary(compliance) : null),
    [compliance],
  );

  const applyPreset = (next: ReportDatePreset) => {
    setPreset(next);
    if (next === 'custom') return;
    const r = rangeForReportPreset(next);
    setFrom(r.from);
    setTo(r.to);
  };

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [townList, data] = await Promise.all([
        listTowns(token),
        fetchCompliancePack(token, { from, to, townId: townId || undefined }),
      ]);
      setTowns(townList);
      setCompliance(data);
    } catch (err) {
      setCompliance(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load ledger');
    } finally {
      setLoading(false);
    }
  }, [token, from, to, townId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const townName = useMemo(() => {
    if (!townId) return 'All towns';
    const name = towns.find((t) => t.id === townId)?.displayName;
    if (name) return name;
    return looksLikeUuid(townId) ? 'Town' : townId;
  }, [townId, towns]);

  const filteredEntries = useMemo(() => {
    if (!report) return [];
    return report.entries.filter((e) => {
      if (directionFilter !== 'all' && e.direction !== directionFilter) return false;
      if (natureFilter === 'WALLET' && e.paymentRail !== 'WALLET') return false;
      if (natureFilter === 'OPERATING' && (e.cashNature !== 'OPERATING' || e.paymentRail === 'WALLET')) return false;
      if (natureFilter === 'PASS_THROUGH' && e.cashNature !== 'PASS_THROUGH') return false;
      return true;
    });
  }, [report, directionFilter, natureFilter]);

  const hubRows = useMemo(() => resolveHubRows(report), [report]);
  const vendorRows = useMemo(() => resolveVendorRows(report, compliance?.tds.lines), [report, compliance]);
  const visibleHubRows = useMemo(() => filterPartyRows(hubRows, partyQuery), [hubRows, partyQuery]);
  const visibleVendorRows = useMemo(() => filterPartyRows(vendorRows, partyQuery), [vendorRows, partyQuery]);

  const exportCsv = () => {
    if (!report) return;
    const rows: Array<Array<string | number | null | undefined>> = [
      [
        'Book date',
        'Direction',
        'Nature',
        'Category',
        'Amount INR',
        'Counterparty role',
        'Counterparty',
        'Payment rail',
        'Txn reference',
        'Orders',
        'Period',
        'Narrative',
        'Source id',
      ],
      ...filteredEntries.map((e) => [
        e.bookDate,
        e.direction,
        e.cashNature,
        e.categoryLabel,
        e.amount,
        e.counterpartyRole,
        e.counterpartyName ?? '',
        e.paymentRail ?? '',
        e.transactionReference ?? '',
        e.orderNumbers ?? '',
        e.periodLabel ?? '',
        e.narrative ?? '',
        e.entryId,
      ]),
      [],
      ['HUBS'],
      ['Hub', 'Received', 'Paid out', 'COD remitted', 'Franchise', 'Other IN', 'Delivery payouts', 'Txns'],
      ...hubRows.map((h) => [
        displayEntityLabel(h.partyName, 'Delivery hub', h.partyId),
        h.inflows,
        h.outflows,
        h.codRemittances,
        h.franchiseFees,
        h.otherInflows,
        h.payouts,
        h.txnCount,
      ]),
      [],
      ['VENDORS'],
      ['Vendor', 'Paid out', 'Gross', 'Commission', 'Est. TDS', 'Received', 'Txns'],
      ...vendorRows.map((v) => [
        displayEntityLabel(v.partyName, 'Vendor', v.partyId),
        v.outflows,
        v.grossSales,
        v.commission,
        v.tdsEstimated,
        v.inflows,
        v.txnCount,
      ]),
    ];
    const body = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KoyaKart-finance-ledger-${report.from}-${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PortalShell title="Finance ledger" subtitle="Day-wise cash book for IT / bank reconciliation (IST)" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {report?.truncated ? (
        <Banner tone="warning">Showing first 5,000 transactions only — narrow the date range or town for a full export.</Banner>
      ) : null}

      <Card style={styles.filters}>
        <div style={styles.filterRow}>
          <label style={styles.label}>
            Town
            <select value={townId} onChange={(e) => setTownId(e.target.value)} style={styles.select}>
              <option value="">All towns</option>
              {towns.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName}
                </option>
              ))}
            </select>
          </label>
          <div style={styles.presets}>
            {REPORT_DATE_PRESET_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                style={preset === id ? styles.chipOn : styles.chip}
                onClick={() => applyPreset(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.filterRow}>
          <label style={styles.label}>
            From
            <input type="date" value={from} onChange={(e) => { setPreset('custom'); setFrom(e.target.value); }} style={styles.input} />
          </label>
          <label style={styles.label}>
            To
            <input type="date" value={to} onChange={(e) => { setPreset('custom'); setTo(e.target.value); }} style={styles.input} />
          </label>
          <Button type="button" onClick={() => void reload()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
          <Button type="button" variant="secondary" onClick={exportCsv} disabled={!report}>
            Export CSV
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!compliance}
            onClick={() => {
              if (!compliance) return;
              printFinanceCompliancePdf(compliance, townName, filteredEntries);
            }}
          >
            Export PDF
          </Button>
        </div>
        <p style={styles.hint}>{townName} · {from} → {to}</p>
      </Card>

      {compliance ? (
        <>
          <div style={styles.mainTabs}>
            {(
              [
                ['cash', 'Cash book'],
                ['pnl', 'P&L summary'],
                ['revenue', 'Revenue accrual'],
                ['categories', 'By category'],
                ['payouts', 'Payout register'],
                ['refunds', 'Refunds'],
                ...(townId ? [] : [['towns', 'By town'] as const]),
                ['hubs', 'By hub'],
                ['vendors', 'By vendor'],
                ['gst', 'GST'],
                ['tds', 'TDS (vendors)'],
                ['gateway', 'Razorpay recon'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                style={mainTab === id ? styles.tabOn : styles.tab}
                onClick={() => {
                  setMainTab(id);
                  setSelectedPartyId(null);
                  setPartyQuery('');
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {mainTab === 'cash' ? (
            <>
          <div style={styles.summaryGrid}>
            <SummaryCard label="Total received (IN)" value={money(report?.totalInflows)} help="All inflows in period" tone="in" />
            <SummaryCard label="Total paid out (OUT)" value={money(report?.totalOutflows)} help="Bank/gateway: settlements, refunds" tone="out" />
            <SummaryCard label="Net cash movement" value={money(report?.netCashMovement)} help="Bank IN minus bank OUT" />
            <SummaryCard label="Wallet gifted" value={money(report?.walletGranted)} help="Scratch + referral + store credit" tone="out" />
            <SummaryCard label="Scratch gifts" value={money(report?.walletScratch)} help="Wallet CREDIT · not bank" tone="out" />
            <SummaryCard label="Referral gifts" value={money(report?.walletReferral)} help="Both sides · not bank" tone="out" />
            <SummaryCard label="Store credit" value={money(report?.walletStoreCredit)} help="Item cancel · not bank" tone="out" />
            <SummaryCard label="Wallet used" value={money(report?.walletRedeemed)} help="Spent at checkout" />
            <SummaryCard label="Platform revenue (IN)" value={money(report?.platformReceipts)} help="Membership, franchise — not vendor GMV" tone="in" />
            <SummaryCard label="Pass-through IN" value={money(report?.passThroughInflows)} help="Buyer online + hub COD remittance" />
            <SummaryCard label="Pass-through OUT" value={money(report?.passThroughOutflows)} help="Vendor & delivery payouts" tone="out" />
          </div>
          <p style={styles.compliance}>{report?.complianceNote}</p>
          {townId ? (
            <p style={styles.compliance}>
              Town filter keeps wallet lines that have an order town (checkout / store credit). Scratch and referral
              gifts are company-wide — switch to All towns to see every rupee.
            </p>
          ) : null}

          <div style={styles.tabs}>
            <button type="button" style={tab === 'transactions' ? styles.tabOn : styles.tab} onClick={() => setTab('transactions')}>
              Transactions ({filteredEntries.length})
            </button>
            <button type="button" style={tab === 'daily' ? styles.tabOn : styles.tab} onClick={() => setTab('daily')}>
              Daily totals
            </button>
          </div>

          {tab === 'transactions' ? (
            <>
              <div style={styles.filterRow}>
                <label style={styles.label}>
                  Direction
                  <select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value as typeof directionFilter)} style={styles.select}>
                    <option value="all">All</option>
                    <option value="IN">Received (IN)</option>
                    <option value="OUT">Paid (OUT)</option>
                  </select>
                </label>
                <label style={styles.label}>
                  Nature
                  <select value={natureFilter} onChange={(e) => setNatureFilter(e.target.value as typeof natureFilter)} style={styles.select}>
                    <option value="all">All</option>
                    <option value="OPERATING">Operating / revenue</option>
                    <option value="PASS_THROUGH">Pass-through</option>
                    <option value="WALLET">Wallet gifts</option>
                  </select>
                </label>
              </div>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>In / Out</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.thNum}>Amount</th>
                      <th style={styles.th}>From / To</th>
                      <th style={styles.th}>Reference</th>
                      <th style={styles.th}>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={styles.empty}>No transactions in this filter.</td>
                      </tr>
                    ) : (
                      filteredEntries.map((e) => <LedgerRow key={`${e.sourceType}-${e.entryId}`} entry={e} />)
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.thNum}>Received</th>
                    <th style={styles.thNum}>Paid out</th>
                    <th style={styles.thNum}>Net</th>
                    <th style={styles.thNum}># Txns</th>
                  </tr>
                </thead>
                <tbody>
                  {report.daily.map((d) => (
                    <tr key={d.date}>
                      <td style={styles.td}>{d.date}</td>
                      <td style={styles.tdNum}>{money(d.inflows)}</td>
                      <td style={styles.tdNum}>{money(d.outflows)}</td>
                      <td style={styles.tdNum}>{money(d.net)}</td>
                      <td style={styles.tdNum}>{d.entries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
            </>
          ) : null}

          {mainTab === 'pnl' && managementSummary ? (
            <>
              <p style={styles.pnlIntro}>
                Hover or focus the <strong>?</strong> on each tile for a plain-language explanation. Amounts use
                your selected date range (IST).
              </p>
              <div style={styles.summaryGrid}>
                <SummaryCard
                  label="Platform result (pre-opex)"
                  value={
                    managementSummary.platformResultIndicator === 'SURPLUS'
                      ? `Surplus ${money(managementSummary.netSurplusBeforeOperatingExpenses)}`
                      : managementSummary.platformResultIndicator === 'SHORTFALL'
                        ? `Shortfall ${money(managementSummary.netSurplusBeforeOperatingExpenses)}`
                        : 'Break even'
                  }
                  help="Accrual revenue − refunds − gateway fees − wallet gifts"
                  tip={PNL_SUMMARY_TIPS.platformResult}
                  tone={managementSummary.netSurplusBeforeOperatingExpenses >= 0 ? 'in' : 'out'}
                />
                <SummaryCard
                  label="Est. platform revenue"
                  value={money(managementSummary.estimatedPlatformRevenue)}
                  help="Accrual (fees + commission + membership)"
                  tip={PNL_SUMMARY_TIPS.estimatedRevenue}
                  tone="in"
                />
                <SummaryCard
                  label="Buyer refunds"
                  value={money(managementSummary.buyerRefunds)}
                  help="Cash out to buyers"
                  tip={PNL_SUMMARY_TIPS.buyerRefunds}
                  tone="out"
                />
                <SummaryCard
                  label="Gateway fees (imported)"
                  value={money(managementSummary.paymentGatewayFees)}
                  help="From Razorpay batches"
                  tip={PNL_SUMMARY_TIPS.gatewayFees}
                  tone="out"
                />
                <SummaryCard
                  label="Platform cash IN"
                  value={money(managementSummary.platformCashReceipts)}
                  help="Membership, franchise (cash book)"
                  tip={PNL_SUMMARY_TIPS.platformCashIn}
                  tone="in"
                />
                <SummaryCard
                  label="Pass-through float"
                  value={money(managementSummary.passThroughFloat)}
                  help="IN − OUT (not profit)"
                  tip={PNL_SUMMARY_TIPS.passThroughFloat}
                />
                <SummaryCard
                  label="Net cash movement"
                  value={money(managementSummary.netCashMovement)}
                  help="Bank IN − bank OUT"
                  tip={PNL_SUMMARY_TIPS.netCashMovement}
                />
                <SummaryCard
                  label="Wallet gifts"
                  value={money(managementSummary.walletGranted)}
                  help="Scratch + referral + store credit"
                  tip={PNL_SUMMARY_TIPS.walletGifts}
                  tone="out"
                />
                <SummaryCard
                  label="Scratch gifts"
                  value={money(managementSummary.walletScratch)}
                  help="In this range"
                  tip={PNL_SUMMARY_TIPS.scratchGifts}
                  tone="out"
                />
                <SummaryCard
                  label="Referral gifts"
                  value={money(managementSummary.walletReferral)}
                  help="Both sides"
                  tip={PNL_SUMMARY_TIPS.referralGifts}
                  tone="out"
                />
                <SummaryCard
                  label="Store credit"
                  value={money(managementSummary.walletStoreCredit)}
                  help="Item cancel"
                  tip={PNL_SUMMARY_TIPS.storeCredit}
                  tone="out"
                />
              </div>
              <p style={styles.compliance}>{managementSummary.note}</p>
            </>
          ) : null}

          {mainTab === 'categories' ? (
            <>
              <p style={styles.compliance}>Totals by ledger category (full period, not limited by transaction list cap).</p>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>In / Out</th>
                      <th style={styles.th}>Nature</th>
                      <th style={styles.thNum}>#</th>
                      <th style={styles.thNum}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report?.categoryTotals ?? []).length === 0 ? (
                      <tr><td colSpan={5} style={styles.empty}>No movements in range.</td></tr>
                    ) : (
                      (report?.categoryTotals ?? []).map((c) => (
                        <tr key={`${c.category}-${c.direction}`}>
                          <td style={styles.td}>{c.categoryLabel}</td>
                          <td style={styles.td}>{c.direction}</td>
                          <td style={styles.td}>
                            {c.category.startsWith('WALLET_')
                              ? 'Wallet'
                              : c.cashNature === 'OPERATING'
                                ? 'Operating'
                                : 'Pass-through'}
                          </td>
                          <td style={styles.tdNum}>{c.entryCount}</td>
                          <td style={styles.tdNum}>{money(c.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {mainTab === 'payouts' && compliance.payoutRegister ? (
            <>
              <div style={styles.summaryGrid}>
                <SummaryCard label="Vendor payouts" value={money(compliance.payoutRegister.vendorPayouts)} help="Goods pass-through" tone="out" />
                <SummaryCard label="Agent payouts" value={money(compliance.payoutRegister.agentPayouts)} help="Delivery commission" tone="out" />
                <SummaryCard label="Hub delivery payouts" value={money(compliance.payoutRegister.hubDeliveryPayouts)} help="Hub commission" tone="out" />
                <SummaryCard label="Franchise collected" value={money(compliance.payoutRegister.franchiseFeesCollected)} help="Operating IN" tone="in" />
                <SummaryCard label="Vendor fees collected" value={money(compliance.payoutRegister.vendorFeesCollected)} help="Commission / monthly IN" tone="in" />
                <SummaryCard label="Other hub collections" value={money(compliance.payoutRegister.otherCollectionsFromHubs)} help="Non-franchise IN" tone="in" />
              </div>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Paid</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Payee</th>
                      <th style={styles.thNum}>Net</th>
                      <th style={styles.thNum}>Commission</th>
                      <th style={styles.th}>Period</th>
                      <th style={styles.th}>Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compliance.payoutRegister.lines.length === 0 ? (
                      <tr><td colSpan={7} style={styles.empty}>No paid settlements in range.</td></tr>
                    ) : (
                      compliance.payoutRegister.lines.map((l) => (
                        <tr key={l.settlementId}>
                          <td style={styles.td}>{l.paidDate ?? '—'}</td>
                          <td style={styles.td}>
                            {l.direction === 'COLLECTION'
                              ? l.franchiseFee
                                ? 'Franchise IN'
                                : l.payeeType === 'VENDOR'
                                  ? 'Vendor fees IN'
                                  : 'Collection IN'
                              : l.payeeType}
                          </td>
                          <td style={styles.td}>
                            {displayPayeeLabel(l.payeeName, l.payeeId, l.payeeType)}
                          </td>
                          <td style={styles.tdNum}>{money(l.netAmount)}</td>
                          <td style={styles.tdNum}>{money(l.commissionAmount)}</td>
                          <td style={styles.td}>{l.periodLabel ?? '—'}</td>
                          <td style={styles.tdMono}>{l.transactionReference ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {mainTab === 'refunds' && compliance.refundRegister ? (
            <>
              <div style={styles.summaryGrid}>
                <SummaryCard label="Refunds" value={String(compliance.refundRegister.refundCount)} help="Count in period" />
                <SummaryCard label="Total refunded" value={money(compliance.refundRegister.totalRefunded)} help="Buyer OUT" tone="out" />
              </div>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Date</th>
                      <th style={styles.thNum}>Amount</th>
                      <th style={styles.th}>Reason</th>
                      <th style={styles.th}>Order</th>
                      <th style={styles.th}>Gateway ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compliance.refundRegister.lines.length === 0 ? (
                      <tr><td colSpan={5} style={styles.empty}>No refunds in range.</td></tr>
                    ) : (
                      compliance.refundRegister.lines.map((l) => (
                        <tr key={l.refundId}>
                          <td style={styles.td}>{l.refundDate}</td>
                          <td style={styles.tdNum}>{money(l.amount)}</td>
                          <td style={styles.td}>{l.reason ?? '—'}</td>
                          <td style={styles.tdMono}>{l.orderId}</td>
                          <td style={styles.tdMono}>{l.gatewayReference ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {mainTab === 'towns' && !townId ? (
            <>
              <p style={styles.compliance}>Cash movement by town (pass-through + operating). Accrual by town is on the main Reports page.</p>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Town</th>
                      <th style={styles.thNum}>Received</th>
                      <th style={styles.thNum}>Paid out</th>
                      <th style={styles.thNum}>Platform IN</th>
                      <th style={styles.thNum}>Pass IN</th>
                      <th style={styles.thNum}>Pass OUT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report?.townCashTotals ?? []).length === 0 ? (
                      <tr><td colSpan={6} style={styles.empty}>No town-tagged movements.</td></tr>
                    ) : (
                      (report?.townCashTotals ?? []).map((t) => (
                        <tr key={t.townId}>
                          <td style={styles.td}>
                            {towns.find((x) => x.id === t.townId)?.displayName ??
                              (looksLikeUuid(t.townId) ? 'Town' : t.townId)}
                          </td>
                          <td style={styles.tdNum}>{money(t.inflows)}</td>
                          <td style={styles.tdNum}>{money(t.outflows)}</td>
                          <td style={styles.tdNum}>{money(t.platformReceipts)}</td>
                          <td style={styles.tdNum}>{money(t.passThroughInflows)}</td>
                          <td style={styles.tdNum}>{money(t.passThroughOutflows)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {mainTab === 'hubs' ? (
            <PartyCashPanel
              kind="hub"
              rows={visibleHubRows}
              allCount={hubRows.length}
              query={partyQuery}
              onQuery={setPartyQuery}
              selectedId={selectedPartyId}
              onSelect={setSelectedPartyId}
              entries={report?.entries ?? []}
            />
          ) : null}

          {mainTab === 'vendors' ? (
            <PartyCashPanel
              kind="vendor"
              rows={visibleVendorRows}
              allCount={vendorRows.length}
              query={partyQuery}
              onQuery={setPartyQuery}
              selectedId={selectedPartyId}
              onSelect={setSelectedPartyId}
              entries={report?.entries ?? []}
            />
          ) : null}

          {mainTab === 'revenue' ? (
            <>
              <div style={styles.summaryGrid}>
                <SummaryCard label="Delivered orders" value={String(compliance.accrual.ordersDelivered)} help="Delivery date in range" />
                <SummaryCard
                  label="Delivered order value"
                  value={money(compliance.accrual.deliveredOrderValue)}
                  help="GMV — goods total, not platform profit"
                  tip={GMV_TIPS.delivered}
                />
                <SummaryCard label="Platform fees (orders)" value={money(compliance.accrual.platformFeesOnDelivered)} help="On delivered orders" tone="in" />
                <SummaryCard
                  label="Delivery fees (buyer)"
                  value={money(compliance.accrual.deliveryFeesOnDelivered)}
                  help="Paid on delivered orders"
                  tip={MEMBERSHIP_DELIVERY_TIPS.deliveryFeesCollected}
                />
                <SummaryCard label="COD fees" value={money(compliance.accrual.codFeesOnDelivered)} help="On delivered orders" />
                <SummaryCard label="Vendor commission" value={money(compliance.accrual.vendorCommissionEarned)} help="Billing fees on paid vendor settlements" tone="in" />
                <SummaryCard label="Membership" value={money(compliance.accrual.membershipRevenue)} help="Paid memberships" tone="in" />
                <SummaryCard label="Est. platform revenue" value={money(compliance.accrual.totalEstimatedPlatformRevenue)} help="Fees + commission + membership" tone="in" />
              </div>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Date</th>
                      <th style={styles.thNum}>Delivered</th>
                      <th style={styles.thNum}>Platform fees</th>
                      <th style={styles.thNum}>GMV</th>
                      <th style={styles.thNum}>GST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compliance.accrual.daily.map((d) => (
                      <tr key={d.date}>
                        <td style={styles.td}>{d.date}</td>
                        <td style={styles.tdNum}>{d.ordersDelivered}</td>
                        <td style={styles.tdNum}>{money(d.platformFees)}</td>
                        <td style={styles.tdNum}>{money(d.deliveredGmv)}</td>
                        <td style={styles.tdNum}>{money(d.gstTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {mainTab === 'gst' ? (
            <>
              <div style={styles.summaryGrid}>
                <SummaryCard label="CGST (items)" value={money(compliance.gst.cgstOnDeliveredItems)} help="Delivered orders" />
                <SummaryCard label="SGST (items)" value={money(compliance.gst.sgstOnDeliveredItems)} help="Delivered orders" />
                <SummaryCard label="IGST (items)" value={money(compliance.gst.igstOnDeliveredItems)} help="Delivered orders" />
                <SummaryCard label="Total GST" value={money(compliance.gst.totalGstOnDeliveredItems)} help="Line-item tax snapshots" />
                <SummaryCard label="Order tax field" value={money(compliance.gst.orderLevelTaxAmount)} help="orders.tax_amount sum" />
              </div>
              <p style={styles.compliance}>{compliance.gst.note}</p>
            </>
          ) : null}

          {mainTab === 'tds' ? (
            <>
              <div style={styles.summaryGrid}>
                <SummaryCard label="TDS rate" value={`${compliance.tds.ratePercent}%`} help="Configurable — confirm with CA" />
                <SummaryCard label="Gross sales facilitated" value={money(compliance.tds.totalGrossSalesFacilitated)} help="Paid vendor settlements" />
                <SummaryCard label="Est. TDS" value={money(compliance.tds.totalTdsEstimated)} help="On gross per settlement" tone="out" />
                <SummaryCard label="Net paid to vendors" value={money(compliance.tds.totalNetPaidToVendors)} help="After commission" />
                <SummaryCard label="Platform commission" value={money(compliance.tds.totalPlatformCommission)} help="Retained fees" tone="in" />
              </div>
              <p style={styles.compliance}>{compliance.tds.legalNote}</p>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Paid date</th>
                      <th style={styles.th}>Vendor</th>
                      <th style={styles.thNum}>Gross</th>
                      <th style={styles.thNum}>Commission</th>
                      <th style={styles.thNum}>Net paid</th>
                      <th style={styles.thNum}>Est. TDS</th>
                      <th style={styles.th}>Txn ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compliance.tds.lines.length === 0 ? (
                      <tr><td colSpan={7} style={styles.empty}>No paid vendor settlements in range.</td></tr>
                    ) : (
                      compliance.tds.lines.map((l) => (
                        <tr key={l.settlementId}>
                          <td style={styles.td}>{l.paidDate ?? '—'}</td>
                          <td style={styles.td}>
                            {displayEntityLabel(l.vendorName, 'Vendor', l.vendorId)}
                          </td>
                          <td style={styles.tdNum}>{money(l.grossSales)}</td>
                          <td style={styles.tdNum}>{money(l.platformCommission)}</td>
                          <td style={styles.tdNum}>{money(l.netPaid)}</td>
                          <td style={styles.tdNum}>{money(l.tdsEstimated)}</td>
                          <td style={styles.tdMono}>{l.transactionReference ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {mainTab === 'gateway' ? (
            <>
              <div style={styles.summaryGrid}>
                <SummaryCard label="App online collected" value={money(compliance.gateway.appOnlineCollections)} help="Payment SUCCESS" tone="in" />
                <SummaryCard label="Refunds" value={money(compliance.gateway.appOnlineRefunds)} help="REFUNDED" tone="out" />
                <SummaryCard label="App net online" value={money(compliance.gateway.appNetOnline)} help="Collected − refunds" />
                <SummaryCard label="Bank settled (imported)" value={money(compliance.gateway.importedSettlementNet)} help="Razorpay batches" tone="in" />
                <SummaryCard label="Variance" value={money(compliance.gateway.varianceAppNetVsBankNet)} help="App net vs bank net" />
              </div>
              <p style={styles.compliance}>{compliance.gateway.note}</p>
              <Card style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <strong style={{ fontSize: '0.9rem' }}>Record Razorpay settlement (from dashboard)</strong>
                <div style={styles.filterRow}>
                  <label style={styles.label}>Settlement date<input type="date" value={rzpDate} onChange={(e) => setRzpDate(e.target.value)} style={styles.input} /></label>
                  <label style={styles.label}>UTR / settlement id<input value={rzpUtr} onChange={(e) => setRzpUtr(e.target.value)} style={styles.input} placeholder="UTR" /></label>
                  <label style={styles.label}>Gross ₹<input value={rzpGross} onChange={(e) => setRzpGross(e.target.value)} style={styles.input} /></label>
                  <label style={styles.label}>Fees ₹<input value={rzpFee} onChange={(e) => setRzpFee(e.target.value)} style={styles.input} /></label>
                  <label style={styles.label}>Net ₹<input value={rzpNet} onChange={(e) => setRzpNet(e.target.value)} style={styles.input} /></label>
                  <Button
                    type="button"
                    disabled={rzpSaving || !rzpUtr.trim()}
                    onClick={() => {
                      void (async () => {
                        setRzpSaving(true);
                        try {
                          await recordGatewaySettlement(token, {
                            settlementDate: rzpDate,
                            utrReference: rzpUtr.trim(),
                            grossAmount: Number(rzpGross || 0),
                            feeAmount: Number(rzpFee || 0),
                            netAmount: Number(rzpNet || 0),
                          });
                          setRzpUtr('');
                          await reload();
                        } catch (err) {
                          setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save settlement');
                        } finally {
                          setRzpSaving(false);
                        }
                      })();
                    }}
                  >
                    {rzpSaving ? 'Saving…' : 'Save batch'}
                  </Button>
                </div>
              </Card>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>UTR</th>
                      <th style={styles.thNum}>Gross</th>
                      <th style={styles.thNum}>Fees</th>
                      <th style={styles.thNum}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compliance.gateway.batches.map((b) => (
                      <tr key={b.id}>
                        <td style={styles.td}>{b.settlementDate}</td>
                        <td style={styles.tdMono}>{b.utrReference}</td>
                        <td style={styles.tdNum}>{money(b.grossAmount)}</td>
                        <td style={styles.tdNum}>{money(b.feeAmount)}</td>
                        <td style={styles.tdNum}>{money(b.netAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </>
      ) : loading ? (
        <p style={styles.muted}>Loading ledger…</p>
      ) : null}
    </PortalShell>
  );
}

function LedgerRow({ entry: e }: { entry: FinanceLedgerEntry }) {
  const inflow = e.direction === 'IN';
  return (
    <tr>
      <td style={styles.td}>{e.bookDate}</td>
      <td style={styles.td}>
        <span style={inflow ? styles.badgeIn : styles.badgeOut}>{inflow ? 'IN' : 'OUT'}</span>
        <div style={styles.meta}>
          {e.paymentRail === 'WALLET' ? 'Wallet' : e.cashNature === 'OPERATING' ? 'Operating' : 'Pass-through'}
        </div>
      </td>
      <td style={styles.td}>
        <strong>{e.categoryLabel}</strong>
        <div style={styles.meta}>{e.paymentRail ?? '—'}</div>
      </td>
      <td style={styles.tdNum}>{money(e.amount)}</td>
      <td style={styles.td}>
        <strong>{displayCounterparty(e.counterpartyName, e.counterpartyRole, e.counterpartyId)}</strong>
        <div style={styles.meta}>{e.counterpartyRole}</div>
      </td>
      <td style={styles.tdMono}>{e.transactionReference ?? '—'}</td>
      <td style={styles.td}>
        <div style={styles.narrative}>{e.narrative}</div>
        {e.orderNumbers ? <div style={styles.meta}>Orders: {e.orderNumbers}</div> : null}
        {e.periodLabel ? <div style={styles.meta}>Period: {e.periodLabel}</div> : null}
      </td>
    </tr>
  );
}

function PartyCashPanel({
  kind,
  rows,
  allCount,
  query,
  onQuery,
  selectedId,
  onSelect,
  entries,
}: {
  kind: 'hub' | 'vendor';
  rows: FinancePartyRow[];
  allCount: number;
  query: string;
  onQuery: (v: string) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  entries: FinanceLedgerEntry[];
}) {
  const role = kind === 'hub' ? 'HUB' : 'VENDOR';
  const totals = sumPartyRows(rows);
  const selected = selectedId ? rows.find((r) => r.partyId === selectedId) : null;
  const lines = selectedId ? partyEntries(entries, selectedId, role) : [];
  const isHub = kind === 'hub';

  return (
    <>
      <div style={styles.filterRow}>
        <label style={styles.label}>
          Find {isHub ? 'hub' : 'vendor'}
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={isHub ? 'Hub name' : 'Vendor name'}
            style={styles.input}
          />
        </label>
      </div>
      <p style={styles.compliance}>
        {isHub
          ? 'Cash received from and paid to each delivery hub in this period. Click a row for transactions.'
          : 'Cash paid to each vendor in this period, with settlement gross / commission / estimated TDS. Click a row for transactions.'}
      </p>
      <div style={styles.summaryGrid}>
        <SummaryCard
          label={isHub ? 'Hubs' : 'Vendors'}
          value={String(allCount)}
          help={query.trim() ? `${rows.length} matching` : 'With cash in this range'}
        />
        {isHub ? (
          <>
            <SummaryCard label="Received from hubs" value={money(totals.inflows)} help="COD remittance + franchise + other" tone="in" />
            <SummaryCard label="Paid to hubs" value={money(totals.outflows)} help="Delivery commission payouts" tone="out" />
            <SummaryCard label="COD remitted" value={money(totals.codRemittances)} help="Buyer COD cash to company" />
            <SummaryCard label="Franchise" value={money(totals.franchiseFees)} help="Operating IN" tone="in" />
          </>
        ) : (
          <>
            <SummaryCard label="Paid to vendors" value={money(totals.outflows)} help="Goods payouts (net)" tone="out" />
            <SummaryCard label="Gross facilitated" value={money(totals.grossSales)} help="From paid vendor settlements" />
            <SummaryCard label="Commission" value={money(totals.commission)} help="Retained fees" tone="in" />
            <SummaryCard label="Est. TDS" value={money(totals.tdsEstimated)} help="On gross · confirm with CA" tone="out" />
          </>
        )}
      </div>
      <div style={styles.tableWrap}>
        <table style={{ ...styles.table, minWidth: isHub ? 920 : 880 }}>
          <thead>
            <tr>
              <th style={styles.th}>{isHub ? 'Hub' : 'Vendor'}</th>
              {isHub ? (
                <>
                  <th style={styles.thNum}>Received</th>
                  <th style={styles.thNum}>Paid out</th>
                  <th style={styles.thNum}>COD remitted</th>
                  <th style={styles.thNum}>Franchise</th>
                  <th style={styles.thNum}>Other IN</th>
                  <th style={styles.thNum}>Delivery payout</th>
                </>
              ) : (
                <>
                  <th style={styles.thNum}>Paid out</th>
                  <th style={styles.thNum}>Gross</th>
                  <th style={styles.thNum}>Commission</th>
                  <th style={styles.thNum}>Est. TDS</th>
                </>
              )}
              <th style={styles.thNum}>Txns</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={isHub ? 8 : 6} style={styles.empty}>
                  {query.trim()
                    ? 'No matching names in this period.'
                    : isHub
                      ? 'No hub cash movements in range.'
                      : 'No vendor payouts in range.'}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const on = r.partyId === selectedId;
                return (
                  <tr
                    key={r.partyId}
                    style={on ? styles.trOn : styles.trClick}
                    onClick={() => onSelect(on ? null : r.partyId)}
                  >
                    <td style={styles.td}>
                      {displayEntityLabel(r.partyName, isHub ? 'Delivery hub' : 'Vendor', r.partyId)}
                    </td>
                    {isHub ? (
                      <>
                        <td style={styles.tdNum}>{money(r.inflows)}</td>
                        <td style={styles.tdNum}>{money(r.outflows)}</td>
                        <td style={styles.tdNum}>{money(r.codRemittances)}</td>
                        <td style={styles.tdNum}>{money(r.franchiseFees)}</td>
                        <td style={styles.tdNum}>{money(r.otherInflows)}</td>
                        <td style={styles.tdNum}>{money(r.payouts)}</td>
                      </>
                    ) : (
                      <>
                        <td style={styles.tdNum}>{money(r.outflows)}</td>
                        <td style={styles.tdNum}>{money(r.grossSales)}</td>
                        <td style={styles.tdNum}>{money(r.commission)}</td>
                        <td style={styles.tdNum}>{money(r.tdsEstimated)}</td>
                      </>
                    )}
                    <td style={styles.tdNum}>{r.txnCount}</td>
                  </tr>
                );
              })
            )}
            {rows.length > 0 ? (
              <tr>
                <td style={{ ...styles.td, fontWeight: 800 }}>Total</td>
                {isHub ? (
                  <>
                    <td style={styles.tdNum}>{money(totals.inflows)}</td>
                    <td style={styles.tdNum}>{money(totals.outflows)}</td>
                    <td style={styles.tdNum}>{money(totals.codRemittances)}</td>
                    <td style={styles.tdNum}>{money(totals.franchiseFees)}</td>
                    <td style={styles.tdNum}>{money(totals.otherInflows)}</td>
                    <td style={styles.tdNum}>{money(totals.payouts)}</td>
                  </>
                ) : (
                  <>
                    <td style={styles.tdNum}>{money(totals.outflows)}</td>
                    <td style={styles.tdNum}>{money(totals.grossSales)}</td>
                    <td style={styles.tdNum}>{money(totals.commission)}</td>
                    <td style={styles.tdNum}>{money(totals.tdsEstimated)}</td>
                  </>
                )}
                <td style={styles.tdNum}>{totals.txnCount}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {selected ? (
        <div style={styles.partyDetail}>
          <p style={styles.hint}>
            {displayEntityLabel(selected.partyName, isHub ? 'Delivery hub' : 'Vendor', selected.partyId)}
            {' · '}
            {lines.length} transaction{lines.length === 1 ? '' : 's'}
          </p>
          <div style={styles.tableWrap}>
            <table style={{ ...styles.table, minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>In / Out</th>
                  <th style={styles.th}>Category</th>
                  <th style={styles.thNum}>Amount</th>
                  <th style={styles.th}>Ref</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={styles.empty}>
                      No cash-book lines for this {isHub ? 'hub' : 'vendor'} in the loaded transactions.
                    </td>
                  </tr>
                ) : (
                  lines.map((e) => (
                    <tr key={e.entryId}>
                      <td style={styles.td}>{e.bookDate}</td>
                      <td style={styles.td}>
                        <span style={e.direction === 'IN' ? styles.badgeIn : styles.badgeOut}>{e.direction}</span>
                      </td>
                      <td style={styles.td}>{e.categoryLabel}</td>
                      <td style={styles.tdNum}>{money(e.amount)}</td>
                      <td style={styles.tdMono}>{e.transactionReference ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SummaryCard({
  label,
  value,
  help,
  tip,
  tone,
}: {
  label: string;
  value: string;
  help: string;
  tip?: string;
  tone?: 'in' | 'out';
}) {
  return (
    <div style={tone === 'in' ? styles.sumIn : tone === 'out' ? styles.sumOut : styles.sum}>
      <p style={styles.sumValue}>{value}</p>
      <div style={styles.sumLabelRow}>
        <p style={styles.sumLabel}>{label}</p>
        {tip ? (
          <button
            type="button"
            style={styles.sumTipBtn}
            title={tip}
            aria-label={`About ${label}`}
          >
            ?
          </button>
        ) : null}
      </div>
      <p style={styles.sumHelp}>{help}</p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  filters: { display: 'grid', gap: '0.65rem', marginBottom: '0.75rem' },
  filterRow: { display: 'flex', flexWrap: 'wrap', gap: '0.55rem', alignItems: 'end' },
  label: { display: 'grid', gap: '0.25rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' },
  select: { border: '1px solid var(--border)', borderRadius: 8, padding: '0.35rem 0.5rem', minWidth: 140 },
  input: { border: '1px solid var(--border)', borderRadius: 8, padding: '0.35rem 0.5rem' },
  presets: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'end' },
  chip: { border: '1px solid var(--border)', borderRadius: 999, padding: '0.35rem 0.65rem', background: 'transparent', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' },
  chipOn: { border: '1px solid var(--accent)', borderRadius: 999, padding: '0.35rem 0.65rem', background: 'var(--accent-soft)', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem' },
  hint: { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 },
  pnlIntro: {
    margin: '0 0 0.45rem',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.55rem', marginBottom: '0.5rem' },
  sum: { border: '1px solid var(--border)', borderRadius: 12, padding: '0.65rem', background: 'var(--bg-elevated)' },
  sumIn: { border: '1px solid rgba(129,199,132,0.5)', borderRadius: 12, padding: '0.65rem', background: 'rgba(129,199,132,0.08)' },
  sumOut: { border: '1px solid rgba(239,83,80,0.45)', borderRadius: 12, padding: '0.65rem', background: 'rgba(239,83,80,0.06)' },
  sumValue: { margin: 0, fontWeight: 800, fontSize: '1.15rem' },
  sumLabelRow: {
    margin: '0.15rem 0 0',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.35rem',
  },
  sumLabel: { margin: 0, fontWeight: 800, fontSize: '0.82rem', flex: 1, lineHeight: 1.25 },
  sumTipBtn: {
    flexShrink: 0,
    width: 22,
    height: 22,
    padding: 0,
    border: '1px solid var(--border)',
    borderRadius: 999,
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: 800,
    cursor: 'help',
    lineHeight: 1,
  },
  sumHelp: { margin: '0.1rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 },
  compliance: { margin: '0 0 0.65rem', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 },
  mainTabs: { display: 'flex', gap: '0.4rem', marginBottom: '0.65rem', flexWrap: 'wrap' },
  tabs: { display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' },
  tab: { border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.75rem', background: 'transparent', cursor: 'pointer', fontWeight: 700 },
  tabOn: { border: '1px solid var(--accent)', borderRadius: 8, padding: '0.45rem 0.75rem', background: 'var(--accent-soft)', cursor: 'pointer', fontWeight: 800 },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 880, fontSize: '0.82rem' },
  th: { textAlign: 'left', padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 800 },
  thNum: { textAlign: 'right', padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 800 },
  td: { padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  tdNum: { padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700, verticalAlign: 'top' },
  tdMono: { padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem', wordBreak: 'break-all' },
  badgeIn: { display: 'inline-block', padding: '0.1rem 0.45rem', borderRadius: 6, background: 'rgba(129,199,132,0.25)', fontWeight: 800, fontSize: '0.75rem' },
  badgeOut: { display: 'inline-block', padding: '0.1rem 0.45rem', borderRadius: 6, background: 'rgba(239,83,80,0.2)', fontWeight: 800, fontSize: '0.75rem' },
  meta: { color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, marginTop: '0.15rem' },
  narrative: { fontSize: '0.78rem', lineHeight: 1.35 },
  empty: { padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' },
  muted: { color: 'var(--text-muted)' },
  trClick: { cursor: 'pointer' },
  trOn: { cursor: 'pointer', background: 'var(--accent-soft)' },
  partyDetail: { marginTop: '0.55rem', display: 'grid', gap: '0.35rem' },
};
