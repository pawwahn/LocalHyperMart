import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Button, Card } from '@/shared/ui';
import { ConfirmDialog } from '@/features/orders/components/ConfirmDialog';
import { beautyBookingTotal, beautyPaymentPlanView, primaryBeautyWorkflowAction } from '@hlm-beauty';
import {
  actOnBeautyOrder,
  beautyActionLabel,
  fetchVendorBeautyOrders,
  type BeautyOrder,
} from '../api/beautyApi';

type Filter = 'open' | 'done';

function rupee(value: number): string {
  return `₹${Number(value || 0).toFixed(0)}`;
}

function collectTotal(order: BeautyOrder): number {
  return beautyBookingTotal(order);
}

function formatSlot(start?: string | null, end?: string | null): string {
  if (!start) return '';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const day = s.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const t1 = s.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const t2 = e ? e.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '';
  return t2 ? `${day} · ${t1} – ${t2}` : `${day} · ${t1}`;
}

function isOpen(order: BeautyOrder): boolean {
  return order.status !== 'COMPLETED' && order.status !== 'CANCELLED';
}

function paySettlementStyle(tone: 'ok' | 'warn' | 'muted' | 'danger'): CSSProperties {
  const base: CSSProperties = { fontSize: '0.65rem', fontWeight: 800 };
  if (tone === 'ok') return { ...base, color: '#047857' };
  if (tone === 'warn') return { ...base, color: '#b45309' };
  if (tone === 'danger') return { ...base, color: '#b91c1c' };
  return { ...base, color: 'var(--text-muted)' };
}

