import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Button, Card } from '@/shared/ui';
import { ConfirmDialog } from '@/features/orders/components/ConfirmDialog';
import { AssignVendorAgentDialog } from '@/features/delivery/components/AssignVendorAgentDialog';
import { useVendorShop } from '@/features/shop/hooks/useVendorShop';
import { LaundryCustomerNote } from '@hlm-laundry';
import {
  actOnLaundryOrder,
  fetchVendorLaundryOrders,
  laundryItemLabel,
  laundryPayLabel,
  laundryServiceLabel,
  laundryTripLabel,
  laundryAgentCashVendorNote,
  type LaundryOrder,
} from '../api/laundryApi';

const NEXT_STEP = [
  'MARK_PICKED_UP',
  'MARK_RECEIVED',
  'START',
  'MARK_READY',
  'OUT_FOR_DROP',
  'DELIVER',
  'REWASH',
] as const;

const ACTION_LABEL: Record<string, string> = {
  ACCEPT: 'Accept',
  SCHEDULE_PICKUP: 'Schedule pickup',
  MARK_PICKED_UP: 'Picked up',
  MARK_RECEIVED: 'Received at shop',
  START: 'Start work',
  MARK_READY: 'Mark ready',
  OUT_FOR_DROP: 'Out for drop',
  DELIVER: 'Mark delivered',
  CANCEL: 'Reject order',
  REWASH: 'Rewash',
  SETTLE_PAYMENT: 'Payment received',
  OPEN_COMPLAINT: 'Complaint',
  CLOSE_COMPLAINT: 'Close complaint',
};

const TRACK = ['Sent', 'Pickup', 'Shop', 'Ready', 'Done'] as const;

type Filter = 'open' | 'due' | 'done';

type PendingConfirm = {
  title: string;
  description: string;
  danger?: boolean;
  confirmLabel?: string;
  onConfirm: () => void;
};

function actionConfirm(action: string, order: LaundryOrder, run: () => void): PendingConfirm {
  const label = ACTION_LABEL[action] ?? action;
  if (action === 'CANCEL') {
    return {
      title: 'Reject this order?',
      description: 'The customer gets wallet credit for what they paid. This cannot be undone.',
      danger: true,
      confirmLabel: 'Yes, reject',
      onConfirm: run,
    };
  }
  if (action === 'SETTLE_PAYMENT') {
    return {
      title: 'Payment received?',
      description: `Mark cash as collected for ${order.orderNumber}.`,
      confirmLabel: 'Yes, received',
      onConfirm: run,
    };
  }
  if (action === 'SET_ESTIMATE') {
    return {
      title: 'Save estimate?',
      description: `Update ready time for ${order.orderNumber}.`,
      confirmLabel: 'Save',
      onConfirm: run,
    };
  }
  return {
    title: `${label}?`,
    description: `${label} for order ${order.orderNumber}.`,
    confirmLabel: label,
    onConfirm: run,
  };
}

function rupee(value: number): string {
  const amount = Number(value) || 0;
  return Number.isInteger(amount) ? `₹${amount}` : `₹${amount.toFixed(2)}`;
}

function collectTotal(order: LaundryOrder): number {
  return Number(order.goodsAmount) + Number(order.platformFeeAmount || 0) + Number(order.codFee || 0);
}

function lineSignature(order: LaundryOrder): string {
  return order.lines.map((line) => `${line.id}:${line.confirmedQuantity}:${line.conditionNote ?? ''}`).join('|');
}

/** Customer pickup not done yet — shop assigns agent; no “Picked up” / cash settle on card. */
function isPickupScheduledPhase(order: LaundryOrder): boolean {
  const needsPickup = order.logistics === 'PICKUP_AND_DROP' || order.logistics === 'PICKUP_ONLY';
  return needsPickup && order.status === 'PICKUP_SCHEDULED';
}

