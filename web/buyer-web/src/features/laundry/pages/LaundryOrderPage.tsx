import { useEffect, useMemo, useState } from 'react';
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
import { useBuyerAlerts } from '@/features/shop/hooks/useBuyerAlerts';
import { BUYER_ORDER_LAYOUT_CSS } from '@/shared/layout/buyerOrderLayout';

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
  const { markOrderSeen } = useBuyerAlerts();
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
    if (orderId) markOrderSeen(orderId);
  }, [orderId, markOrderSeen]);

  useEffect(() => {
    if (!token || !orderId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchLaundryOrder(token, orderId)
      .then((row) => {
        if (!cancelled) {
          setError(null);
          setOrder(row);
        }
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
  const pickup = order?.pickupSlotStart
    ? `${when(order.pickupSlotStart)}${order.pickupSlotEnd ? ` – ${when(order.pickupSlotEnd)}` : ''}`
    : '';
  const timeline = useMemo(() => (order ? buildLaundryBuyerTimeline(order) : []), [order]);

  return (
    <PortalShell hideTitle showDeliveryBanner={false} showStickyCart={false} showTownPicker={false}>
      <style>{BUYER_ORDER_LAYOUT_CSS}</style>
      <div className="hlm-buyer-order">
        <Link to="/orders" className="hlm-buyer-order-back">
          <span className="hlm-buyer-order-back-chev" aria-hidden>
            ‹
          </span>
          My orders
        </Link>

        {loading ? <p className="hlm-buyer-order-muted">Loading order…</p> : null}
        {error ? <p className="hlm-buyer-order-error">{error}</p> : null}
        {order ? (
          <div className="hlm-buyer-order-stack">
            <header className="hlm-buyer-order-hero hlm-buyer-order-span-full">
              <div className="hlm-buyer-order-hero-main">
                <div className="hlm-buyer-order-hero-top">
                  <span className="hlm-buyer-order-id">{order.orderNumber}</span>
                  <span className="hlm-buyer-order-pill">{order.statusLabel}</span>
                </div>
                <h1 className="hlm-buyer-order-title">Laundry order</h1>
                <p className="hlm-buyer-order-lead">
                  {order.shopName} · {order.paymentMethod === 'UPI' ? 'UPI' : 'Cash'}
                </p>
                {laundryAgentCashBuyerNote(order.agentCashPickupReport, order.agentCashDropReport) ? (
                  <p className="hlm-buyer-order-pay-note">
                    {laundryAgentCashBuyerNote(order.agentCashPickupReport, order.agentCashDropReport)}
                  </p>
                ) : null}
                <LaundryCustomerNote note={customerNote(order)} />
                <p className="hlm-buyer-order-muted">{laundryLabel('logistics', order.logistics)}</p>
                {order.addressText ? <p className="hlm-buyer-order-muted">{order.addressText}</p> : null}
                {pickup ? (
                  <p className="hlm-buyer-order-row">
                    <span>Pickup</span>
                    <strong>{pickup}</strong>
                  </p>
                ) : null}
                <p className="hlm-buyer-order-row">
                  <span>Estimated ready</span>
                  <strong>{order.estimatedReadyAt ? when(order.estimatedReadyAt) : 'Shop will set this'}</strong>
                </p>
              </div>
              <div className="hlm-buyer-order-total-chip" aria-label="Order total">
                <span className="hlm-buyer-order-total-label">Pay the shop</span>
                <span className="hlm-buyer-order-total-amt">{money(total)}</span>
              </div>
            </header>

            <div className="hlm-buyer-order-col-aside">
              {timeline.length > 0 ? (
                <OrderStatusTimeline
                  steps={timeline}
                  orderStatus={order.status}
                  displayStatus={order.statusLabel}
                  defaultExpanded
                />
              ) : null}
              {order.status === 'AWAITING_PAYMENT' ? (
                <article className="hlm-buyer-order-card">
                  <h2 className="hlm-buyer-order-section-title">Complete payment</h2>
                  <p className="hlm-buyer-order-muted">Pay online to confirm this pickup.</p>
                  <button
                    type="button"
                    className="hlm-buyer-order-primary-btn"
                    disabled={busy}
                    onClick={() => setConfirmPay(true)}
                  >
                    Pay now
                  </button>
                </article>
              ) : null}
            </div>

            <div className="hlm-buyer-order-col-main">
            <article className="hlm-buyer-order-card">
              <h2 className="hlm-buyer-order-section-title">Pieces</h2>
              <ul className="hlm-buyer-order-lines">
                {order.lines.map((line) => (
                  <li key={line.id} className="hlm-buyer-order-line-item">
                    <span>
                      {line.confirmedQuantity} × {line.otherLabel || laundryLabel('item', line.itemType)}
                    </span>
                    <span className="hlm-buyer-order-muted">{laundryLabel('service', line.serviceType)}</span>
                    <strong>{money(Number(line.lineAmount || line.unitPrice * line.confirmedQuantity))}</strong>
                  </li>
                ))}
              </ul>
              <div className="hlm-buyer-order-bill">
                <span>Pieces</span>
                <span>{money(Number(order.goodsAmount) - Number(order.logisticsCharge || 0))}</span>
                <span>Trip</span>
                <span>{money(Number(order.logisticsCharge || 0))}</span>
                <span>Platform fee</span>
                <span>{money(Number(order.platformFeeAmount || 0))}</span>
                {Number(order.codFee) > 0 ? (
                  <>
                    <span>COD charge</span>
                    <span>{money(Number(order.codFee))}</span>
                  </>
                ) : null}
                <strong>Total</strong>
                <strong>{money(total)}</strong>
              </div>
              {Number(order.walletCredited) > 0 ? (
                <p className="hlm-buyer-order-muted">₹{Number(order.walletCredited)} is in your wallet.</p>
              ) : null}
            </article>
            </div>
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