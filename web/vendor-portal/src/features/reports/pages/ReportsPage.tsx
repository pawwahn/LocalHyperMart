import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import { Banner, Button, Card } from '@/shared/ui';
import {
  PAGE_SIZES,
  SortableTh,
  TablePager,
  compareNumber,
  compareText,
  pageWindow,
  toggleSort,
  type SortState,
} from '@/shared/table';
import { formatMoney, type SalesReportRow } from '../api/reportsApi';
import { useVendorReports, isRejectedSalesStatus, type PayoutFilter, type ReportPreset } from '../hooks/useVendorReports';
import type { OrderPayout } from '../api/payoutsApi';

const PRESETS: Array<{ id: ReportPreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'custom', label: 'Custom' },
];

const PAYOUT_FILTERS: Array<{ id: PayoutFilter; label: string }> = [
  { id: 'all', label: 'All orders' },
  { id: 'paid', label: 'Settled' },
  { id: 'unpaid', label: 'Awaiting' },
];

type OrderSortKey = 'placed' | 'order' | 'status' | 'amount' | 'payout' | 'paidAt';

const STATUS_FILTERS = [
  { id: 'all', label: 'All statuses' },
  { id: 'PLACED', label: 'New' },
  { id: 'READY_FOR_PICKUP', label: 'Ready' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'VENDOR_REJECTED', label: 'Rejected' },
] as const;

