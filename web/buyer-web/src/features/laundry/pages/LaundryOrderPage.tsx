import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { OrderStatusTimeline } from '@/features/shop/components/OrderStatusTimeline';
import { buildLaundryBuyerTimeline } from '../lib/laundryOrderProgress';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { LaundryCustomerNote } from '@hlm-laundry';
import { CheckoutDismissedError, openGatewayCheckout } from '@/features/shop/lib/gatewayCheckout';
import { confirmOnlinePaymentResilient } from '@/features/shop/api/shopApi';
import { resolveOnlineCheckout } from '@/features/shop/lib/loadOnlineCheckout';
import { ConfirmDialog } from '@/features/shop/components/ConfirmDialog';
import {
  fetchLaundryOrder,
  laundryAgentCashBuyerNote,
  laundryLabel,
  retryLaundryPayment,
  type LaundryOrder,
} from '../api/laundryApi';

function money(value: number): string {
  const amount = Number(value) || 0;
  return Number.isInteger(amount) ? `₹${amount}` : `₹${amount.toFixed(2)}`;
}

function when(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function customerNote(order: LaundryOrder): string | null {
  return order.specialInstructions?.trim() || order.buyerComment?.trim() || null;
}

export function LaundryOrderPage() {
  const { orderId = '' } = useParams();
  const location = useLocation();
  const openedWith = (location.state as { payError?: string } | null)?.payError ?? null;
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [order, setOrder] = useState<LaundryOrder | null>(null);
  const [error, setError] = useState<string | null>(openedWith);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmPay, setConfirmPay] = useState(false);

  useEffect(() => {
    if (!token || !orderId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchLaundryOrder(token, orderId)
      .then((row) => {
        if (!cancelled) setOrder(row);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load this order');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, token]);

  async function pay() {
    if (!token || !order) return;
    setBusy(true);
    setError(null);
    try {
      const storedGateway = sessionStorage.getItem('hlm:lastPaymentGateway');
      const gateway =
        storedGateway && /^(RAZORPAY|CASHFREE|PHONEPE)$/i.test(storedGateway) ? storedGateway : undefined;
      const started = await retryLaundryPayment(token, order.id, gateway);
      const checkout = await resolveOnlineCheckout({
        token,
        payment: started,
        paymentGateway: gateway,
        retry: () => retryLaundryPayment(token, order.id, gateway),
      });
      const paid = await openGatewayCheckout(checkout, { contact: session?.phone });
      await confirmOnlinePaymentResilient(token, paid);
      setOrder(await fetchLaundryOrder(token, order.id));
    } catch (err) {
      if (!(err instanceof CheckoutDismissedError)) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Payment failed');
      }
    } finally {
      setBusy(false);
    }
  }

  const total = order ? Number(order.goodsAmount) + Number(order.platformFeeAmount || 0) + Number(order.codFee || 0) : 0;
  const pickup = order?.pickupSlotStart ? `${when(order.pickupSlotStart)}${order.pickupSlotEnd ? ` – ${when(order.pickupSlotEnd)}` : ''}` : '';
  const timeline = useMemo(() => (order ? buildLaundryBuyerTimeline(order) : []), [order]);

  return (
    <PortalShell title="Laundry order" showDeliveryBanner={false} showStickyCart={false}>
      <div style={styles.pageRail}>
      <Link to="/orders" style={styles.back}>
        <span style={styles.backChev} aria-hidden>
          ‹
        </span>
        My orders
      </Link>

      {loading ? <p style={styles.muted}>Loading order…</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
      {order ? (
        <div style={styles.stack}>
        <article style={styles.card}>
          <div style={styles.head}>
            <strong>{order.orderNumber}</strong>
            <span style={styles.pill}>{order.statusLabel}</span>
          </div>
          <p style={styles.shop}>{order.shopName} · {money(total)} · {order.paymentMethod === 'UPI' ? 'UPI' : 'Cash'}</p>
          {laundryAgentCashBuyerNote(order.agentCashPickupReport, order.agentCashDropReport) ? (
            <p style={styles.payNote}>
              {laundryAgentCashBuyerNote(order.agentCashPickupReport, order.agentCashDropReport)}
            </p>
          ) : null}
          <LaundryCustomerNote note={customerNote(order)} />
          <p style={styles.muted}>{laundryLabel('logistics', order.logistics)}</p>
          {order.addressText ? <p style={styles.muted}>{order.addressText}</p> : null}
          {pickup ? <p style={styles.line}><span>Pickup</span><strong>{pickup}</strong></p> : null}
          <p style={styles.line}>
            <span>Estimated ready</span>
            <strong>{order.estimatedReadyAt ? when(order.estimatedReadyAt) : 'Shop will set this'}</strong>
          </p>
        </article>

        {timeline.length > 0 ? (
          <OrderStatusTimeline
            steps={timeline}
            orderStatus={order.status}
            displayStatus={order.statusLabel}
          />
        ) : null}

        <article style={styles.card}>
          <ul style={styles.lines}>
            {order.lines.map((line) => (
              <li key={line.id} style={styles.item}>
                <span>{line.confirmedQuantity} × {line.otherLabel || laundryLabel('item', line.itemType)}</span>
                <span style={styles.muted}>{laundryLabel('service', line.serviceType)}</span>
                <strong>{money(Number(line.lineAmount || line.unitPrice * line.confirmedQuantity))}</strong>
              </li>
            ))}
          </ul>
          <div style={styles.bill}>
            <span>Pieces</span><span>{money(Number(order.goodsAmount) - Number(order.logisticsCharge || 0))}</span>
            <span>Trip</span><span>{money(Number(order.logisticsCharge || 0))}</span>
            <span>Platform fee</span><span>{money(Number(order.platformFeeAmount || 0))}</span>
            {Number(order.codFee) > 0 ? (<><span>COD charge</span><span>{money(Number(order.codFee))}</span></>) : null}
            <strong>Pay the shop</strong><strong>{money(total)}</strong>
          </div>
          {Number(order.walletCredited) > 0 ? <p style={styles.note}>₹{Number(order.walletCredited)} is in your wallet.</p> : null}
          {order.status === 'AWAITING_PAYMENT' ? (
            <div style={styles.actions}>
              <button type="button" style={styles.primaryBtn} disabled={busy} onClick={() => setConfirmPay(true)}>Pay now</button>
            </div>
          ) : null}
        </article>
        </div>
      ) : null}
      </div>
      <ConfirmDialog
        open={confirmPay}
        title="Pay online now?"
        description="You will complete payment in the payment app, then return here."
        confirmLabel="Continue to pay"
        busy={busy}
        onClose={() => setConfirmPay(false)}
        onConfirm={() => {
          setConfirmPay(false);
          void pay();
        }}
      />
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  pageRail: {
    width: 'min(100%, 26rem)',
    marginInline: 'auto',
    display: 'grid',
    gap: '0.55rem',
    minWidth: 0,
  },
  back: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.15rem',
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: '0.88rem',
    padding: '0.35rem 0.5rem 0.35rem 0.15rem',
    marginLeft: '-0.15rem',
    borderRadius: 10,
  },
  backChev: { fontSize: '1.25rem', lineHeight: 1, marginTop: -1 },
  stack: { display: 'grid', gap: '0.55rem' },
  card: { display: 'grid', gap: '0.45rem', padding: '0.7rem 0.75rem', borderRadius: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border)' },
  head: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' },
  pill: { fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--accent-hover)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', borderRadius: 999, padding: '0.15rem 0.45rem' },
  shop: { margin: 0, fontWeight: 800 },
  payNote: {
    margin: 0,
    padding: '0.4rem 0.5rem',
    borderRadius: 10,
    fontSize: '0.78rem',
    fontWeight: 650,
    lineHeight: 1.35,
    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
    border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
  },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem' },
  line: { margin: 0, display: 'flex', justifyContent: 'space-between', gap: '0.6rem', fontSize: '0.82rem' },
  lines: { listStyle: 'none', margin: 0, padding: '0.35rem 0.45rem', display: 'grid', gap: '0.35rem', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' },
  item: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.1rem 0.6rem', fontSize: '0.84rem', fontWeight: 700 },
  bill: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.12rem 0.8rem', maxWidth: 260, fontSize: '0.8rem' },
  note: { margin: 0, fontSize: '0.8rem' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 0.85rem', borderRadius: 10, border: 0, background: 'var(--accent)', color: '#fff', fontWeight: 800 },
  error: { color: '#b91c1c', fontWeight: 700 },
};
