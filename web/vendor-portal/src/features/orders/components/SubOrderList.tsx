import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Button, Card } from '@/shared/ui';
import { PAGE_SIZES, TablePager, pageWindow } from '@/shared/table';
import type { SubOrderView } from '../api/ordersApi';

type Props = {
  orders: SubOrderView[];
  actionId: string | null;
  onReady: (id: string) => void;
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
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

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
      <div style={styles.toolbar}>
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
              return (
                <Card key={order.id} elevated style={styles.row}>
                  <div style={styles.body}>
                    <p style={styles.orderNo}>{order.subOrderNumber}</p>
                    <p style={styles.meta}>Parent {order.orderNumber}</p>
                    <p style={styles.meta}>
                      <span style={styles.badge}>{statusLabel(order.status)}</span> ·{' '}
                      {order.subtotalLabel}
                    </p>

                    {order.items.length > 0 ? (
                      <ul style={styles.itemList}>
                        {order.items.map((item) => (
                          <li key={item.orderItemId} style={styles.itemRow}>
                            <span style={item.cancelled ? styles.itemCancelled : undefined}>
                              {item.quantity}
                              {item.unitCode ? ` ${item.unitCode.toLowerCase()}` : ''} × {item.name}
                              {' · '}
                              {item.lineTotalLabel}
                              {item.cancelled ? ' · cancelled' : ''}
                            </span>
                            {canAct && !item.cancelled ? (
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
                    ) : (
                      <p style={styles.meta}>{order.itemSummary}</p>
                    )}
                  </div>
                  {canAct ? (
                    <div style={styles.actions}>
                      <Button size="sm" disabled={busy} onClick={() => onReady(order.id)}>
                        {busy ? '…' : 'Mark ready'}
                      </Button>
                      <Button variant="danger" size="sm" disabled={busy} onClick={() => onReject(order.id)}>
                        Reject all
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
  wrap: { display: 'grid', gap: '0.75rem' },
  toolbar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(160px, 1fr) auto',
    gap: '0.45rem',
  },
  search: {
    padding: '0.5rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.85rem',
  },
  select: {
    padding: '0.5rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.85rem',
  },
  list: { display: 'grid', gap: '0.75rem' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    padding: '0.9rem 1rem',
  },
  body: { display: 'grid', gap: '0.25rem', minWidth: 0, flex: 1 },
  orderNo: { margin: 0, fontWeight: 800, fontFamily: 'var(--font-display)' },
  meta: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' },
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
  emptyCard: { textAlign: 'center', padding: '1.25rem' },
  emptyTitle: { margin: 0, fontWeight: 800, fontFamily: 'var(--font-display)' },
  empty: { margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' },
};
