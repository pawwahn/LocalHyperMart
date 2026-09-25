import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Button, Card } from '@/shared/ui';
import { PAGE_SIZES, TablePager, pageWindow } from '@/shared/table';
import type { SubOrderView } from '../api/ordersApi';
import { useIsNarrow } from '@/shared/hooks/useIsNarrow';

type Props = {
  orders: SubOrderView[];
  actionId: string | null;
  onReady: (id: string, label: string) => void;
  onReject: (id: string) => void;
  onCancelItem: (subOrderId: string, itemId: string, itemName: string) => void;
  onRestoreItem: (subOrderId: string, itemId: string, itemName: string, creditLabel: string) => void;
};

export function SubOrderList({
  orders,
  actionId,
  onReady,
  onReject,
  onCancelItem,
  onRestoreItem,
}: Props) {
  const narrow = useIsNarrow();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  /** Empty = every order starts collapsed (minimized). */
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  function toggleExpanded(orderId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) => {
      const hay = `${order.subOrderNumber} ${order.orderNumber} ${order.status} ${order.itemSummary}`.toLowerCase();
      return hay.includes(q);
    });
  }, [orders, query]);

  const { total, totalPages, safePage, from, to, pageItems } = useMemo(
    () => pageWindow(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  useEffect(() => {
    setPage(0);
  }, [query, pageSize, orders]);

  if (orders.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <p style={styles.emptyTitle}>No orders for this filter</p>
        <p style={styles.empty}>New orders will appear here for packing.</p>
      </Card>
    );
  }

  return (
    <div style={styles.wrap}>
      <style>{`
        .vendor-order-toggle:hover { background: color-mix(in srgb, var(--border) 35%, transparent); }
        .vendor-order-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      `}</style>
      <div style={{ ...styles.toolbar, ...(narrow ? styles.toolbarNarrow : null) }}>
        <input
          style={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search order #, items…"
          aria-label="Search orders"
        />
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

      {total === 0 ? (
        <Card style={styles.emptyCard}>
          <p style={styles.emptyTitle}>No matches</p>
          <p style={styles.empty}>Try another search.</p>
        </Card>
      ) : (
        <>
          <div style={styles.list}>
            {pageItems.map((order) => {
              const busy = actionId === order.id || actionId?.startsWith(`${order.id}:`);
              const canAct = order.status === 'PLACED';
              const isCollapsed = !expanded.has(order.id);
              const itemCount = order.items.length;
              const itemLine =
                itemCount > 0
                  ? `${itemCount} item${itemCount === 1 ? '' : 's'}`
                  : order.itemSummary;
              const toggleLabel = isCollapsed ? 'Show items' : 'Hide items';
              return (
                <Card key={order.id} elevated style={styles.row}>
                  <div style={styles.body}>
                    <button
                      type="button"
                      className="vendor-order-toggle"
                      style={styles.headerBtn}
                      onClick={() => toggleExpanded(order.id)}
                      aria-expanded={!isCollapsed}
                      aria-label={`${toggleLabel} for ${order.subOrderNumber}`}
                    >
                      <span style={styles.chevron} aria-hidden>{isCollapsed ? '▸' : '▾'}</span>
                      <span style={styles.headerMain}>
                        <span style={styles.titleRow}>
                          <span style={{ ...styles.orderNo, ...(narrow ? styles.orderNoNarrow : null) }}>
                            {order.subOrderNumber}
                          </span>
                          <span style={styles.placedAt} title={order.placedAt}>
                            Placed {order.placedAtLabel}
                          </span>
                        </span>
                        <span style={styles.meta}>Parent {order.orderNumber}</span>
                        <span style={styles.meta}>
                          <span style={styles.badge}>{statusLabel(order.status)}</span> ·{' '}
                          {order.subtotalLabel}
                          {isCollapsed && itemLine ? ` · ${itemLine}` : ''}
                        </span>
                      </span>
                      <span style={styles.togglePill}>{toggleLabel}</span>
                    </button>

                    {!isCollapsed && order.items.length > 0 ? (
                      <ul style={styles.itemList}>
                        {order.items.map((item) => (
                          <li key={item.orderItemId} style={styles.itemRow}>
                            <span style={item.cancelled ? styles.itemCancelled : undefined}>
                              {item.name} × {item.quantity}
                              {' · '}
                              {item.lineTotalLabel}
                              {item.cancelled
                                ? item.cancelledByBuyer
                                  ? ' · cancelled by buyer'
                                  : ' · cancelled'
                                : ''}
                            </span>
                            {item.canCancel ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => onCancelItem(order.id, item.orderItemId, item.name)}
                              >
                                Cancel item
                              </Button>
                            ) : null}
                            {item.canRestore ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  onRestoreItem(
                                    order.id,
                                    item.orderItemId,
                                    item.name,
                                    item.storeCreditAmount != null
                                      ? `₹${Number(item.storeCreditAmount).toFixed(2)}`
                                      : item.lineTotalLabel,
                                  )
                                }
                              >
                                Restore
                              </Button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : !isCollapsed ? (
                      <p style={styles.meta}>{order.itemSummary}</p>
                    ) : null}
                  </div>
                  {canAct ? (
                    <div style={{ ...styles.actions, ...(narrow ? styles.actionsNarrow : null) }}>
                      <Button
                        size="sm"
                        fullWidth={narrow}
                        disabled={busy}
                        onClick={() => onReady(order.id, order.subOrderNumber)}
                      >
                        {busy ? '…' : 'Mark ready'}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        fullWidth={narrow}
                        disabled={busy}
                        onClick={() => onReject(order.id)}
                      >
                        Reject my items
                      </Button>
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
          <TablePager
            total={total}
            from={from}
            to={to}
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case 'PLACED':
      return 'NEW';
    case 'READY_FOR_PICKUP':
      return 'READY';
    default:
      return status;
  }
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.75rem', minWidth: 0 },
  toolbar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(160px, 1fr) auto',
    gap: '0.45rem',
  },
  toolbarNarrow: {
    gridTemplateColumns: '1fr',
  },
  search: {
    padding: '0.5rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.85rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  select: {
    padding: '0.5rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.85rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  list: { display: 'grid', gap: '0.75rem' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
    padding: '0.9rem 1rem',
  },
  body: { display: 'grid', gap: '0.25rem', minWidth: 0, flex: '1 1 14rem' },
  headerBtn: {
    display: 'flex',
    gap: '0.45rem',
    alignItems: 'flex-start',
    width: '100%',
    margin: 0,
    padding: '0.35rem 0.4rem',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-md)',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
    color: 'inherit',
    font: 'inherit',
  },
  togglePill: {
    flex: '0 0 auto',
    alignSelf: 'center',
    marginLeft: 'auto',
    fontSize: '0.72rem',
    fontWeight: 800,
    color: 'var(--accent-hover)',
    whiteSpace: 'nowrap',
    padding: '0.28rem 0.5rem',
    borderRadius: 999,
    border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--border))',
    background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))',
  },
  chevron: {
    flex: '0 0 auto',
    fontWeight: 800,
    fontSize: '0.9rem',
    lineHeight: 1.35,
    color: 'var(--text-muted)',
  },
  headerMain: { display: 'grid', gap: '0.2rem', minWidth: 0, flex: 1 },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  orderNo: {
    fontWeight: 800,
    fontFamily: 'var(--font-display)',
    overflowWrap: 'anywhere',
  },
  orderNoNarrow: { fontSize: '0.95rem' },
  placedAt: {
    fontWeight: 700,
    fontSize: '0.82rem',
    color: 'var(--text)',
  },
  meta: { color: 'var(--text-muted)', fontSize: '0.82rem' },
  badge: {
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.02em',
    color: 'var(--accent-hover)',
  },
  itemList: { margin: '0.35rem 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: '0.25rem' },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    flexWrap: 'wrap',
    alignItems: 'center',
    fontSize: '0.85rem',
  },
  itemCancelled: { textDecoration: 'line-through', color: 'var(--text-muted)' },
  actions: { display: 'flex', gap: '0.4rem', alignItems: 'flex-start', flexWrap: 'wrap' },
  actionsNarrow: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.4rem',
  },
  emptyCard: { textAlign: 'center', padding: '1.25rem' },
  emptyTitle: { margin: 0, fontWeight: 800, fontFamily: 'var(--font-display)' },
  empty: { margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' },
};
