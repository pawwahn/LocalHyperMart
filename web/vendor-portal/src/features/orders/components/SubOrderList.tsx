import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Button, Card } from '@/shared/ui';
import { PAGE_SIZES, TablePager, pageWindow } from '@/shared/table';
import type { SubOrderView } from '../api/ordersApi';
import { vendorBagDisplayNumber, vendorBagLabelHint } from '../orderBagLabel';
import { useIsNarrow } from '@/shared/hooks/useIsNarrow';

type Props = {
  orders: SubOrderView[];
  actionId: string | null;
  onReady: (id: string, label: string) => void;
  onDeliveryByVendorAgent: (id: string, label: string) => void;
  onAssignVendorAgent: (id: string, label: string) => void;
  onNotifyAgent: (id: string, label: string) => void;
  onReject: (id: string) => void;
  onCancelItem: (subOrderId: string, itemId: string, itemName: string) => void;
  onRestoreItem: (subOrderId: string, itemId: string, itemName: string, creditLabel: string) => void;
};

export function SubOrderList({
  orders,
  actionId,
  onReady,
  onDeliveryByVendorAgent,
  onAssignVendorAgent,
  onNotifyAgent,
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
      const bagNo = vendorBagDisplayNumber(order);
      const hay = `${bagNo} ${order.subOrderNumber} ${order.orderNumber} ${order.status} ${order.itemSummary}`.toLowerCase();
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
        .vendor-order-toggle:hover { background: color-mix(in srgb, var(--border) 28%, transparent); }
        .vendor-order-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .vendor-order-card {
          padding: 0 !important;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--border) 90%, var(--accent));
        }
        .vendor-order-card--new {
          border-left: 3px solid var(--accent);
        }
        .vendor-order-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          align-items: center;
          padding: 0.55rem 0.75rem;
          border-top: 1px solid var(--border);
          background: color-mix(in srgb, var(--bg) 55%, var(--bg-elevated));
        }
        @media (max-width: 640px) {
          .vendor-order-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
          .vendor-order-actions .vendor-order-actions-primary {
            grid-column: 1 / -1;
          }
        }
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
              const canVendorAgent =
                canAct &&
                order.wholeOrderForShop &&
                order.vendorAgentDeliveryEnabled &&
                !order.vendorAgentDelivery;
              const isCollapsed = !expanded.has(order.id);
              const itemCount = order.items.length;
              const itemLine =
                itemCount > 0
                  ? `${itemCount} item${itemCount === 1 ? '' : 's'}`
                  : order.itemSummary;
              const toggleLabel = isCollapsed ? 'Show items' : 'Hide items';
              const statusStyle = statusStyleFor(order.status);
              const bagNo = vendorBagDisplayNumber(order);
              const bagHint = vendorBagLabelHint(order);
              const needsAgentAssign =
                order.status === 'DELIVERY_BY_VENDOR_AGENT' && order.canAssignVendorAgent;
              const agentAssigned =
                order.status === 'DELIVERY_BY_VENDOR_AGENT' &&
                !order.canAssignVendorAgent &&
                Boolean(order.vendorDirectAgentName);
              const agentAlertPending = order.vendorAgentAlertStatus === 'PENDING';
              const canNotifyAgent = agentAssigned && !agentAlertPending && !busy;
              return (
                <Card
                  key={order.id}
                  elevated
                  style={needsAgentAssign ? { ...styles.row, ...styles.rowNeedsAgent } : styles.row}
                  className={`vendor-order-card${canAct ? ' vendor-order-card--new' : ''}${needsAgentAssign ? ' vendor-order-card--needs-agent' : ''}`}
                >
                  <div style={styles.body}>
                    <button
                      type="button"
                      className="vendor-order-toggle"
                      style={styles.headerBtn}
                      onClick={() => toggleExpanded(order.id)}
                      aria-expanded={!isCollapsed}
                      aria-label={`${toggleLabel} for ${bagNo}`}
                    >
                      <span style={styles.chevron} aria-hidden>{isCollapsed ? '▸' : '▾'}</span>
                      <span style={styles.headerMain}>
                        <span style={styles.titleRow}>
                          <span style={{ ...styles.orderNo, ...(narrow ? styles.orderNoNarrow : null) }}>
                            {bagNo}
                          </span>
                          <span style={{ ...styles.statusPill, ...statusStyle }}>{statusLabel(order.status)}</span>
                        </span>
                        <span style={styles.meta}>Parent {order.orderNumber}</span>
                        {bagHint ? <span style={styles.bagHint}>{bagHint}</span> : null}
                        <span style={styles.summaryRow}>
                          <strong style={styles.amount}>{order.subtotalLabel}</strong>
                          {isCollapsed && itemLine ? (
                            <span style={styles.metaDot}>·</span>
                          ) : null}
                          {isCollapsed && itemLine ? <span style={styles.itemCount}>{itemLine}</span> : null}
                          <span style={styles.metaDot}>·</span>
                          <span style={styles.placedAt} title={order.placedAt}>
                            {order.placedAtLabel}
                          </span>
                        </span>
                      </span>
                      <span style={styles.togglePill}>{toggleLabel}</span>
                    </button>

                    {!isCollapsed && order.items.length > 0 ? (
                      <ul style={{ ...styles.itemList, ...(narrow ? null : styles.itemListInset) }}>
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
                  {canAct || order.status === 'DELIVERY_BY_VENDOR_AGENT' ? (
                    <div className="vendor-order-actions">
                      {canAct ? (
                        <Button
                          className="vendor-order-actions-primary"
                          size="sm"
                          disabled={busy}
                          onClick={() => onReady(order.id, bagNo)}
                        >
                          {busy ? '…' : 'Mark ready'}
                        </Button>
                      ) : null}
                      {canVendorAgent ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => onDeliveryByVendorAgent(order.id, bagNo)}
                        >
                          My agent delivers
                        </Button>
                      ) : null}
                      {canAct ? (
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onReject(order.id)}>
                          Reject
                        </Button>
                      ) : null}
                      {order.status === 'DELIVERY_BY_VENDOR_AGENT' ? (
                        <>
                          <span
                            style={{
                              ...styles.statusPill,
                              ...(needsAgentAssign ? styles.statusPillUrgent : statusStyleFor('DELIVERY_BY_VENDOR_AGENT')),
                            }}
                          >
                            {needsAgentAssign ? 'Assign agent required' : 'Vendor agent'}
                          </span>
                          {order.vendorDirectAgentName ? (
                            <span style={styles.agentAssigned}>
                              {order.vendorDirectAgentName}
                              {order.vendorDirectAgentPhone ? ` · ${order.vendorDirectAgentPhone}` : ''}
                            </span>
                          ) : needsAgentAssign ? (
                            <span style={styles.agentAssigned}>No agent yet — tap Assign below</span>
                          ) : null}
                          {order.canAssignVendorAgent ? (
                            <Button
                              className="vendor-order-actions-primary"
                              size="sm"
                              disabled={busy}
                              onClick={() => onAssignVendorAgent(order.id, bagNo)}
                            >
                              Assign agent
                            </Button>
                          ) : null}
                          {agentAssigned ? (
                            agentAlertPending ? (
                              <span style={styles.waitAgent}>Waiting for agent notice</span>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={!canNotifyAgent}
                                onClick={() => onNotifyAgent(order.id, bagNo)}
                              >
                                Notify agent
                              </Button>
                            )
                          ) : null}
                        </>
                      ) : null}
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
      return 'New';
    case 'READY_FOR_PICKUP':
      return 'Ready';
    case 'DELIVERY_BY_VENDOR_AGENT':
      return 'Vendor agent';
    default:
      return status.replace(/_/g, ' ');
  }
}

