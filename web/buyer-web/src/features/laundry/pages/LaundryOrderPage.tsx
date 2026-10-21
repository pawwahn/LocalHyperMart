import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { CheckoutDismissedError, checkoutCanOpen, openGatewayCheckout } from '@/features/shop/lib/gatewayCheckout';
import { confirmOnlinePayment, fetchPaymentCheckout } from '@/features/shop/api/shopApi';
import { pollUntilCheckoutReady } from '@/features/shop/lib/paymentCheckoutPoll';
import {
  cancelLaundryOrder,
  fetchLaundryOrder,
  laundryLabel,
  retryLaundryPayment,
  saveLaundryComment,
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

export function LaundryOrderPage() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const openedWith = (location.state as { payError?: string } | null)?.payError ?? null;
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [order, setOrder] = useState<LaundryOrder | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(openedWith);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || !orderId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchLaundryOrder(token, orderId)
      .then((row) => {
        if (cancelled) return;
        setOrder(row);
        setComment(row.buyerComment ?? '');
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

  async function saveComment() {
    if (!token || !order) return;
    setBusy(true);
    setError(null);
    try {
      const next = await saveLaundryComment(token, order.id, comment.trim());
      setOrder(next);
      setComment(next.buyerComment ?? '');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save the comment');
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!token || !order) return;
    setBusy(true);
    setError(null);
    try {
      const started = await retryLaundryPayment(token, order.id);
      let checkout = started?.checkout ?? null;
      if (!checkout?.gatewayOrderId && started?.paymentId) {
        checkout = await pollUntilCheckoutReady(() => fetchPaymentCheckout(token, started.paymentId!));
      }
      if (!checkoutCanOpen(checkout)) {
        setError('Online payment is not configured yet.');
        return;
      }
      const paid = await openGatewayCheckout(checkout, { contact: session?.phone });
      await confirmOnlinePayment(token, paid);
      setOrder(await fetchLaundryOrder(token, order.id));
    } catch (err) {
      if (!(err instanceof CheckoutDismissedError)) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Payment failed');
      }
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!token || !order) return;
    setBusy(true);
    setError(null);
    try {
      setOrder(await cancelLaundryOrder(token, order.id));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not cancel the order');
    } finally {
      setBusy(false);
    }
  }

  const total = order ? Number(order.goodsAmount) + Number(order.platformFeeAmount || 0) + Number(order.codFee || 0) : 0;
  const pickup = order?.pickupSlotStart ? `${when(order.pickupSlotStart)}${order.pickupSlotEnd ? ` – ${when(order.pickupSlotEnd)}` : ''}` : '';

  return (
    <PortalShell title="Laundry order" showDeliveryBanner={false} showStickyCart={false}>
      {loading ? <p style={styles.muted}>Loading order…</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
      {order ? (
        <article style={styles.card}>
          <div style={styles.head}>
            <strong>{order.orderNumber}</strong>
            <span style={styles.pill}>{order.statusLabel}</span>
          </div>
          <p style={styles.shop}>{order.shopName} · {money(total)} · {order.paymentMethod === 'UPI' ? 'UPI' : 'Cash'}</p>
          <p style={styles.muted}>{laundryLabel('logistics', order.logistics)}</p>
          {order.addressText ? <p style={styles.muted}>{order.addressText}</p> : null}
          {pickup ? <p style={styles.line}><span>Pickup</span><strong>{pickup}</strong></p> : null}
          <p style={styles.line}>
            <span>Estimated ready</span>
            <strong>{order.estimatedReadyAt ? when(order.estimatedReadyAt) : 'Shop will set this'}</strong>
          </p>
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
          {order.specialInstructions ? <p style={styles.note}>Care note: {order.specialInstructions}</p> : null}
          <label style={styles.field}>
            Your comment
            <textarea style={styles.input} rows={2} maxLength={400} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anything the shop should know" />
          </label>
          <button type="button" style={styles.secondary} disabled={busy} onClick={() => void saveComment()}>Save comment</button>
          <p style={styles.field}>Shop comment</p>
          <p style={styles.note}>{order.vendorComment || 'No comment from the shop yet.'}</p>
          <div style={styles.actions}>
            <Link to="/laundry" style={styles.primary}>Request Laundry service</Link>
            {order.status === 'AWAITING_PAYMENT' ? (
              <button type="button" style={styles.primaryBtn} disabled={busy} onClick={() => void pay()}>Pay now</button>
            ) : null}
            {order.allowedActions.includes('CANCEL') ? (
              <button type="button" style={styles.danger} disabled={busy} onClick={() => void cancel()}>Cancel order</button>
            ) : null}
            <button type="button" style={styles.ghost} onClick={() => navigate('/orders')}>Back to orders</button>
          </div>
        </article>
      ) : null}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { display: 'grid', gap: '0.4rem', padding: '0.7rem 0.75rem', borderRadius: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border)' },
  head: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' },
  pill: { fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--accent-hover)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', borderRadius: 999, padding: '0.15rem 0.45rem' },
  shop: { margin: 0, fontWeight: 800 },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem' },
  line: { margin: 0, display: 'flex', justifyContent: 'space-between', gap: '0.6rem', fontSize: '0.82rem' },
  lines: { listStyle: 'none', margin: 0, padding: '0.35rem 0.45rem', display: 'grid', gap: '0.35rem', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' },
  item: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.1rem 0.6rem', fontSize: '0.84rem', fontWeight: 700 },
  bill: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.12rem 0.8rem', maxWidth: 260, fontSize: '0.8rem' },
  field: { display: 'grid', gap: '0.15rem', margin: 0, fontSize: '0.72rem', fontWeight: 800 },
  input: { minHeight: 64, border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.5rem', background: '#fff', color: '#111', colorScheme: 'light', resize: 'vertical', font: 'inherit' },
  note: { margin: 0, fontSize: '0.8rem' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' },
  primary: { display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 0.85rem', borderRadius: 10, background: 'var(--accent)', color: '#fff', fontWeight: 800, textDecoration: 'none' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 0.85rem', borderRadius: 10, border: 0, background: 'var(--accent)', color: '#fff', fontWeight: 800 },
  secondary: { minHeight: 40, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text)', fontWeight: 800, padding: '0 0.75rem', justifySelf: 'start' },
  danger: { minHeight: 40, borderRadius: 10, border: 0, background: 'var(--danger-soft, #fee2e2)', color: 'var(--danger, #b91c1c)', fontWeight: 800, padding: '0 0.75rem' },
  ghost: { minHeight: 40, border: 0, background: 'transparent', color: 'var(--text-muted)', fontWeight: 700 },
  error: { color: '#b91c1c', fontWeight: 700 },
};