export function ReportsPage({ active = true }: { active?: boolean }) {
  const {
    preset,
    applyPreset,
    from,
    setFrom,
    to,
    setTo,
    includeItems,
    setIncludeItems,
    payoutFilter,
    setPayoutFilter,
    report,
    visibleRows,
    payoutsBySubOrder,
    payoutSummary,
    settlementMoney,
    moneyClarity,
    loading,
    error,
    reload,
    downloadCsv,
    downloadExcel,
    downloadPdf,
    setPresetCustom,
  } = useVendorReports();
  usePortalChrome({ title: 'Reports', onRefresh: () => void reload() }, active);
  const [productTab, setProductTab] = useState<'top' | 'least'>('top');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [orderQuery, setOrderQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<SortState<OrderSortKey>>({ key: 'placed', dir: 'desc' });

  const filteredRows = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    return visibleRows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${row.orderNumber} ${row.subOrderNumber} ${row.status}`.toLowerCase();
      return hay.includes(q);
    });
  }, [visibleRows, orderQuery, statusFilter]);

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    const dir = sort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const pa = payoutsBySubOrder[a.subOrderId];
      const pb = payoutsBySubOrder[b.subOrderId];
      let cmp = 0;
      switch (sort.key) {
        case 'placed':
          cmp = compareNumber(
            a.placedAt ? Date.parse(a.placedAt) : null,
            b.placedAt ? Date.parse(b.placedAt) : null,
          );
          break;
        case 'order':
          cmp = compareText(a.orderNumber, b.orderNumber);
          break;
        case 'status':
          cmp = compareText(a.status, b.status);
          break;
        case 'amount':
          cmp = compareNumber(a.subtotal, b.subtotal);
          break;
        case 'payout':
          cmp = Number(Boolean(pa?.paid)) - Number(Boolean(pb?.paid));
          break;
        case 'paidAt':
          cmp = compareNumber(
            pa?.paidAt ? Date.parse(pa.paidAt) : null,
            pb?.paidAt ? Date.parse(pb.paidAt) : null,
          );
          break;
        default:
          cmp = 0;
      }
      if (cmp === 0) cmp = compareText(a.orderNumber, b.orderNumber);
      return cmp * dir;
    });
    return rows;
  }, [filteredRows, sort, payoutsBySubOrder]);

  const { total, totalPages, safePage, from: pageFrom, to: pageTo, pageItems } = useMemo(
    () => pageWindow(sortedRows, page, pageSize),
    [sortedRows, page, pageSize],
  );

  useEffect(() => {
    setPage(0);
  }, [orderQuery, statusFilter, payoutFilter, pageSize, sort, from, to, report?.from, report?.to]);

  function isExpanded(id: string) {
    return Boolean(expandedIds[id]);
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function expandAll() {
    const next: Record<string, boolean> = { ...expandedIds };
    for (const row of pageItems) {
      if (row.items && row.items.length > 0) next[row.subOrderId] = true;
    }
    setExpandedIds(next);
  }

  function collapseAll() {
    setExpandedIds({});
  }

  const hasExpandable = pageItems.some((row) => row.items && row.items.length > 0);

  function onSort(column: OrderSortKey) {
    setSort((prev) => toggleSort(prev, column));
  }

  return (
    <>
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Card elevated padding="sm" style={styles.filterCard}>
        <div style={styles.presets}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              style={preset === p.id ? styles.presetActive : styles.preset}
              onClick={() => applyPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' ? (
          <div style={styles.dateRow}>
            <label style={styles.label}>
              From
              <input
                style={styles.input}
                type="date"
                value={from}
                onChange={(e) => {
                  setPresetCustom();
                  setFrom(e.target.value);
                }}
              />
            </label>
            <label style={styles.label}>
              To
              <input
                style={styles.input}
                type="date"
                value={to}
                onChange={(e) => {
                  setPresetCustom();
                  setTo(e.target.value);
                }}
              />
            </label>
          </div>
        ) : (
          <p style={styles.rangeHint}>
            {from} → {to}
          </p>
        )}

        <div style={styles.filterRow}>
          <select
            style={styles.input}
            value={payoutFilter}
            onChange={(e) => setPayoutFilter(e.target.value as PayoutFilter)}
            aria-label="Payout status"
          >
            {PAYOUT_FILTERS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <label style={styles.checkLabel}>
            <input
              type="checkbox"
              checked={includeItems}
              onChange={(e) => setIncludeItems(e.target.checked)}
            />
            Line items in download
          </label>
          <div style={styles.actions}>
            <Button size="sm" onClick={() => void reload()} disabled={loading}>
              {loading ? 'Loading…' : 'Run'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!report || visibleRows.length === 0}
              onClick={downloadCsv}
            >
              CSV
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!report || visibleRows.length === 0}
              onClick={downloadExcel}
            >
              Excel
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!report || visibleRows.length === 0}
              onClick={downloadPdf}
            >
              PDF
            </Button>
          </div>
        </div>
      </Card>

      {report ? (
        <>
          <Card elevated padding="sm" style={styles.summaryCard}>
            <div style={styles.summaryHead}>
              <span style={styles.summaryTitle}>Summary</span>
              <span style={styles.summaryRange}>
                {report.from} → {report.to}
              </span>
            </div>
            <div style={styles.summaryGrid}>
              <Metric label="Orders" value={String(report.orderCount)} hint="Orders in range" />
              <Metric label="Gross" value={formatMoney(report.grossSales)} hint="Shop subtotal" />
              <Metric
                label="Awaiting"
                value={formatMoney(payoutSummary.unpaidAmount)}
                hint={
                  payoutSummary.rejectedOrders > 0
                    ? `${payoutSummary.unpaidOrders} unpaid · ${payoutSummary.rejectedOrders} rejected excluded`
                    : `${payoutSummary.unpaidOrders} unpaid`
                }
              />
              <Metric
                label="Settled"
                value={formatMoney(payoutSummary.paidAmount)}
                hint={`${payoutSummary.paidOrders} paid`}
              />
              <Metric label="Fee" value={moneyClarity.feeLabel} hint="Commission" muted />
              <Metric
                label="Net due"
                value={moneyClarity.netReceivableLabel}
                hint={
                  moneyClarity.pendingClaimDebitTotal > 0
                    ? `After ${formatMoney(moneyClarity.pendingClaimDebitTotal)} claims`
                    : 'Should receive'
                }
                muted
              />
              <Metric
                label="Net paid"
                value={moneyClarity.netReceivedLabel}
                hint={`${settlementMoney.paidCount} settlements`}
                muted
              />
              <Metric label="Units" value={String(report.itemQuantityTotal)} hint="Qty sold" muted />
            </div>
          </Card>

          <Card>
            <div style={styles.productTabs} role="tablist" aria-label="Product performance">
              <button
                type="button"
                role="tab"
                aria-selected={productTab === 'top'}
                style={productTab === 'top' ? styles.productTabActive : styles.productTab}
                onClick={() => setProductTab('top')}
              >
                Top sellers
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={productTab === 'least'}
                style={productTab === 'least' ? styles.productTabActive : styles.productTab}
                onClick={() => setProductTab('least')}
              >
                Least sold
              </button>
            </div>
            {productTab === 'top' ? (
              <ItemRankTable empty="No sold items in this range." rows={report.topSellingItems ?? []} />
            ) : (
              <ItemRankTable empty="No sold items in this range." rows={report.leastSellingItems ?? []} />
            )}
          </Card>

          <Card>
            <div style={styles.ordersHead}>
              <h2 style={styles.sectionTitleTight}>
                Orders ({total}
                {total !== visibleRows.length ? ' filtered' : ''}
                {payoutFilter !== 'all' || statusFilter !== 'all' || orderQuery.trim()
                  ? ` · ${report.rows.length} in range`
                  : ''}
                )
              </h2>
              {hasExpandable ? (
                <div style={styles.expandActions}>
                  <button type="button" style={styles.linkBtn} onClick={expandAll}>
                    Expand page
                  </button>
                  <button type="button" style={styles.linkBtn} onClick={collapseAll}>
                    Collapse all
                  </button>
                </div>
              ) : null}
            </div>

            <div style={styles.orderToolbar}>
              <input
                style={styles.search}
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                placeholder="Search order #, status…"
                aria-label="Search orders"
              />
              <select
                style={styles.input}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Status filter"
              >
                {STATUS_FILTERS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                style={styles.input}
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

            {loading ? (
              <p style={styles.muted}>Loading…</p>
            ) : total === 0 ? (
              <p style={styles.muted}>No orders match this filter.</p>
            ) : (
              <>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {hasExpandable ? <th style={styles.thToggle} aria-label="Expand" /> : null}
                        <SortableTh
                          label="Placed"
                          column="placed"
                          sort={sort}
                          onSort={onSort}
                          style={styles.thSort}
                        />
                        <SortableTh
                          label="Order"
                          column="order"
                          sort={sort}
                          onSort={onSort}
                          style={styles.thSort}
                        />
                        <SortableTh
                          label="Status"
                          column="status"
                          sort={sort}
                          onSort={onSort}
                          style={styles.thSort}
                        />
                        <SortableTh
                          label="Amount"
                          column="amount"
                          sort={sort}
                          onSort={onSort}
                          align="right"
                          style={styles.thSortRight}
                        />
                        <SortableTh
                          label="Payout"
                          column="payout"
                          sort={sort}
                          onSort={onSort}
                          style={styles.thSort}
                        />
                        <SortableTh
                          label="Paid at"
                          column="paidAt"
                          sort={sort}
                          onSort={onSort}
                          style={styles.thSort}
                        />
                        <th style={styles.th}>Mode / txn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((row) => (
                        <OrderRow
                          key={row.subOrderId}
                          row={row}
                          payout={payoutsBySubOrder[row.subOrderId]}
                          hasExpandable={hasExpandable}
                          open={Boolean(row.items?.length) && isExpanded(row.subOrderId)}
                          onToggle={() => toggleExpanded(row.subOrderId)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={styles.pagerWrap}>
                  <TablePager
                    total={total}
                    from={pageFrom}
                    to={pageTo}
                    page={safePage}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </div>
              </>
            )}
          </Card>
        </>
      ) : loading ? (
        <p style={styles.muted}>Loading report…</p>
      ) : null}
    </>
  );
}

function Metric({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: string;
  hint: string;
  muted?: boolean;
}) {
  return (
    <div style={{ ...styles.metric, ...(muted ? styles.metricMuted : null) }} title={hint}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
    </div>
  );
}

function OrderRow({
  row,
  payout,
  hasExpandable,
  open,
  onToggle,
}: {
  row: SalesReportRow;
  payout?: OrderPayout;
  hasExpandable: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const itemCount = row.items?.length ?? 0;
  const canExpand = itemCount > 0;
  const rejected = isRejectedSalesStatus(row.status);
  return (
    <Fragment>
      <tr>
        {hasExpandable ? (
          <td style={styles.tdToggle}>
            {canExpand ? (
              <button
                type="button"
                style={styles.toggleBtn}
                aria-expanded={open}
                aria-label={
                  open
                    ? `Hide ${itemCount} items for ${row.orderNumber}`
                    : `Show ${itemCount} items for ${row.orderNumber}`
                }
                onClick={onToggle}
              >
                {open ? '▾' : '▸'}
              </button>
            ) : (
              <span style={styles.toggleEmpty}>·</span>
            )}
          </td>
        ) : null}
        <td style={styles.tdMuted}>
          {row.placedAt ? new Date(row.placedAt).toLocaleString() : '—'}
        </td>
        <td style={styles.td}>
          <strong>{row.orderNumber}</strong>
          <div style={styles.sub}>{row.subOrderNumber}</div>
          {canExpand ? (
            <button type="button" style={styles.itemPeek} onClick={onToggle}>
              {open ? 'Hide items' : `${itemCount} items · show`}
            </button>
          ) : null}
        </td>
        <td style={styles.tdMuted}>{row.status}</td>
        <td style={styles.tdRight}>{formatMoney(row.subtotal)}</td>
        <td style={styles.td}>
          {rejected ? (
            <span style={styles.rejectedPayout}>NOT PAYABLE</span>
          ) : (
            <span style={payout?.paid ? styles.paid : styles.pending}>
              {payout?.paid ? 'SETTLED' : 'AWAITING'}
            </span>
          )}
        </td>
        <td style={styles.tdMuted}>
          {rejected ? '—' : payout?.paidAt ? new Date(payout.paidAt).toLocaleString() : '—'}
        </td>
        <td style={styles.td}>
          {rejected ? (
            <span style={styles.sub}>Rejected — excluded from payout</span>
          ) : payout?.paid ? (
            <>
              <div>{payout.payoutMethod ?? '—'}</div>
              <div style={styles.sub}>{payout.transactionReference || 'No txn ref'}</div>
              {payout.transactionNotes ? <div style={styles.sub}>{payout.transactionNotes}</div> : null}
            </>
          ) : (
            <span style={styles.sub}>Not paid yet</span>
          )}
        </td>
      </tr>
      {open
        ? row.items!.map((item, idx) => (
            <tr key={`${row.subOrderId}-${idx}`}>
              <td style={styles.td} />
              <td style={styles.td} />
              <td style={styles.tdItem} colSpan={2}>
                {item.quantity}× {item.name}
                {item.unit ? ` (${item.unit})` : ''}
              </td>
              <td style={styles.tdRight}>{formatMoney(item.lineTotal)}</td>
              <td style={styles.td} colSpan={3} />
            </tr>
          ))
        : null}
    </Fragment>
  );
}

function ItemRankTable({
  rows,
  empty,
}: {
  rows: Array<{
    name: string;
    unit?: string | null;
    quantitySold: number;
    revenue: number;
    orderCount: number;
  }>;
  empty: string;
}) {
  if (rows.length === 0) return <p style={styles.muted}>{empty}</p>;
  return (
    <div style={styles.rankWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Item</th>
            <th style={styles.thRight}>Qty</th>
            <th style={styles.thRight}>Revenue</th>
            <th style={styles.thRight}>Orders</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.name}-${row.unit ?? ''}`}>
              <td style={styles.td}>
                <strong>{row.name}</strong>
                {row.unit ? <div style={styles.sub}>{row.unit}</div> : null}
              </td>
              <td style={styles.tdRight}>{row.quantitySold}</td>
              <td style={styles.tdRight}>{formatMoney(row.revenue)}</td>
              <td style={styles.tdRight}>{row.orderCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  orderToolbar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(160px, 1.4fr) minmax(120px, 0.8fr) minmax(100px, 0.6fr)',
    gap: '0.45rem',
    marginBottom: '0.65rem',
  },
  search: {
    padding: '0.45rem 0.6rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.85rem',
    minWidth: 0,
  },
  pagerWrap: { marginTop: '0.65rem' },
  thSort: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    zIndex: 1,
  },
  thSortRight: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    zIndex: 1,
    textAlign: 'right',
  },
  summaryCard: {
    padding: '0.7rem 0.85rem',
    display: 'grid',
    gap: '0.55rem',
  },
  summaryHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  summaryTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '0.95rem',
    fontWeight: 800,
  },
  summaryRange: {
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))',
    gap: '0.35rem 0.5rem',
  },
  metric: {
    display: 'grid',
    gap: '0.1rem',
    minWidth: 0,
    padding: '0.35rem 0.4rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-muted)',
  },
  metricMuted: {
    background: 'transparent',
    border: '1px dashed var(--border)',
  },
  metricLabel: {
    color: 'var(--text-muted)',
    fontSize: '0.68rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  metricValue: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(0.88rem, 2.2vw, 1.05rem)',
    fontWeight: 800,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  filterCard: { display: 'grid', gap: '0.65rem', padding: '0.85rem' },
  sectionTitle: {
    margin: '0 0 0.65rem',
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
  },
  productTabs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.3rem',
    padding: '0.25rem',
    marginBottom: '0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
  },
  productTab: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-md)',
    padding: '0.45rem 0.65rem',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  productTabActive: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '0.45rem 0.65rem',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontWeight: 800,
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-card)',
  },
  sectionTitleTight: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
  },
  ordersHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginBottom: '0.65rem',
  },
  expandActions: { display: 'flex', gap: '0.75rem', alignItems: 'center' },
  thToggle: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.45rem 0.25rem',
    width: 28,
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
  },
  tdToggle: {
    padding: '0.35rem 0.25rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
    width: 28,
  },
  toggleBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent-hover)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 800,
    padding: '0.15rem 0.25rem',
    lineHeight: 1,
    fontFamily: 'inherit',
  },
  toggleEmpty: { color: 'var(--border)', fontSize: '0.85rem' },
  itemPeek: {
    display: 'inline-block',
    marginTop: '0.15rem',
    border: 'none',
    background: 'transparent',
    color: 'var(--accent-hover)',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
  },
  presets: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' },
  preset: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-full)',
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  presetActive: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    borderRadius: 'var(--radius-full)',
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 700,
  },
  dateRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.5rem',
  },
  rangeHint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    alignItems: 'center',
  },
  label: { display: 'grid', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text)',
  },
  input: {
    padding: '0.45rem 0.6rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.85rem',
  },
  actions: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginLeft: 'auto' },
  linkBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent-hover)',
    fontWeight: 700,
    fontSize: '0.82rem',
    cursor: 'pointer',
    padding: '0.15rem 0',
    textAlign: 'left',
    fontFamily: 'inherit',
  },
  rankWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    marginBottom: '0.5rem',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    maxHeight: 'min(58vh, 620px)',
    overflowY: 'auto',
  },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.85rem' },
  th: {
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
  thRight: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.45rem 0.5rem',
    textAlign: 'right',
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
  tdItem: {
    padding: '0.2rem 0.5rem 0.45rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
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
  pending: {
    fontSize: '0.68rem',
    color: '#92400e',
    background: 'var(--warning-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 700,
  },
  rejectedPayout: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    background: 'var(--bg-muted)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 700,
  },
  muted: { margin: 0, color: 'var(--text-muted)' },
};