function statusStyleFor(status: string): CSSProperties {
  switch (status) {
    case 'PLACED':
      return styles.statusNew;
    case 'READY_FOR_PICKUP':
      return styles.statusReady;
    case 'DELIVERY_BY_VENDOR_AGENT':
      return styles.statusAgent;
    default:
      return styles.statusDefault;
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
  list: { display: 'grid', gap: '0.55rem' },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    minWidth: 0,
  },
  rowNeedsAgent: {
    outline: '2px solid #d97706',
    outlineOffset: -1,
  },
  body: { display: 'grid', gap: '0.15rem', minWidth: 0, padding: '0.65rem 0.75rem 0.5rem' },
  headerBtn: {
    display: 'flex',
    gap: '0.45rem',
    alignItems: 'flex-start',
    width: '100%',
    margin: 0,
    padding: '0.25rem 0.15rem',
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
    fontSize: '0.7rem',
    fontWeight: 750,
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    padding: '0.22rem 0.45rem',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
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
    alignItems: 'center',
    gap: '0.45rem',
    flexWrap: 'wrap',
  },
  orderNo: {
    fontWeight: 800,
    fontFamily: 'var(--font-display)',
    fontSize: '0.98rem',
    overflowWrap: 'anywhere',
    letterSpacing: '-0.01em',
  },
  orderNoNarrow: { fontSize: '0.92rem' },
  summaryRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.82rem',
  },
  amount: { fontWeight: 800, color: 'var(--text)', fontSize: '0.88rem' },
  itemCount: { color: 'var(--text-muted)', fontWeight: 650 },
  metaDot: { color: 'var(--text-muted)', fontWeight: 700 },
  placedAt: {
    fontWeight: 650,
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  meta: { color: 'var(--text-muted)', fontSize: '0.78rem' },
  bagHint: { color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.35, display: 'block' },
  statusPill: {
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '0.18rem 0.45rem',
    borderRadius: 999,
    lineHeight: 1.2,
  },
  statusNew: {
    color: 'var(--accent-hover)',
    background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
  },
  statusReady: {
    color: '#0f766e',
    background: 'color-mix(in srgb, #0d9488 12%, transparent)',
  },
  statusAgent: {
    color: '#6d28d9',
    background: 'color-mix(in srgb, #7c3aed 12%, transparent)',
  },
  statusPillUrgent: {
    color: '#92400e',
    background: 'var(--warning-soft)',
    border: '1px solid #d97706',
  },
  statusDefault: {
    color: 'var(--text-muted)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
  },
  itemList: { margin: '0.25rem 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: '0.3rem' },
  itemListInset: {
    marginLeft: '1.35rem',
    padding: '0.45rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    flexWrap: 'wrap',
    alignItems: 'center',
    fontSize: '0.85rem',
  },
  itemCancelled: { textDecoration: 'line-through', color: 'var(--text-muted)' },
  agentAssigned: {
    fontSize: '0.78rem',
    fontWeight: 650,
    color: 'var(--text-muted)',
    flex: '1 1 12rem',
  },
  waitAgent: {
    fontSize: '0.78rem',
    fontWeight: 800,
    color: '#7c3aed',
    flex: '1 1 10rem',
  },
  emptyCard: { textAlign: 'center', padding: '1.25rem' },
  emptyTitle: { margin: 0, fontWeight: 800, fontFamily: 'var(--font-display)' },
  empty: { margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' },
};
