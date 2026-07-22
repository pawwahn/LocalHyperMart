import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import { Banner, Card } from '@/shared/ui';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { fetchSalesReport, formatMoney } from '@/features/reports/api/reportsApi';
import {
  listMyClaimAdjustments,
  listMySettlements,
  lookupOrderPayouts,
  summarizeSettlements,
  type VendorClaimAdjustment,
  type VendorSettlement,
} from '@/features/reports/api/payoutsApi';
import {
  PAGE_SIZES,
  SortableTh,
  TablePager,
  compareText,
  pageWindow,
  toggleSort,
  type SortState,
} from '@/shared/table';
import { ClaimDeductionsDialog } from '@/features/payouts/components/ClaimDeductionsDialog';

type SortKey = 'period' | 'gross' | 'fee' | 'net' | 'status' | 'paidAt';

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function PayoutsPage() {
  const { session } = useAuth();
  const [settlements, setSettlements] = useState<VendorSettlement[]>([]);
  const [claimAdjustments, setClaimAdjustments] = useState<VendorClaimAdjustment[]>([]);
  const [salesAwaitingNet, setSalesAwaitingNet] = useState(0);
  const [salesAwaitingOrders, setSalesAwaitingOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'PAID' | 'OPEN'>('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<SortState<SortKey>>({ key: 'period', dir: 'desc' });
  const [claimsOpen, setClaimsOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [list, sales, adjustmentsResult] = await Promise.all([
        listMySettlements(session.accessToken, session.vendorId),
        fetchSalesReport(session.accessToken, session.vendorId, {
          from: isoDaysAgo(60),
          to: isoToday(),
          includeItems: false,
        }),
        listMyClaimAdjustments(session.accessToken, session.vendorId).catch(() => [] as VendorClaimAdjustment[]),
      ]);
      setSettlements(list);
      setClaimAdjustments(adjustmentsResult);

      const payouts = await lookupOrderPayouts(
        session.accessToken,
        session.vendorId,
        (sales.rows ?? []).map((r) => r.subOrderId),
      );
      let waiting = 0;
      let waitingOrders = 0;
      for (const row of sales.rows ?? []) {
        if (row.status === 'VENDOR_REJECTED' || row.status === 'REJECTED') continue;
        if (!payouts[row.subOrderId]?.paid) {
          waiting += Number(row.subtotal ?? 0);
          waitingOrders += 1;
        }
      }
      setSalesAwaitingNet(waiting);
      setSalesAwaitingOrders(waitingOrders);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load payouts');
      setSalesAwaitingNet(0);
      setSalesAwaitingOrders(0);
      setClaimAdjustments([]);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const settlementSummary = useMemo(() => summarizeSettlements(settlements), [settlements]);

  const pendingClaimDebits = useMemo(
    () => claimAdjustments.filter((a) => a.status === 'PENDING'),
    [claimAdjustments],
  );
  const pendingClaimDebitTotal = useMemo(
    () => pendingClaimDebits.reduce((sum, a) => sum + Number(a.amount ?? 0), 0),
    [pendingClaimDebits],
  );

  /** Prefer open settlement batches; otherwise unpaid shop sales (last 60 days). */
  const awaitingGross =
    settlementSummary.awaitingSettlementNet > 0
      ? settlementSummary.awaitingSettlementNet
      : salesAwaitingNet;
  /** What vendor should expect after pending claim chargebacks (commission still separate). */
  const awaitingNet = Math.max(0, awaitingGross - pendingClaimDebitTotal);
  const awaitingHint =
    settlementSummary.awaitingCount > 0
      ? pendingClaimDebitTotal > 0
        ? `${settlementSummary.awaitingCount} open · after ${formatMoney(pendingClaimDebitTotal)} claims`
        : `${settlementSummary.awaitingCount} open settlement${settlementSummary.awaitingCount === 1 ? '' : 's'}`
      : pendingClaimDebitTotal > 0
        ? `${salesAwaitingOrders} unpaid · ${formatMoney(awaitingGross)} − ${formatMoney(pendingClaimDebitTotal)} claims`
        : `${salesAwaitingOrders} unpaid order${salesAwaitingOrders === 1 ? '' : 's'} (60d)`;

  const filtered = useMemo(() => {
    return settlements.filter((s) => {
      if (statusFilter === 'PAID') return s.status === 'PAID';
      if (statusFilter === 'OPEN') return s.status !== 'PAID';
      return true;
    });
  }, [settlements, statusFilter]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    const dir = sort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case 'period':
          cmp = compareText(a.periodEnd ?? a.periodStart ?? '', b.periodEnd ?? b.periodStart ?? '');
          break;
        case 'gross':
          cmp = Number(a.grossAmount) - Number(b.grossAmount);
          break;
        case 'fee':
          cmp = Number(a.commissionAmount) - Number(b.commissionAmount);
          break;
        case 'net':
          cmp = Number(a.netAmount) - Number(b.netAmount);
          break;
        case 'status':
          cmp = compareText(a.status, b.status);
          break;
        case 'paidAt':
          cmp = compareText(a.paidAt ?? '', b.paidAt ?? '');
          break;
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
    return rows;
  }, [filtered, sort]);

  const { total, totalPages, safePage, from, to, pageItems } = useMemo(
    () => pageWindow(sorted, page, pageSize),
    [sorted, page, pageSize],
  );

  useEffect(() => {
    setPage(0);
  }, [statusFilter, pageSize, sort]);

  usePortalChrome({ title: 'Payouts', onRefresh: () => void reload() });

  return (
    <div
        style={{
          ...styles.pageStack,
          ['--metric-paid' as string]: 'var(--success, #15803d)',
          ['--metric-awaiting' as string]: 'var(--warning, #c2410c)',
          ['--metric-commission' as string]: 'var(--danger, #dc2626)',
          ['--metric-claim' as string]: '#7c3aed',
        }}
      >
        {error ? <Banner tone="danger">{error}</Banner> : null}

        <div style={styles.summary}>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Net paid</span>
            <strong style={{ ...styles.metricValue, color: 'var(--metric-paid)' }}>
              {formatMoney(settlementSummary.paidNet)}
            </strong>
            <span style={styles.metricHint}>
              {settlementSummary.paidCount > 0
                ? `${settlementSummary.paidCount} settlement${settlementSummary.paidCount === 1 ? '' : 's'}`
                : 'None marked paid yet'}
            </span>
          </div>

          <div style={styles.metric}>
            <span style={styles.metricLabel}>Awaiting payout</span>
            <strong style={{ ...styles.metricValue, color: 'var(--metric-awaiting)' }}>
              {formatMoney(awaitingNet)}
            </strong>
            <span style={styles.metricHint}>{awaitingHint}</span>
          </div>

          <div style={styles.metric}>
            <span style={styles.metricLabel}>Commission</span>
            <strong style={styles.metricValueCommission}>
              {formatMoney(settlementSummary.paidCommission)}
            </strong>
            <span style={styles.metricHint}>
              {settlementSummary.paidCount > 0 ? 'On paid settlements' : 'After hub marks paid'}
            </span>
          </div>

          <div style={styles.metric}>
            <span style={styles.metricLabel}>Claim deductions</span>
            <strong style={{ ...styles.metricValueClaim, color: 'var(--metric-claim)' }}>
              {formatMoney(pendingClaimDebitTotal)}
            </strong>
            {claimAdjustments.length > 0 ? (
              <button
                type="button"
                style={styles.claimToggle}
                aria-haspopup="dialog"
                aria-expanded={claimsOpen}
                onClick={() => setClaimsOpen(true)}
              >
                {pendingClaimDebits.length > 0
                  ? `View ${pendingClaimDebits.length} pending`
                  : 'View claim history'}
              </button>
            ) : (
              <span style={styles.metricHint}>No open chargebacks</span>
            )}
          </div>
        </div>

        <ClaimDeductionsDialog
          open={claimsOpen}
          items={claimAdjustments}
          onClose={() => setClaimsOpen(false)}
        />

        <Card padding="sm" style={styles.settlementsCard}>
          <div style={styles.sectionHead}>
            <h2 style={styles.sectionTitle}>Settlements</h2>
            <div style={styles.toolbar}>
              <select
                style={styles.select}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'PAID' | 'OPEN')}
                aria-label="Settlement status"
              >
                <option value="all">All</option>
                <option value="PAID">Paid</option>
                <option value="OPEN">Open</option>
              </select>
              <select
                style={styles.select}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                aria-label="Rows per page"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading && settlements.length === 0 ? (
            <p style={styles.muted}>Loading…</p>
          ) : total === 0 ? (
            <p style={styles.empty}>
              No batches yet — hub creates one when they pay you. Awaiting above is unpaid shop sales.
            </p>
          ) : (
            <>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <SortableTh label="Period" column="period" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} style={styles.th} />
                      <SortableTh label="Gross" column="gross" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} align="right" style={styles.th} />
                      <SortableTh label="Fee" column="fee" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} align="right" style={styles.th} />
                      <SortableTh label="Net" column="net" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} align="right" style={styles.th} />
                      <SortableTh label="Status" column="status" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} style={styles.th} />
                      <SortableTh label="Paid at" column="paidAt" sort={sort} onSort={(c) => setSort((p) => toggleSort(p, c))} style={styles.th} />
                      <th style={styles.thPlain}>Mode / txn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((s) => (
                      <tr key={s.id}>
                        <td style={styles.td}>
                          {s.periodStart ?? '—'} → {s.periodEnd ?? '—'}
                          {s.periodType ? <div style={styles.sub}>{s.periodType}</div> : null}
                        </td>
                        <td style={styles.tdRight}>{formatMoney(s.grossAmount)}</td>
                        <td style={styles.tdRight}>{formatMoney(s.commissionAmount)}</td>
                        <td style={styles.tdRight}>{formatMoney(s.netAmount)}</td>
                        <td style={styles.td}>
                          <span style={s.status === 'PAID' ? styles.paid : styles.open}>{s.status}</span>
                        </td>
                        <td style={styles.tdMuted}>
                          {s.paidAt ? new Date(s.paidAt).toLocaleString() : '—'}
                        </td>
                        <td style={styles.td}>
                          {s.status === 'PAID' ? (
                            <>
                              <div>{s.payoutMethod ?? '—'}</div>
                              <div style={styles.sub}>{s.transactionReference || 'No txn ref'}</div>
                            </>
                          ) : (
                            <span style={styles.sub}>Not paid yet</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={styles.pager}>
                <TablePager
                  total={total}
                  from={from}
                  to={to}
                  page={safePage}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </Card>
      </div>
  );
}

const styles: Record<string, CSSProperties> = {
  pageStack: { display: 'grid', gap: '0.55rem' },
  summary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 10.5rem), 1fr))',
    gap: '0.45rem',
  },
  metric: {
    display: 'grid',
    gap: '0.08rem',
    alignContent: 'start',
    padding: '0.55rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    minHeight: '4.6rem',
  },
  metricLabel: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  },
  metricValue: { fontFamily: 'var(--font-display)', fontSize: '1.45rem', fontWeight: 800, lineHeight: 1.1 },
  metricValueCommission: {
    fontFamily: 'var(--font-display)',
    fontSize: '0.78rem',
    fontWeight: 700,
    lineHeight: 1.2,
    color: 'var(--metric-commission)',
  },
  metricValueClaim: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.15rem',
    fontWeight: 800,
    lineHeight: 1.15,
  },
  metricHint: { fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 },
  claimToggle: {
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'none',
    color: 'var(--metric-claim)',
    fontSize: '0.7rem',
    fontWeight: 700,
    textAlign: 'left',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
  settlementsCard: { display: 'grid', gap: '0.5rem', padding: '0.65rem 0.75rem' },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  sectionTitle: { margin: 0, fontSize: '0.92rem', fontWeight: 800 },
  toolbar: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' },
  select: {
    padding: '0.3rem 0.45rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.8rem',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    maxHeight: 'min(48vh, 520px)',
    overflowY: 'auto',
  },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.85rem' },
  th: { position: 'sticky', top: 0, background: 'var(--bg-muted)', zIndex: 1 },
  thPlain: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.4rem 0.45rem',
    textAlign: 'left',
    fontWeight: 700,
    color: 'var(--text-muted)',
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
  },
  td: { padding: '0.35rem 0.45rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  tdMuted: {
    padding: '0.35rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    verticalAlign: 'top',
  },
  tdRight: {
    padding: '0.35rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontWeight: 600,
    verticalAlign: 'top',
  },
  sub: { color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500 },
  paid: {
    fontSize: '0.68rem',
    color: '#047857',
    background: 'var(--success-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 700,
  },
  open: {
    fontSize: '0.68rem',
    color: '#92400e',
    background: 'var(--warning-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 700,
  },
  pager: { marginTop: '0.2rem' },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' },
  empty: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.4 },
};