export function BeautyBookings({ active = true, reloadToken = 0 }: { active?: boolean; reloadToken?: number }) {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [orders, setOrders] = useState<BeautyOrder[]>([]);
  const [filter, setFilter] = useState<Filter>('open');
  const [actingId, setActingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: string;
    orderId: string;
    warnBanner?: string;
    visitCashCollected?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    (silent = false) => {
      if (!token) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      void fetchVendorBeautyOrders(token)
        .then((rows) => {
          setOrders(Array.isArray(rows) ? rows : []);
          setError(null);
        })
        .catch((err) => setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load bookings'))
        .finally(() => setLoading(false));
    },
    [token],
  );

  useEffect(() => {
    if (!active) return;
    load(false);
    const id = window.setInterval(() => load(true), 12_000);
    return () => window.clearInterval(id);
  }, [active, load, reloadToken]);

  const shown = useMemo(() => {
    const list = filter === 'open' ? orders.filter(isOpen) : orders.filter((o) => !isOpen(o));
    return [...list].sort((a, b) => {
      const ta = a.slotStart ? new Date(a.slotStart).getTime() : 0;
      const tb = b.slotStart ? new Date(b.slotStart).getTime() : 0;
      return ta - tb;
    });
  }, [filter, orders]);

  async function runAction(orderId: string, action: string, visitCashCollected?: boolean) {
    if (!token || actingId) return;
    setActingId(orderId);
    setError(null);
    try {
      const next = await actOnBeautyOrder(token, orderId, {
        action,
        ...(visitCashCollected ? { visitCashCollected: true } : {}),
      });
      setOrders((prev) => prev.map((row) => (row.id === orderId ? next : row)));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update booking');
    } finally {
      setActingId(null);
      setConfirm(null);
    }
  }

  function askAction(order: BeautyOrder, action: string, pay?: ReturnType<typeof beautyPaymentPlanView>) {
    const label = beautyActionLabel(action);
    if (action === 'COMPLETE' && pay && pay.dueAtVisit > 0.01) {
      setConfirm({
        title: 'End session?',
        description: `Confirm the visit is complete for ${order.orderNumber}.`,
        warnBanner: `Collect ${rupee(pay.dueAtVisit)} from the customer before ending. This is recorded for accounts and audit.`,
        action,
        orderId: order.id,
        visitCashCollected: true,
      });
      return;
    }
    setConfirm({
      title: `${label}?`,
      description: `${label} for ${order.orderNumber}.`,
      action,
      orderId: order.id,
    });
  }

  if (loading && orders.length === 0) {
    return <p style={styles.muted}>Loading glam bookings…</p>;
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.head}>
        <h2 style={styles.h2}>Glam bookings</h2>
        <div style={styles.filters}>
          <button type="button" style={filter === 'open' ? styles.filterOn : styles.filter} onClick={() => setFilter('open')}>
            Open
          </button>
          <button type="button" style={filter === 'done' ? styles.filterOn : styles.filter} onClick={() => setFilter('done')}>
            Done
          </button>
        </div>
      </div>
      {error ? <p style={styles.error}>{error}</p> : null}
      {shown.length === 0 ? <p style={styles.muted}>{filter === 'open' ? 'No open bookings.' : 'No completed bookings yet.'}</p> : null}
      {shown.map((order) => {
        const pay = beautyPaymentPlanView(order, 'vendor');
        const primary = primaryBeautyWorkflowAction(order.allowedActions);
        const canCancel = (order.allowedActions ?? []).includes('CANCEL');
        return (
        <Card key={order.id} style={styles.card}>
          <div style={styles.cardTop}>
            <div>
              <strong style={styles.no}>{order.orderNumber}</strong>
              <p style={styles.meta}>
                {order.serviceLabel ?? order.serviceType} · {order.venueLabel ?? order.venue}
              </p>
              <p style={styles.meta}>{formatSlot(order.slotStart, order.slotEnd)}</p>
              {order.addressText ? <p style={styles.meta}>📍 {order.addressText}</p> : null}
              {order.studioAddress && order.venue === 'AT_STUDIO' ? (
                <p style={styles.meta}>🪞 {order.studioAddress}</p>
              ) : null}
              {order.contactPhone ? <p style={styles.meta}>📞 {order.contactName ?? 'Customer'} · {order.contactPhone}</p> : null}
              {order.specialInstructions ? <p style={styles.note}>{order.specialInstructions}</p> : null}
              {order.referencePhotoUrl ? (
                <img src={order.referencePhotoUrl} alt="Reference look" style={styles.refPhoto} />
              ) : null}
            </div>
            <div style={styles.side}>
              <span style={styles.badge}>{order.statusLabel}</span>
              <strong style={styles.amount}>{rupee(collectTotal(order))}</strong>
              <span style={pay.plan === 'PARTIAL' ? styles.planPartial : styles.planFull}>{pay.planBadge}</span>
              <span style={paySettlementStyle(pay.settlementTone)}>{pay.settlementBadge}</span>
              <span style={styles.payBreakdown}>
                Online {rupee(pay.paidOnline)} · {pay.dueAtVisitLabel} {rupee(pay.dueAtVisit)}
              </span>
            </div>
          </div>
          <div style={styles.actions}>
            {primary ? (
              <Button
                variant="primary"
                disabled={actingId === order.id}
                onClick={() => askAction(order, primary, pay)}
              >
                {beautyActionLabel(primary)}
              </Button>
            ) : null}
            {canCancel ? (
              <Button
                variant="ghost"
                disabled={actingId === order.id}
                onClick={() => askAction(order, 'CANCEL')}
              >
                {beautyActionLabel('CANCEL')}
              </Button>
            ) : null}
          </div>
        </Card>
        );
      })}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        confirmLabel={confirm ? beautyActionLabel(confirm.action) : 'OK'}
        warnBanner={confirm?.warnBanner}
        danger={confirm?.action === 'CANCEL'}
        busy={Boolean(confirm && actingId === confirm.orderId)}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void runAction(confirm.orderId, confirm.action, confirm.visitCashCollected);
        }}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: 'grid',
    gap: '0.45rem',
    marginTop: '0.35rem',
    paddingTop: '0.55rem',
    borderTop: '1px solid #f3f4f6',
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' },
  h2: { margin: 0, fontSize: '0.95rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#111827' },
  filters: { display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: '#f9fafb', border: '1px solid #f3f4f6' },
  filter: { minHeight: 34, padding: '0 0.75rem', borderRadius: 8, border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.72rem', color: '#6b7280' },
  filterOn: { minHeight: 34, padding: '0 0.75rem', borderRadius: 8, border: 'none', background: '#fff', color: '#9d174d', fontWeight: 900, fontSize: '0.72rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  card: { padding: '0.65rem 0.7rem', display: 'grid', gap: '0.45rem' },
  cardTop: { display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' },
  no: { fontSize: '0.88rem' },
  meta: { margin: '0.12rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 },
  note: { margin: '0.2rem 0 0', fontSize: '0.72rem', fontStyle: 'italic' },
  refPhoto: { marginTop: '0.35rem', maxWidth: '100%', maxHeight: 140, borderRadius: 8, objectFit: 'cover' },
  side: { display: 'grid', gap: '0.15rem', justifyItems: 'end', textAlign: 'right' },
  badge: { fontSize: '0.68rem', fontWeight: 800, color: '#9d174d' },
  amount: { fontSize: '1rem', color: '#be185d' },
  planFull: {
    fontSize: '0.62rem',
    fontWeight: 900,
    color: '#1d4ed8',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    padding: '0.15rem 0.4rem',
    borderRadius: 999,
  },
  planPartial: {
    fontSize: '0.62rem',
    fontWeight: 900,
    color: '#7e22ce',
    background: '#fdf4ff',
    border: '1px solid #e9d5ff',
    padding: '0.15rem 0.4rem',
    borderRadius: 999,
  },
  payBreakdown: { fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, maxWidth: '11rem', lineHeight: 1.35 },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem' },
  muted: { color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 },
  error: { color: '#b91c1c', fontWeight: 700, fontSize: '0.78rem', margin: 0 },
};
