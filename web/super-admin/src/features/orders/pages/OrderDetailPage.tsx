import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button } from '@/shared/ui';
import {
  fetchAdminOrderDetail,
  formatWhen,
  labelEvent,
  labelLeg,
  labelStatus,
  money,
  type AdminOrderDetail,
} from '../api/ordersApi';

export function OrderDetailPage() {
  const { orderId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const townId = searchParams.get('townId') ?? '';
  const { session } = useAuth();
  const token = session?.accessToken ?? '';

  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token || !townId || !orderId) {
      setOrder(null);
      setLoading(false);
      setError(!townId ? 'Missing townId' : 'Missing order');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setOrder(await fetchAdminOrderDetail(token, townId, orderId));
    } catch (err) {
      setOrder(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [token, townId, orderId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const backTo = townId ? `/orders?townId=${encodeURIComponent(townId)}` : '/orders';

  return (
    <PortalShell title="Order" onRefresh={() => void reload()}>
      <div style={styles.topBar}>
        <Link to={backTo} style={styles.back}>
          ← Orders
        </Link>
      </div>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading && !order ? <p style={styles.muted}>Loading…</p> : null}

      {order ? (
        <>
          <header style={styles.hero}>
            <div>
              <p style={styles.orderNo}>{order.orderNumber}</p>
              <p style={styles.subMeta}>
                <span style={styles.pill}>{labelStatus(order.status)}</span>
                <span>
                  {order.paymentMethod ?? '—'} · {labelStatus(order.paymentStatus)}
                </span>
              </p>
            </div>
            <div style={styles.heroSide}>
              <p style={styles.amount}>{money(order.totalAmount)}</p>
              <p style={styles.muted}>Placed {formatWhen(order.placedAt)}</p>
            </div>
          </header>

          <section style={styles.grid}>
            <div style={styles.card}>
              <h2 style={styles.h2}>Buyer & delivery</h2>
              {order.recipientName ? <p style={styles.lineStrong}>{order.recipientName}</p> : null}
              {order.buyerPhone ? (
                <p style={styles.line}>
                  <a href={`tel:${order.buyerPhone}`} style={styles.phoneLink}>
                    {order.buyerPhone}
                  </a>
                </p>
              ) : (
                <p style={styles.muted}>No phone on file</p>
              )}
              {order.deliveryAddress ? <p style={styles.line}>{order.deliveryAddress}</p> : null}
            </div>
            <div style={styles.card}>
              <h2 style={styles.h2}>What customer pays</h2>
              <div style={styles.moneyRows}>
                <div style={styles.moneyRow}>
                  <span style={styles.moneyLabel}>Items</span>
                  <span>{money(Number(order.itemsSubtotal ?? 0))}</span>
                </div>
                <div style={styles.moneyRow}>
                  <span style={styles.moneyLabel}>Delivery fee</span>
                  <span>{money(Number(order.deliveryFee ?? 0))}</span>
                </div>
                {Number(order.promoDiscount ?? 0) > 0 ? (
                  <div style={styles.moneyRow}>
                    <span style={styles.moneyLabel}>
                      Promo{order.promoCode ? ` (${order.promoCode})` : ''}
                    </span>
                    <span style={styles.moneyCredit}>−{money(Number(order.promoDiscount))}</span>
                  </div>
                ) : null}
                {Number(order.storeCreditApplied ?? 0) > 0 ? (
                  <div style={styles.moneyRow}>
                    <span style={styles.moneyLabel}>Store credit used</span>
                    <span style={styles.moneyCredit}>
                      −{money(Number(order.storeCreditApplied))}
                    </span>
                  </div>
                ) : null}
                <div style={{ ...styles.moneyRow, ...styles.moneyTotal }}>
                  <span>Payable</span>
                  <span>{money(order.totalAmount)}</span>
                </div>
              </div>
              <p style={styles.moneyHint}>
                {order.paymentMethod === 'COD'
                  ? 'Collect this amount on delivery (COD).'
                  : order.paymentMethod
                    ? `Paid via ${order.paymentMethod}.`
                    : null}
                {Number(order.storeCreditApplied ?? 0) > 0
                  ? ' Store credit was auto-applied from their wallet.'
                  : ''}
              </p>
            </div>
            <TimingCard order={order} />
          </section>

          <section style={styles.section}>
            <h2 style={styles.h2}>Shop bags ({order.subOrders?.length ?? 0})</h2>
            {(order.subOrders ?? []).length === 0 ? (
              <p style={styles.muted}>No sub-orders.</p>
            ) : (
              <div style={styles.stack}>
                {order.subOrders.map((bag) => (
                  <div key={bag.subOrderId} style={styles.card}>
                    <div style={styles.bagHead}>
                      <div>
                        <p style={styles.bagTitle}>{bag.shopName || 'Shop'}</p>
                        <p style={styles.muted}>
                          {bag.subOrderNumber} · {labelStatus(bag.status)} · {money(bag.subtotal)}
                        </p>
                      </div>
                      <span style={styles.pill}>{bag.itemCount} items</span>
                    </div>
                    {(bag.items ?? []).length > 0 ? (
                      <ul style={styles.itemList}>
                        {bag.items!.map((item, idx) => (
                          <li key={`${bag.subOrderId}-${idx}`} style={styles.itemRow}>
                            <span>
                              {item.name}
                              {item.unitCode ? ` · ${item.unitCode}` : ''} × {item.quantity}
                              {item.status && item.status !== 'ACTIVE' ? (
                                <span style={styles.itemStatus}> · {labelStatus(item.status)}</span>
                              ) : null}
                            </span>
                            <span style={styles.itemAmt}>{money(Number(item.lineTotal ?? 0))}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={styles.section}>
            <h2 style={styles.h2}>Delivery assignments ({order.assignments?.length ?? 0})</h2>
            {(order.assignments ?? []).length === 0 ? (
              <p style={styles.muted}>No assignments yet.</p>
            ) : (
              <div style={styles.stack}>
                {order.assignments.map((a) => (
                  <div key={a.assignmentId} style={styles.card}>
                    <div style={styles.bagHead}>
                      <div>
                        <p style={styles.bagTitle}>
                          {labelLeg(a.legType)}
                          {a.subOrderNumber ? ` · ${a.subOrderNumber}` : ''}
                        </p>
                        <p style={styles.muted}>{a.assignmentNumber}</p>
                      </div>
                      <span style={styles.pill}>{labelStatus(a.status)}</span>
                    </div>
                    <p style={styles.lineStrong}>
                      {a.agentName?.trim() || 'Unknown agent'}
                      {a.agentPhone ? (
                        <>
                          {' · '}
                          <a href={`tel:${a.agentPhone}`} style={styles.phoneLink}>
                            {a.agentPhone}
                          </a>
                        </>
                      ) : null}
                    </p>
                    <p style={styles.muted}>
                      Assigned {formatWhen(a.assignedAt)} · Started {formatWhen(a.startedAt)} · Done{' '}
                      {formatWhen(a.completedAt)}
                    </p>
                    {(a.events ?? []).length > 0 ? (
                      <ul style={styles.eventList}>
                        {a.events!.map((ev) => (
                          <li key={ev.eventId} style={styles.muted}>
                            {labelEvent(ev.eventType)} · {formatWhen(ev.createdAt)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <div style={styles.footer}>
            <Button type="button" variant="secondary" size="sm" onClick={() => void reload()}>
              Refresh
            </Button>
          </div>
        </>
      ) : null}
    </PortalShell>
  );
}

function earliestIso(values: Array<string | null | undefined>): string | null {
  const times = values
    .filter((v): v is string => Boolean(v))
    .map((v) => ({ v, t: Date.parse(v) }))
    .filter((x) => !Number.isNaN(x.t))
    .sort((a, b) => a.t - b.t);
  return times[0]?.v ?? null;
}

function latestIso(values: Array<string | null | undefined>): string | null {
  const times = values
    .filter((v): v is string => Boolean(v))
    .map((v) => ({ v, t: Date.parse(v) }))
    .filter((x) => !Number.isNaN(x.t))
    .sort((a, b) => b.t - a.t);
  return times[0]?.v ?? null;
}

function TimingCard({ order }: { order: AdminOrderDetail }) {
  const lastMile = (order.assignments ?? []).filter((a) => a.legType === 'LAST_MILE');
  const readyAt = earliestIso((order.subOrders ?? []).map((b) => b.readyForPickupAt));
  const outAt = earliestIso([
    ...lastMile.map((a) => a.startedAt),
    ...lastMile.flatMap((a) =>
      (a.events ?? []).filter((e) => e.eventType === 'PICKED_FROM_HUB').map((e) => e.createdAt),
    ),
  ]);
  const deliveredFromTrip = latestIso([
    ...lastMile.map((a) => a.completedAt),
    ...lastMile.flatMap((a) =>
      (a.events ?? []).filter((e) => e.eventType === 'DELIVERED').map((e) => e.createdAt),
    ),
  ]);
  const deliveredAt = order.deliveredAt || deliveredFromTrip;
  const cancelled = (order.status ?? '').toUpperCase() === 'CANCELLED' || Boolean(order.cancelledAt);

  let headline = 'In progress';
  if (cancelled) headline = 'Cancelled';
  else if ((order.status ?? '').toUpperCase() === 'DELIVERED' || deliveredAt) headline = 'Delivered';
  else if (outAt) headline = 'Out for delivery';
  else if (readyAt) headline = 'Ready at hub / shops';

  const rows: Array<{ label: string; at: string | null; show: boolean }> = [
    { label: 'Placed', at: order.placedAt ?? null, show: true },
    { label: 'Shops ready', at: readyAt, show: Boolean(readyAt) },
    { label: 'Out for delivery', at: outAt, show: Boolean(outAt) },
    {
      label: 'Delivered',
      at: deliveredAt,
      show: Boolean(deliveredAt) || (order.status ?? '').toUpperCase() === 'DELIVERED',
    },
    {
      label: 'Cancelled',
      at: order.cancelledAt ?? null,
      show: cancelled,
    },
  ];

  return (
    <div style={styles.card}>
      <h2 style={styles.h2}>Timeline</h2>
      <p style={styles.lineStrong}>{headline}</p>
      <div style={styles.moneyRows}>
        {rows
          .filter((r) => r.show)
          .map((r) => (
            <div key={r.label} style={styles.moneyRow}>
              <span style={styles.moneyLabel}>{r.label}</span>
              <span>{formatWhen(r.at)}</span>
            </div>
          ))}
      </div>
      {cancelled && order.cancelReason ? <p style={styles.moneyHint}>{order.cancelReason}</p> : null}
      {!cancelled && !deliveredAt ? (
        <p style={styles.moneyHint}>Not delivered yet — times fill in as the order moves.</p>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  topBar: { marginBottom: '0.65rem' },
  back: { color: 'var(--accent)', fontWeight: 700, textDecoration: 'none', fontSize: '0.88rem' },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    padding: '0.85rem 0',
    borderBottom: '1px solid var(--border)',
    marginBottom: '0.85rem',
  },
  orderNo: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.25rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  subMeta: {
    margin: '0.35rem 0 0',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.55rem',
    alignItems: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.84rem',
    fontWeight: 600,
  },
  heroSide: { textAlign: 'right' },
  amount: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.35rem',
    fontWeight: 800,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
    gap: '0.65rem',
    marginBottom: '1rem',
  },
  section: { marginBottom: '1.1rem' },
  stack: { display: 'grid', gap: '0.55rem' },
  card: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-elevated)',
    padding: '0.7rem 0.8rem',
  },
  h2: {
    margin: '0 0 0.45rem',
    fontSize: '0.92rem',
    fontWeight: 800,
    fontFamily: 'var(--font-display)',
  },
  bagHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.6rem',
    alignItems: 'flex-start',
  },
  bagTitle: { margin: 0, fontWeight: 800, fontSize: '0.92rem' },
  line: { margin: '0.2rem 0', fontSize: '0.84rem' },
  lineStrong: { margin: '0.2rem 0', fontSize: '0.88rem', fontWeight: 700 },
  muted: { margin: '0.15rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' },
  moneyRows: { display: 'grid', gap: '0.28rem' },
  moneyRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    fontSize: '0.84rem',
  },
  moneyLabel: { color: 'var(--text-muted)', fontWeight: 600 },
  moneyCredit: { color: 'var(--accent)', fontWeight: 700 },
  moneyTotal: {
    marginTop: '0.25rem',
    paddingTop: '0.35rem',
    borderTop: '1px solid var(--border)',
    fontWeight: 800,
    fontSize: '0.9rem',
  },
  moneyHint: {
    margin: '0.45rem 0 0',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    lineHeight: 1.35,
  },
  phoneLink: { color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' },
  pill: {
    display: 'inline-block',
    padding: '0.12rem 0.45rem',
    borderRadius: 'var(--radius-full)',
    background: 'color-mix(in srgb, var(--accent) 12%, var(--bg))',
    fontSize: '0.72rem',
    fontWeight: 800,
  },
  itemList: { listStyle: 'none', margin: '0.55rem 0 0', padding: 0 },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    padding: '0.28rem 0',
    borderTop: '1px solid var(--border)',
    fontSize: '0.84rem',
  },
  itemStatus: { color: 'var(--text-muted)', fontWeight: 600 },
  itemAmt: { fontWeight: 700, flexShrink: 0 },
  eventList: { listStyle: 'none', margin: '0.45rem 0 0', padding: 0, display: 'grid', gap: '0.15rem' },
  footer: { marginTop: '0.5rem' },
};