function stepIndex(status: string): number {
  if (status === 'REQUESTED') return 0;
  if (status === 'ACCEPTED' || status === 'PICKUP_SCHEDULED') return 1;
  if (status === 'PICKED_UP' || status === 'AT_SHOP' || status === 'IN_PROCESS') return 2;
  if (status === 'READY' || status === 'OUT_FOR_DROP') return 3;
  if (status === 'DELIVERED') return 4;
  return -1;
}

function istHour(when: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(when));
}

function clockLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

function slotLabel(start?: string | null, end?: string | null): string {
  if (!start) return '';
  const from = new Date(start);
  if (Number.isNaN(from.getTime())) return '';
  const startClock = clockLabel(istHour(from));
  const to = end ? new Date(end) : null;
  let time = startClock;
  if (to && !Number.isNaN(to.getTime())) {
    const endClock = clockLabel(istHour(to));
    const startPeriod = startClock.slice(-2);
    const endPeriod = endClock.slice(-2);
    time = startPeriod === endPeriod
      ? `${startClock.slice(0, -3)}–${endClock}`
      : `${startClock}–${endClock}`;
  }
  const day = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(from);
  return `${day} · ${time}`;
}

function statusTone(status: string): CSSProperties {
  if (status === 'REQUESTED') return styles.statusNew;
  if (status === 'READY' || status === 'DELIVERED') return styles.statusReady;
  if (status === 'CANCELLED') return styles.statusDanger;
  if (status === 'OUT_FOR_DROP' || status === 'PICKUP_SCHEDULED') return styles.statusMove;
  return styles.statusWork;
}

