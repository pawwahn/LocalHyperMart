import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Banner, Card } from '@/shared/ui';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { fetchSalesReport, formatMoney } from '@/features/reports/api/reportsApi';
import {
  listMySettlements,
  lookupOrderPayouts,
  summarizeSettlements,
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
  const [salesAwaitingNet, setSalesAwaitingNet] = useState(0);
  const [salesAwaitingOrders, setSalesAwaitingOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'PAID' | 'OPEN'>('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<SortState<SortKey>>({ key: 'period', dir: 'desc' });

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [list, sales] = await Promise.all([
        listMySettlements(session.accessToken, session.vendorId),
        fetchSalesReport(session.accessToken, session.vendorId, {
          from: isoDaysAgo(60),
          to: isoToday(),
          includeItems: false,
        }),
      ]);
      setSettlements(list);

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
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const settlementSummary = useMemo(() => summarizeSettlements(settlements), [settlements]);

  /** Prefer open settlement batches; otherwise unpaid shop sales (last 60 days). */
  const awaitingNet =
    settlementSummary.awaitingSettlementNet > 0
      ? settlementSummary.awaitingSettlementNet
      : salesAwaitingNet;
  const awaitingHint =
    settlementSummary.awaitingCount > 0
      ? `${settlementSummary.awaitingCount} open settlement${settlementSummary.awaitingCount === 1 ? '' : 's'}`
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

  return (
    <PortalShell title="Payouts" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <div style={styles.summary}>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>Net paid</span>
          <strong style={styles.metricValue}>{formatMoney(settlementSummary.paidNet)}</strong>
          <span style={styles.metricHint}>
            {settlementSummary.paidCount > 0
              ? `${settlementSummary.paidCount} settlement${settlementSummary.paidCount === 1 ? '' : 's'}`
              : 'No payouts marked paid yet'}
          </span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>Awaiting payout</span>
          <strong style={styles.metricValue}>{formatMoney(awaitingNet)}</strong>
          <span style={styles.metricHint}>{awaitingHint}</span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>Fees paid</span>
          <strong style={styles.metricValue}>{formatMoney(settlementSummary.paidCommission)}</strong>
          <span style={styles.metricHint}>Taken when hub marks a settlement paid</span>
        </div>
      </div>

      <Card>
        <div style={styles.toolbar}>
          <select
            style={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'PAID' | 'OPEN')}
            aria-label="Settlement status"
          >
            <option value="all">All settlements</option>
            <option value="PAID">Paid</option>
            <option value="OPEN">Awaiting / draft</option>
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

        {loading && settlements.length === 0 ? (
          <p style={styles.muted}>Loading payouts…</p>
        ) : total === 0 ? (
          <p style={styles.muted}>
            No payout batches yet. Awaiting above is from unpaid shop sales; hub creates a settlement
            when they pay you.
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
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  summary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.5rem',
  },
  metric: {
    display: 'grid',
    gap: '0.1rem',
    padding: '0.65rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  metricLabel: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' },
  metricValue: { fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800 },
  metricHint: { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 },
  toolbar: { display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.75rem' },
  select: {
    padding: '0.45rem 0.6rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.85rem',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    maxHeight: 'min(58vh, 620px)',
    overflowY: 'auto',
  },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.85rem' },
  th: { position: 'sticky', top: 0, background: 'var(--bg-muted)', zIndex: 1 },
  thPlain: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.45rem 0.5rem',
    textAlign: 'left',
    fontWeight: 700,
    color: 'var(--text-muted)',
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
  },
  td: { padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  tdMuted: {
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    verticalAlign: 'top',
  },
  tdRight: {
    padding: '0.4rem 0.5rem',
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
  pager: { marginTop: '0.65rem' },
  muted: { margin: 0, color: 'var(--text-muted)' },
};