export function LaundryRequests({ active = true, reloadToken = 0 }: { active?: boolean; reloadToken?: number }) {
  const { session } = useAuth();
  const { shop } = useVendorShop();
  const token = session?.accessToken ?? '';
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<Filter>('open');
  const [estimates, setEstimates] = useState<Record<string, string>>({});
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [assignOrder, setAssignOrder] = useState<LaundryOrder | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seen = useRef(new Set<string>());

  const agentScope = useMemo(() => {
    if (!session?.accessToken || !session.vendorId || !shop?.shopId || !shop?.townId) return null;
    return {
      token: session.accessToken,
      vendorId: session.vendorId,
      shopId: shop.shopId,
      townId: shop.townId,
    };
  }, [session?.accessToken, session?.vendorId, shop?.shopId, shop?.townId]);

  const remember = useCallback((rows: LaundryOrder[]) => {
    setOrders(rows);
    setBaseline(Object.fromEntries(rows.map((order) => [order.id, lineSignature(order)])));
    const fresh = rows.filter((order) =>
      (order.status === 'REQUESTED' || order.status === 'PICKUP_SCHEDULED' || order.status === 'ACCEPTED')
      && !seen.current.has(order.id));
    rows.forEach((order) => seen.current.add(order.id));
    if (fresh.length > 0) {
      setExpanded((prev) => new Set([...prev, ...fresh.map((order) => order.id)]));
    }
  }, []);

  const load = useCallback((silent = false) => {
    if (!token) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    void fetchVendorLaundryOrders(token)
      .then((rows) => {
        remember(Array.isArray(rows) ? rows : []);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load requests'))
      .finally(() => setLoading(false));
  }, [remember, token]);

  useEffect(() => {
    if (!active) return;
    load(false);
    const id = window.setInterval(() => load(true), 10_000);
    return () => window.clearInterval(id);
  }, [active, load, reloadToken]);

  function patchLine(orderId: string, lineId: string, patch: Partial<LaundryOrder['lines'][number]>) {
    setOrders((prev) => prev.map((row) => row.id === orderId
      ? { ...row, lines: row.lines.map((item) => item.id === lineId ? { ...item, ...patch } : item) }
      : row));
  }

  async function act(order: LaundryOrder, action: string) {
    if (!token || actingId) return;
    setError(null);
    if (action === 'SCHEDULE_PICKUP' && scheduleFor !== order.id) {
      setScheduleFor(order.id);
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add(order.id);
        return next;
      });
      return;
    }
    setActingId(order.id);
    try {
      const body: Parameters<typeof actOnLaundryOrder>[2] = { action };
      if (action === 'SCHEDULE_PICKUP') {
        if (!slotStart || !slotEnd) {
          setError('Enter the pickup start and end');
          return;
        }
        body.pickupSlotStart = new Date(slotStart).toISOString();
        body.pickupSlotEnd = new Date(slotEnd).toISOString();
      }
      if (action === 'SET_ESTIMATE') {
        const raw = estimates[order.id];
        if (raw) body.estimatedReadyAt = new Date(raw).toISOString();
      }
      const next = await actOnLaundryOrder(token, order.id, body);
      setOrders((prev) => prev.map((row) => (row.id === order.id ? next : row)));
      setBaseline((prev) => ({ ...prev, [order.id]: lineSignature(next) }));
      if (action === 'SCHEDULE_PICKUP') setScheduleFor(null);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update request');
    } finally {
      setActingId(null);
    }
  }

  async function assignTripAgent(order: LaundryOrder, agentId: string) {
    if (!token) return;
    if (actingId != null && actingId !== order.id) {
      setError('Finish the other ticket action first, then assign again.');
      return;
    }
    setError(null);
    setActingId(order.id);
    try {
      const next = await actOnLaundryOrder(token, order.id, { action: 'ASSIGN_AGENT', agentId });
      setOrders((prev) => prev.map((row) => (row.id === order.id ? next : row)));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not assign agent');
    } finally {
      setActingId(null);
    }
  }

  async function copyAddress(order: LaundryOrder) {
    if (!order.addressText?.trim()) return;
    try {
      await navigator.clipboard.writeText(order.addressText.trim());
      setCopyHint(order.id);
      window.setTimeout(() => setCopyHint((prev) => (prev === order.id ? null : prev)), 2000);
    } catch {
      setError('Could not copy address');
    }
  }

  const openCount = orders.filter((order) => order.status !== 'DELIVERED' && order.status !== 'CANCELLED').length;
  const due = orders
    .filter((order) => order.status !== 'CANCELLED' && order.paymentStatus !== 'COLLECTED')
    .reduce((sum, order) => sum + Math.max(0, collectTotal(order) - Number(order.amountCollected || 0)), 0);

  const visible = useMemo(() => orders.filter((order) => {
    if (filter === 'done') return order.status === 'DELIVERED' || order.status === 'CANCELLED';
    if (filter === 'due') return order.status !== 'CANCELLED' && order.paymentStatus !== 'COLLECTED';
    return order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
  }), [filter, orders]);

  return (
    <section style={styles.wrap}>
      <style>{`
        .laundry-ticket { padding: 0 !important; overflow: hidden; border: 1px solid color-mix(in srgb, var(--border) 90%, var(--accent)); }
        .laundry-ticket--new { border-left: 3px solid var(--accent); }
        .laundry-head:hover { background: color-mix(in srgb, var(--border) 28%, transparent); }
        .laundry-step { min-width: 2rem; min-height: 2rem; }
      `}</style>
      <div style={styles.stats}>
        <Card elevated padding="sm" style={styles.stat}>
          <span style={styles.statLabel}>Open requests</span>
          <strong style={styles.statValue}>{loading ? '…' : openCount}</strong>
        </Card>
        <Card elevated padding="sm" style={styles.stat}>
          <span style={styles.statLabel}>Still to collect</span>
          <strong style={styles.statValue}>{loading ? '…' : rupee(due)}</strong>
        </Card>
      </div>
      <div style={styles.filters} role="tablist" aria-label="Request filters">
        {([
          ['open', 'Open'],
          ['due', 'To collect'],
          ['done', 'Done'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            style={filter === value ? styles.filterOn : styles.filter}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? <p style={styles.error}>{error}</p> : null}
      {loading && orders.length === 0 ? <p style={styles.muted}>Loading requests…</p> : null}
      {!loading && visible.length === 0 ? (
        <Card style={styles.empty}>
          <strong>{filter === 'open' ? 'No open requests' : 'Nothing in this list'}</strong>
          <span style={styles.muted}>New laundry orders show up here.</span>
        </Card>
      ) : null}
      {visible.map((order) => {
        const open = expanded.has(order.id);
        const trip = Number(order.logisticsCharge || 0);
        const pieces = order.lines.reduce((sum, line) => sum + Number(line.confirmedQuantity || 0), 0);
        const pieceTotal = order.lines.reduce((sum, line) => sum + Number(line.unitPrice) * Number(line.confirmedQuantity || 0), 0);
        const liveCollect = pieceTotal + trip + Number(order.platformFeeAmount || 0) + Number(order.codFee || 0);
        const pickupScheduledPhase = isPickupScheduledPhase(order);
        const primary = pickupScheduledPhase
          ? undefined
          : NEXT_STEP.find((action) => order.allowedActions.includes(action));
        const extras = pickupScheduledPhase
          ? []
          : order.allowedActions.filter((action) =>
              action !== 'ADJUST'
              && action !== 'CANCEL'
              && action !== 'ASSIGN_AGENT'
              && action !== primary);
        const step = stepIndex(order.status);
        const pickup = slotLabel(
          order.pickupSlotStart ?? order.requestedPickupStart,
          order.pickupSlotEnd ?? order.requestedPickupEnd,
        );
        const busy = actingId === order.id;
        return (
          <Card
            key={order.id}
            elevated
            className={`laundry-ticket${order.status === 'REQUESTED' ? ' laundry-ticket--new' : ''}`}
          >
            <button
              type="button"
              className="laundry-head"
              style={styles.head}
              aria-expanded={open}
              onClick={() => setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(order.id)) next.delete(order.id);
                else next.add(order.id);
                return next;
              })}
            >
              <span style={styles.chevron} aria-hidden>{open ? '▾' : '▸'}</span>
              <span style={styles.headMain}>
                <span style={styles.titleRow}>
                  <strong style={styles.orderNo}>{order.orderNumber}</strong>
                  <span style={{ ...styles.pill, ...statusTone(order.status) }}>{order.statusLabel}</span>
                </span>
                <span style={styles.summary}>
                  <strong>{rupee(liveCollect)}</strong>
                  <span>·</span>
                  <span>{pieces} {pieces === 1 ? 'piece' : 'pieces'}</span>
                  <span>·</span>
                  <span>{laundryTripLabel(order.logistics)}</span>
                  {pickup ? (
                    <>
                      <span>·</span>
                      <span style={styles.slotOnHead}>{pickup}</span>
                    </>
                  ) : null}
                  <span>·</span>
                  <span>{order.paymentMethod === 'UPI' ? 'UPI' : 'Cash'} {laundryPayLabel(order.paymentStatus).toLowerCase()}</span>
                </span>
              </span>
            </button>
            {open ? (
              <div style={styles.body}>
                {step >= 0 ? (
                  <div style={styles.track} aria-hidden>
                    {TRACK.map((label, index) => (
                      <span key={label} style={index <= step ? styles.trackOn : styles.trackOff}>
                        <span style={index <= step ? styles.dotOn : styles.dotOff} />
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p style={styles.who}>
                  <strong>{order.contactName || 'Customer'}</strong>
                  {order.contactPhone ? (
                    <a href={`tel:${order.contactPhone}`} style={styles.phone}>{order.contactPhone}</a>
                  ) : null}
                </p>
                {order.addressText ? <p style={styles.address}>{order.addressText}</p> : null}
                {order.addressText ? (
                  <div style={styles.navigate}>
                    <a
                      href={mapsSearchUrl(order.addressText)}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.mapLink}
                    >
                      Open in Maps
                    </a>
                    <button type="button" style={styles.textBtn} onClick={() => void copyAddress(order)}>
                      {copyHint === order.id ? 'Copied' : 'Copy address'}
                    </button>
                    {order.tripAgentName ? (
                      <span style={styles.agentChip}>
                        Trip agent:{' '}
                        <strong>{order.tripAgentName}</strong>
                        {order.tripAgentPhone ? (
                          <>
                            {' · '}
                            <a href={`tel:${order.tripAgentPhone}`} style={styles.phone}>{order.tripAgentPhone}</a>
                          </>
                        ) : null}
                      </span>
                    ) : (
                      <span style={styles.navigateHint}>
                        Share Maps with your staff, or assign an agent on the right.
                      </span>
                    )}
                  </div>
                ) : null}
                <p style={styles.chips}>
                  <span style={styles.chip}>{laundryTripLabel(order.logistics)}</span>
                  {pickup ? <span style={styles.chip}>Pickup {pickup}</span> : null}
                </p>
                {laundryAgentCashVendorNote(order.agentCashPickupReport, order.agentCashDropReport) ? (
                  <p style={styles.agentCashNote}>
                    {laundryAgentCashVendorNote(order.agentCashPickupReport, order.agentCashDropReport)}
                  </p>
                ) : null}
                {order.paymentMethod !== 'UPI' && order.paymentStatus === 'COLLECTED' ? (
                  <p style={styles.vendorPaidNote}>Payment received marked by Vendor</p>
                ) : null}
                <ul style={styles.lines}>
                  {order.lines.map((line) => {
                    const name = laundryItemLabel(line.itemType, line.otherLabel);
                    const count = Number(line.quantity || 0);
                    return (
                      <li key={line.id} style={styles.line}>
                        <span style={styles.item}>
                          <span>{count} × {name}</span>
                          <span style={styles.meta}>{laundryServiceLabel(line.serviceType)} · {rupee(Number(line.unitPrice))} each</span>
                        </span>
                        <strong style={styles.lineAmt}>{rupee(Number(line.unitPrice) * count)}</strong>
                        {line.photoUrl ? <a href={line.photoUrl} target="_blank" rel="noreferrer" style={styles.phone}>Photo</a> : null}
                      </li>
                    );
                  })}
                </ul>
                <div style={styles.bill}>
                  <span>{pieces} {pieces === 1 ? 'piece' : 'pieces'}</span>
                  <span>{rupee(pieceTotal)}</span>
                  <span>Trip</span>
                  <span>{rupee(trip)}</span>
                  <span>Platform fee</span>
                  <span>{rupee(Number(order.platformFeeAmount || 0))}</span>
                  {Number(order.codFee) > 0 ? (
                    <>
                      <span>COD charge</span>
                      <span>{rupee(Number(order.codFee))}</span>
                    </>
                  ) : null}
                  <strong>{order.paymentMethod === 'UPI' ? 'Paid online' : 'Collect'}</strong>
                  <strong>{rupee(liveCollect)}</strong>
                </div>
                <LaundryCustomerNote note={order.specialInstructions || order.buyerComment} />
                <label style={styles.field}>
                  Estimated ready
                  <input style={styles.input} type="datetime-local" value={estimates[order.id] ?? ''} onChange={(e) => setEstimates((prev) => ({ ...prev, [order.id]: e.target.value }))} />
                </label>
                <div style={styles.slotRow}>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => setConfirm(actionConfirm('SET_ESTIMATE', order, () => void act(order, 'SET_ESTIMATE')))}
                  >
                    Save estimate
                  </Button>
                </div>
              </div>
            ) : null}
            <div style={styles.actions}>
              <div style={styles.actionsMain}>
                {primary ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    style={styles.primary}
                    onClick={() => setConfirm(actionConfirm(primary, order, () => void act(order, primary)))}
                  >
                    {busy ? '…' : ACTION_LABEL[primary]}
                  </Button>
                ) : null}
                {extras.filter((action) => !['SET_ESTIMATE', 'SET_COMMENT', 'ADJUST', 'SCHEDULE_PICKUP', 'ACCEPT'].includes(action)).map((action) => (
                  <Button
                    key={action}
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setConfirm(actionConfirm(action, order, () => void act(order, action)))}
                  >
                    {ACTION_LABEL[action] ?? action}
                  </Button>
                ))}
                {order.allowedActions.includes('CANCEL') ? (
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={() => setConfirm(actionConfirm('CANCEL', order, () => void act(order, 'CANCEL')))}
                  >
                    Reject order
                  </Button>
                ) : null}
              </div>
              {order.allowedActions.includes('ASSIGN_AGENT') ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy || !agentScope}
                  style={styles.assignAgent}
                  onClick={() => setConfirm({
                    title: order.tripAgentId ? 'Reassign agent?' : 'Assign agent?',
                    description: `Choose a delivery agent for ${order.orderNumber}. They will see the customer address and your shop name.`,
                    confirmLabel: 'Continue',
                    onConfirm: () => setAssignOrder(order),
                  })}
                >
                  {order.tripAgentId ? 'Reassign agent' : 'Assign agent'}
                </Button>
              ) : null}
            </div>
          </Card>
        );
      })}
      <ConfirmDialog
        open={confirm != null}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        busy={actingId != null}
        onClose={() => {
          if (actingId) return;
          setConfirm(null);
        }}
        onConfirm={() => {
          const run = confirm?.onConfirm;
          setConfirm(null);
          run?.();
        }}
      />
      <AssignVendorAgentDialog
        open={assignOrder != null}
        title="Assign trip agent"
        confirmLabel="Assign agent"
        subOrderLabel={
          assignOrder
            ? `${assignOrder.orderNumber} · ${assignOrder.contactName || 'Customer'}${assignOrder.addressText ? ` · ${assignOrder.addressText}` : ''}`
            : ''
        }
        scope={agentScope}
        busy={actingId != null && assignOrder != null && actingId === assignOrder.id}
        onClose={() => {
          if (actingId) return;
          setAssignOrder(null);
        }}
        onConfirm={(agentId) => {
          if (!assignOrder) return;
          const order = assignOrder;
          void assignTripAgent(order, agentId).then(() => setAssignOrder(null));
        }}
      />
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.45rem' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.45rem' },
  stat: { display: 'grid', gap: '0.1rem', padding: '0.45rem 0.65rem' },
  statLabel: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  statValue: { fontSize: '1.2rem', lineHeight: 1.15, fontFamily: 'var(--font-display)' },
  filters: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' },
  filter: {
    minHeight: 36,
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    padding: '0 0.75rem',
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  filterOn: {
    minHeight: 36,
    borderRadius: 999,
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    padding: '0 0.75rem',
    fontWeight: 800,
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  head: {
    display: 'flex',
    gap: '0.45rem',
    alignItems: 'flex-start',
    width: '100%',
    textAlign: 'left',
    border: 0,
    background: 'transparent',
    color: 'inherit',
    padding: '0.55rem 0.7rem',
    cursor: 'pointer',
  },
  chevron: { width: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, paddingTop: '0.1rem' },
  headMain: { display: 'grid', gap: '0.15rem', minWidth: 0, flex: 1 },
  titleRow: { display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' },
  orderNo: { fontSize: '0.95rem' },
  summary: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 650 },
  slotOnHead: { color: 'var(--text)', fontWeight: 800 },
  pill: {
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '0.16rem 0.45rem',
    borderRadius: 999,
  },
  statusNew: { color: 'var(--accent-hover)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)' },
  statusReady: { color: '#0f766e', background: 'color-mix(in srgb, #0d9488 12%, transparent)' },
  statusMove: { color: '#6d28d9', background: 'color-mix(in srgb, #7c3aed 12%, transparent)' },
  statusWork: { color: '#92400e', background: 'var(--warning-soft, #fef3c7)' },
  statusDanger: { color: 'var(--danger, #b91c1c)', background: 'var(--danger-soft, #fee2e2)' },
  body: { display: 'grid', gap: '0.35rem', padding: '0 0.7rem 0.55rem 1.95rem' },
  track: { display: 'flex', gap: '0.45rem', flexWrap: 'wrap' },
  trackOn: { display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-hover)' },
  trackOff: { display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' },
  dotOn: { width: 7, height: 7, borderRadius: 99, background: 'var(--accent)' },
  dotOff: { width: 7, height: 7, borderRadius: 99, background: 'var(--border)' },
  who: { margin: 0, display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'baseline', fontSize: '0.86rem' },
  phone: { color: 'var(--accent-hover)', fontWeight: 800, fontSize: '0.82rem' },
  address: { margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem' },
  navigate: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem 0.65rem',
    alignItems: 'center',
    fontSize: '0.78rem',
  },
  mapLink: { color: 'var(--accent-hover)', fontWeight: 800, textDecoration: 'none' },
  navigateHint: { color: 'var(--text-muted)', fontWeight: 650, flex: '1 1 12rem' },
  agentChip: { color: 'var(--text-muted)', flex: '1 1 12rem' },
  chips: { margin: 0, display: 'flex', gap: '0.3rem', flexWrap: 'wrap' },
  chip: {
    fontSize: '0.7rem',
    fontWeight: 800,
    padding: '0.12rem 0.45rem',
    borderRadius: 999,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
  },
  noteLine: { margin: 0, fontSize: '0.78rem', fontWeight: 700 },
  agentCashNote: {
    margin: 0,
    padding: '0.35rem 0.45rem',
    borderRadius: 8,
    fontSize: '0.76rem',
    fontWeight: 650,
    lineHeight: 1.35,
    background: 'color-mix(in srgb, var(--warning-soft, #fef3c7) 80%, transparent)',
    border: '1px solid #fde68a',
    color: '#92400e',
  },
  vendorPaidNote: {
    margin: 0,
    padding: '0.35rem 0.45rem',
    borderRadius: 8,
    fontSize: '0.76rem',
    fontWeight: 700,
    lineHeight: 1.35,
    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
    border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
    color: 'var(--accent-hover)',
  },
  lines: { listStyle: 'none', margin: 0, padding: '0.35rem 0.45rem', display: 'grid', gap: '0.4rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg)' },
  line: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.5rem', alignItems: 'center' },
  stepper: { display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 999, background: '#fff', colorScheme: 'light', overflow: 'hidden' },
  stepBtn: {
    width: 36,
    height: 36,
    border: 0,
    background: '#fff',
    color: '#111',
    colorScheme: 'light',
    fontSize: '1.05rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  stepCount: { minWidth: '1.4rem', textAlign: 'center', color: '#111', fontSize: '0.9rem' },
  item: { display: 'grid', flex: '1 1 8rem', minWidth: 0, fontSize: '0.86rem', fontWeight: 800 },
  meta: { fontSize: '0.7rem', fontWeight: 650, color: 'var(--text-muted)' },
  lineAmt: { fontSize: '0.86rem' },
  lineLinks: { display: 'inline-flex', gap: '0.45rem', alignItems: 'center' },
  textBtn: { border: 0, background: 'transparent', color: 'var(--accent-hover)', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', padding: 0 },
  note: {
    flex: '1 1 100%',
    minHeight: 36,
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0 0.5rem',
    background: '#fff',
    color: '#111',
    colorScheme: 'light',
  },
  bill: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.12rem 0.8rem', maxWidth: 240, fontSize: '0.78rem', color: 'var(--text-muted)' },
  slotRow: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  field: { display: 'grid', gap: '0.12rem', fontSize: '0.7rem', fontWeight: 800 },
  input: { minHeight: 40, border: '1px solid var(--border)', borderRadius: 8, padding: '0 0.45rem', background: '#fff', color: '#111', colorScheme: 'light' },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0.7rem',
    borderTop: '1px solid var(--border)',
    background: 'color-mix(in srgb, var(--bg) 55%, var(--bg-elevated))',
  },
  actionsMain: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', flex: '1 1 auto' },
  assignAgent: { marginLeft: 'auto', flexShrink: 0 },
  primary: { minHeight: 44 },
  empty: { display: 'grid', gap: '0.15rem', padding: '0.7rem 0.8rem' },
  muted: { color: 'var(--text-muted)', fontSize: '0.78rem' },
  error: { color: 'var(--danger, #b91c1c)', fontWeight: 700, margin: 0 },
};
