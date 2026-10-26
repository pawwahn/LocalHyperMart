import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { CheckoutDismissedError, openGatewayCheckout } from '@/features/shop/lib/gatewayCheckout';
import { confirmOnlinePayment } from '@/features/shop/api/shopApi';
import { resolveCheckoutForPayment } from '@/features/shop/lib/paymentCheckoutPoll';
import { OrderStatusTimeline, type TimelineStep } from '@/features/shop/components/OrderStatusTimeline';
import { buildBeautyBuyerTimeline } from '../lib/beautyOrderProgress';
import { StarRating } from '@/features/shop/components/StarRating';
import { beautyPaymentPlanView } from '@hlm-beauty';
import {
  BEAUTY_SERVICES,
  beautyOccasionLabel,
  beautyServiceLabel,
  cancelBeautyOrder,
  fetchBeautyOrder,
  rateBeautyBooking,
  retryBeautyPayment,
  type BeautyOrder,
} from '../api/beautyApi';

function money(n: number): string {
  const v = Number(n || 0);
  return Number.isInteger(v) ? `₹${v}` : `₹${v.toFixed(0)}`;
}

function formatSlot(start?: string | null, end?: string | null): string {
  if (!start) return '';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const day = s.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const t1 = s.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const t2 = e
    ? e.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    : '';
  return t2 ? `${day} · ${t1} – ${t2}` : `${day} · ${t1}`;
}

type BookedRow = { code: string; label: string; emoji: string };

function bookedServices(order: BeautyOrder): BookedRow[] {
  const codes =
    order.serviceTypes?.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean) ??
    (order.serviceType ? [order.serviceType.trim().toUpperCase()] : []);
  const labels =
    order.bookedServiceLabels?.length ?
      order.bookedServiceLabels
    : order.serviceLabel?.includes('+') ?
      order.serviceLabel.split(/\s*\+\s*/).map((s) => s.trim())
    : order.serviceLabel ?
      [order.serviceLabel]
    : codes.map((c) => beautyServiceLabel(c));

  return labels.map((label, i) => {
    const code = codes[i] ?? codes[0] ?? '';
    const catalog = BEAUTY_SERVICES.find((s) => s.id === code);
    return {
      code,
      label,
      emoji: catalog?.emoji ?? '✨',
    };
  });
}

function toTimelineSteps(order: BeautyOrder): TimelineStep[] {
  const rows = buildBeautyBuyerTimeline(order);
  return rows.map((row) => ({
    code: row.label,
    label: row.label,
    state: row.current ? 'CURRENT' : row.done ? 'DONE' : 'UPCOMING',
  }));
}

export function BeautyOrderPage() {
  const { orderId } = useParams();
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { payError?: string; payNotice?: string } | null;
  const payError = routeState?.payError;
  const payNotice = routeState?.payNotice;

  const [order, setOrder] = useState<BeautyOrder | null>(null);
  const [error, setError] = useState<string | null>(payError ?? null);
  const [notice, setNotice] = useState<string | null>(payNotice ?? null);
  const [busy, setBusy] = useState(false);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState('');

  useEffect(() => {
    if (!token || !orderId) return;
    let cancelled = false;
    fetchBeautyOrder(token, orderId)
      .then((row) => {
        if (!cancelled) {
          setOrder(row);
          if (row.myRatingStars) setRatingStars(row.myRatingStars);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load booking');
      });
    return () => {
      cancelled = true;
    };
  }, [token, orderId]);

  async function payNow() {
    if (!token || !order) return;
    setBusy(true);
    setError(null);
    try {
      const info = (await retryBeautyPayment(token, order.id)) as BeautyOrder['payment'];
      const checkout = await resolveCheckoutForPayment(token, info, { timeoutMs: 24_000, intervalMs: 250 });
      const paid = await openGatewayCheckout(checkout, { contact: session?.phone });
      await confirmOnlinePayment(token, paid);
      const fresh = await fetchBeautyOrder(token, order.id);
      setOrder(fresh);
    } catch (err) {
      if (!(err instanceof CheckoutDismissedError)) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Payment failed');
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitRating() {
    if (!token || !order || ratingStars < 1) return;
    setBusy(true);
    setError(null);
    try {
      const fresh = await rateBeautyBooking(token, order.id, {
        stars: ratingStars,
        comment: ratingComment.trim() || undefined,
      });
      setOrder(fresh);
      window.dispatchEvent(new Event('hlm:scratch-refresh'));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save rating');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!token || !order) return;
    setBusy(true);
    try {
      const fresh = await cancelBeautyOrder(token, order.id);
      setOrder(fresh);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not cancel');
    } finally {
      setBusy(false);
    }
  }

  const services = useMemo(() => (order ? bookedServices(order) : []), [order]);
  const timelineSteps = useMemo(() => (order ? toTimelineSteps(order) : []), [order]);

  const payPlan = useMemo(
    () => (order ? beautyPaymentPlanView(order, 'buyer') : null),
    [order],
  );
  const total = payPlan?.total ?? 0;
  const collected = payPlan?.paidOnline ?? 0;
  const balanceDue = payPlan?.dueAtVisit ?? 0;
  const needsPay =
    order?.status === 'AWAITING_PAYMENT' ||
    (order?.status === 'CONFIRMED' && order?.paymentStatus === 'PARTIAL' && balanceDue > 0);

  return (
    <PortalShell
      hideTitle
      showDeliveryBanner={false}
      showStickyCart={false}
      showTownPicker={false}
    >
      <style>{BOOKING_CSS}</style>
      <div className="hlm-booking">
        <Link to="/orders" className="hlm-booking-back">
          <span className="hlm-booking-back-chev" aria-hidden>
            ‹
          </span>
          My bookings
        </Link>

        {notice ? <p className="hlm-booking-notice">{notice}</p> : null}
        {error ? <p className="hlm-booking-error">{error}</p> : null}
        {!order ? <p className="hlm-booking-muted">Loading…</p> : null}

        {order ? (
          <div className="hlm-booking-stack">
            <header className="hlm-booking-hero hlm-booking-span-full">
              <div className="hlm-booking-hero-main">
                <div className="hlm-booking-hero-top">
                  <span className="hlm-booking-id">{order.orderNumber}</span>
                  <span className="hlm-booking-status-pill">{order.statusLabel}</span>
                </div>
                <h1 className="hlm-booking-artist">{order.artistName}</h1>
                {order.occasion ? (
                  <p className="hlm-booking-occasion">{beautyOccasionLabel(order.occasion)}</p>
                ) : null}
                <p className="hlm-booking-slot">{formatSlot(order.slotStart, order.slotEnd)}</p>
                <p className="hlm-booking-venue">
                  {order.venueLabel ?? order.venue}
                  {order.addressText && order.venue === 'AT_HOME' ? ` · ${order.addressText}` : ''}
                  {order.studioAddress && order.venue === 'AT_STUDIO' ? ` · ${order.studioAddress}` : ''}
                </p>
              </div>
              <div className="hlm-booking-hero-pay" aria-label="Booking total">
                <span className="hlm-booking-hero-pay-label">Total</span>
                <span className="hlm-booking-hero-pay-amt">{money(total)}</span>
                {payPlan ? (
                  <>
                    <span
                      className={`hlm-booking-hero-pay-chip hlm-booking-hero-pay-chip--plan hlm-booking-hero-pay-chip--${payPlan.plan === 'PARTIAL' ? 'partial' : 'full'}`}
                    >
                      {payPlan.planBadge}
                    </span>
                    <span className={`hlm-booking-hero-pay-chip hlm-booking-hero-pay-chip--${payPlan.settlementTone}`}>
                      {order.status === 'AWAITING_PAYMENT' ? 'Payment pending' : payPlan.settlementBadge}
                    </span>
                  </>
                ) : null}
              </div>
            </header>

            <section className="hlm-booking-card hlm-booking-col-main" aria-label="Services booked">
              <h2 className="hlm-booking-card-title">Your services</h2>
              <ul className="hlm-booking-services">
                {services.map((row) => (
                  <li key={`${row.code}-${row.label}`} className="hlm-booking-service-row">
                    <span className="hlm-booking-service-emoji" aria-hidden>
                      {row.emoji}
                    </span>
                    <span className="hlm-booking-service-name">{row.label}</span>
                  </li>
                ))}
              </ul>
              {order.durationMinutes > 0 ? (
                <p className="hlm-booking-meta">About {order.durationMinutes} min</p>
              ) : null}
            </section>

            <section className="hlm-booking-card hlm-booking-pay hlm-booking-col-aside" aria-label="Payment">
              <div className="hlm-booking-pay-head">
                <h2 className="hlm-booking-card-title">Payment</h2>
              </div>
              {payPlan ? (
                <div className="hlm-booking-pay-plan" role="group" aria-label="Payment plan">
                  <div className="hlm-booking-pay-plan-badges">
                    <span
                      className={`hlm-booking-pay-plan-pill hlm-booking-pay-plan-pill--${payPlan.plan === 'PARTIAL' ? 'partial' : 'full'}`}
                    >
                      {payPlan.planBadge}
                    </span>
                    <span className={`hlm-booking-pay-badge hlm-booking-pay-badge--${payPlan.settlementTone}`}>
                      {order.status === 'AWAITING_PAYMENT' ? 'Payment pending' : payPlan.settlementBadge}
                    </span>
                  </div>
                  <p className="hlm-booking-pay-plan-desc">{payPlan.planDescription}</p>
                  <div className="hlm-booking-pay-summary">
                    <div>
                      <span className="hlm-booking-pay-summary-k">Paid online</span>
                      <strong className="hlm-booking-pay-summary-v hlm-booking-pay-summary-v--ok">
                        {money(payPlan.paidOnline)}
                      </strong>
                    </div>
                    <div>
                      <span className="hlm-booking-pay-summary-k">{payPlan.dueAtVisitLabel}</span>
                      <strong
                        className={`hlm-booking-pay-summary-v${payPlan.dueAtVisit > 0 ? ' hlm-booking-pay-summary-v--due' : ' hlm-booking-pay-summary-v--ok'}`}
                      >
                        {money(payPlan.dueAtVisit)}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="hlm-booking-receipt">
                <div className="hlm-booking-line">
                  <span>Services</span>
                  <span>{money(Number(order.serviceAmount))}</span>
                </div>
                {Number(order.travelCharge) > 0 ? (
                  <div className="hlm-booking-line">
                    <span>Travel</span>
                    <span>{money(Number(order.travelCharge))}</span>
                  </div>
                ) : null}
                {Number(order.platformFeeAmount) > 0 ? (
                  <div className="hlm-booking-line hlm-booking-line--muted">
                    <span>Platform fee</span>
                    <span>{money(Number(order.platformFeeAmount))}</span>
                  </div>
                ) : null}
                {Number(order.parlourPaymentFee) > 0 ? (
                  <div className="hlm-booking-line hlm-booking-line--muted">
                    <span>Pay-at-parlour fee</span>
                    <span>{money(Number(order.parlourPaymentFee))}</span>
                  </div>
                ) : null}
                <div className="hlm-booking-line hlm-booking-line--total">
                  <span>Total</span>
                  <span>{money(total)}</span>
                </div>
                {collected > 0 ? (
                  <div className="hlm-booking-line hlm-booking-line--paid">
                    <span>Paid online{order.paymentMethod === 'UPI' ? ' (UPI)' : ''}</span>
                    <span>{money(collected)}</span>
                  </div>
                ) : null}
                <div
                  className={
                    balanceDue > 0 ? 'hlm-booking-line hlm-booking-line--due' : 'hlm-booking-line hlm-booking-line--settled'
                  }
                >
                  <span>{payPlan?.dueAtVisitLabel ?? 'Pay at visit'}</span>
                  <span>{money(balanceDue)}</span>
                </div>
              </div>
              <p className="hlm-booking-pay-foot">{payPlan?.paymentMethodLabel ?? (order.paymentMethod === 'UPI' ? 'UPI' : 'Cash')}</p>
            </section>

            <div className="hlm-booking-span-full hlm-booking-timeline-wrap">
              <OrderStatusTimeline steps={timelineSteps} orderStatus={order.status} displayStatus={order.statusLabel} />
            </div>

            {order.specialInstructions ? (
              <section className="hlm-booking-card hlm-booking-span-full">
                <h2 className="hlm-booking-card-title">Your note</h2>
                <p className="hlm-booking-note">{order.specialInstructions}</p>
              </section>
            ) : null}

            {order.referencePhotoUrl ? (
              <img
                src={order.referencePhotoUrl}
                alt="Reference look"
                className="hlm-booking-ref-photo hlm-booking-span-full"
              />
            ) : null}

            {order.status === 'COMPLETED' && (order.myRatingStars || order.canRateBooking) ? (
              <section className="hlm-booking-card hlm-booking-rate hlm-booking-span-full">
                <h2 className="hlm-booking-card-title">{order.myRatingStars ? 'Your rating' : 'Rate your artist'}</h2>
                {order.myRatingStars ? (
                  <StarRating value={order.myRatingStars} readOnly size="md" label={`You rated ${order.myRatingStars} stars`} />
                ) : (
                  <>
                    <StarRating value={ratingStars} onChange={setRatingStars} size="md" label="Rate the artist" />
                    <label className="hlm-booking-rate-label">
                      Comment (optional)
                      <textarea
                        maxLength={400}
                        rows={2}
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        className="hlm-booking-textarea"
                        placeholder="How was the service?"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy || ratingStars < 1}
                      className="hlm-booking-btn-primary"
                      onClick={() => void submitRating()}
                    >
                      {busy ? 'Saving…' : 'Submit rating'}
                    </button>
                    <p className="hlm-booking-meta">Scratch card (if eligible) appears after you rate.</p>
                  </>
                )}
              </section>
            ) : null}

            <div className="hlm-booking-actions hlm-booking-span-full">
              {needsPay ? (
                <button type="button" disabled={busy} className="hlm-booking-btn-primary" onClick={() => void payNow()}>
                  {order.status === 'AWAITING_PAYMENT' ? 'Pay now' : `Pay balance ${money(balanceDue)}`}
                </button>
              ) : null}

              {order.status === 'CONFIRMED' || order.status === 'AWAITING_PAYMENT' ? (
                <button type="button" disabled={busy} className="hlm-booking-btn-ghost" onClick={() => void cancel()}>
                  Cancel booking
                </button>
              ) : null}

              <Link to="/beauty" className="hlm-booking-link">
                Book another look
              </Link>
            </div>
          </div>
        ) : null}

        {!token ? (
          <button type="button" className="hlm-booking-btn-ghost" onClick={() => navigate('/login')}>
            Sign in
          </button>
        ) : null}
      </div>
    </PortalShell>
  );
}

const BOOKING_CSS = `
.hlm-booking {
  width: 100%;
  min-width: 0;
  display: grid;
  gap: 0.5rem;
  padding-bottom: 1.25rem;
}
.hlm-booking-back {
  display: inline-flex;
  align-items: center;
  gap: 0.12rem;
  font-size: 0.88rem;
  font-weight: 800;
  color: var(--accent, #be185d);
  text-decoration: none;
  padding: 0.3rem 0.45rem 0.3rem 0.1rem;
  margin-left: -0.1rem;
  border-radius: 10px;
  width: fit-content;
}
.hlm-booking-back-chev {
  font-size: 1.2rem;
  line-height: 1;
  margin-top: -1px;
}
.hlm-booking-stack {
  display: grid;
  gap: 0.55rem;
  width: 100%;
  min-width: 0;
}
@media (min-width: 600px) {
  .hlm-booking-stack {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.6rem 0.75rem;
    align-items: start;
  }
  .hlm-booking-span-full {
    grid-column: 1 / -1;
  }
}
@media (min-width: 960px) {
  .hlm-booking-stack {
    grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.88fr);
    gap: 0.65rem 1rem;
  }
}
.hlm-booking-notice { margin: 0; color: #047857; font-weight: 700; font-size: 0.78rem; }
.hlm-booking-error { margin: 0; color: #b91c1c; font-weight: 700; font-size: 0.78rem; }
.hlm-booking-muted { margin: 0; color: var(--text-muted); font-weight: 600; }
.hlm-booking-hero {
  border-radius: 18px;
  padding: 0.75rem 0.85rem;
  background: linear-gradient(145deg, #fdf2f8 0%, #fff 55%, #fce7f3 100%);
  border: 1px solid #f9a8d4;
  box-shadow: 0 8px 24px rgba(190, 24, 93, 0.08);
  display: grid;
  gap: 0.55rem;
  align-items: start;
}
@media (min-width: 600px) {
  .hlm-booking-hero {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.75rem 1rem;
    padding: 0.85rem 1rem;
  }
}
.hlm-booking-hero-main {
  min-width: 0;
}
.hlm-booking-hero-pay {
  display: grid;
  gap: 0.15rem;
  justify-items: start;
  padding: 0.55rem 0.65rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid #fbcfe8;
  min-width: 7.5rem;
}
@media (min-width: 600px) {
  .hlm-booking-hero-pay {
    justify-items: end;
    text-align: right;
  }
}
.hlm-booking-hero-pay-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.hlm-booking-hero-pay-amt {
  font-size: 1.25rem;
  font-weight: 900;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: #111827;
  line-height: 1.1;
}
.hlm-booking-hero-pay-chip {
  font-size: 0.62rem;
  font-weight: 800;
  padding: 0.18rem 0.42rem;
  border-radius: 999px;
  max-width: 100%;
  line-height: 1.25;
}
.hlm-booking-hero-pay-chip--ok {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}
.hlm-booking-hero-pay-chip--warn {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}
.hlm-booking-hero-pay-chip--muted {
  background: #f3f4f6;
  color: #4b5563;
  border: 1px solid #e5e7eb;
}
.hlm-booking-hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.hlm-booking-id {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #9d174d;
  text-transform: uppercase;
}
.hlm-booking-status-pill {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  background: #fff;
  border: 1px solid #fbcfe8;
  color: #831843;
}
.hlm-booking-artist {
  margin: 0.35rem 0 0;
  font-size: 1.15rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: #111827;
}
.hlm-booking-occasion {
  margin: 0.2rem 0 0;
  font-size: 0.72rem;
  font-weight: 700;
  color: #be185d;
}
.hlm-booking-slot {
  margin: 0.45rem 0 0;
  font-size: 0.8rem;
  font-weight: 800;
  color: #374151;
}
.hlm-booking-venue {
  margin: 0.25rem 0 0;
  font-size: 0.72rem;
  font-weight: 600;
  color: #64748b;
  line-height: 1.4;
}
.hlm-booking-card {
  border-radius: 16px;
  padding: 0.75rem 0.8rem;
  background: var(--bg-elevated, #fff);
  border: 1px solid var(--border, #e5e7eb);
  box-shadow: var(--shadow-card, 0 4px 14px rgba(0,0,0,0.04));
}
.hlm-booking-card-title {
  margin: 0 0 0.45rem;
  font-size: 0.82rem;
  font-weight: 900;
  color: var(--text, #111);
}
.hlm-booking-services {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
  grid-template-columns: 1fr;
}
@media (min-width: 480px) and (max-width: 599px) {
  .hlm-booking-services:has(> li:nth-child(2)) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 960px) {
  .hlm-booking-services:has(> li:nth-child(2)) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.hlm-booking-service-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.5rem;
  border-radius: 12px;
  background: #fdf2f8;
  border: 1px solid #fce7f3;
}
.hlm-booking-service-emoji {
  width: 2rem;
  height: 2rem;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: #fff;
  font-size: 1.1rem;
  flex-shrink: 0;
}
.hlm-booking-service-name {
  font-size: 0.82rem;
  font-weight: 800;
  color: #111827;
}
.hlm-booking-meta {
  margin: 0.4rem 0 0;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-muted);
}
.hlm-booking-pay-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.hlm-booking-pay-plan {
  display: grid;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
  padding: 0.55rem 0.6rem;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.hlm-booking-pay-plan-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}
.hlm-booking-pay-plan-pill {
  font-size: 0.68rem;
  font-weight: 900;
  padding: 0.22rem 0.5rem;
  border-radius: 999px;
  letter-spacing: 0.02em;
}
.hlm-booking-pay-plan-pill--full {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}
.hlm-booking-pay-plan-pill--partial {
  background: #fdf4ff;
  color: #7e22ce;
  border: 1px solid #e9d5ff;
}
.hlm-booking-pay-plan-desc {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 600;
  color: #475569;
  line-height: 1.4;
}
.hlm-booking-pay-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem 0.75rem;
}
.hlm-booking-pay-summary-k {
  display: block;
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
}
.hlm-booking-pay-summary-v {
  display: block;
  font-size: 0.95rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  margin-top: 0.08rem;
}
.hlm-booking-pay-summary-v--ok { color: #047857; }
.hlm-booking-pay-summary-v--due { color: #b45309; }
.hlm-booking-hero-pay-chip--plan.hlm-booking-hero-pay-chip--full {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}
.hlm-booking-hero-pay-chip--plan.hlm-booking-hero-pay-chip--partial {
  background: #fdf4ff;
  color: #7e22ce;
  border: 1px solid #e9d5ff;
}
.hlm-booking-pay-badge--danger {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}
.hlm-booking-pay-badge {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
}
.hlm-booking-pay-badge--ok {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}
.hlm-booking-pay-badge--warn {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}
.hlm-booking-pay-badge--muted {
  background: #f3f4f6;
  color: #4b5563;
  border: 1px solid #e5e7eb;
}
.hlm-booking-receipt {
  display: grid;
  gap: 0.3rem;
}
.hlm-booking-line {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.76rem;
  font-weight: 700;
  color: #374151;
}
.hlm-booking-line--muted span:first-child::before {
  content: '· ';
  color: #9ca3af;
}
.hlm-booking-line--total {
  margin-top: 0.25rem;
  padding-top: 0.35rem;
  border-top: 1px dashed var(--border, #e5e7eb);
  font-size: 0.88rem;
  font-weight: 900;
  color: #111;
}
.hlm-booking-line--paid span:last-child { color: #047857; }
.hlm-booking-line--due span:last-child { color: #b45309; }
.hlm-booking-line--settled span:last-child { color: #047857; font-weight: 800; }
.hlm-booking-pay-foot {
  margin: 0.45rem 0 0;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-muted);
}
.hlm-booking-note {
  margin: 0;
  font-size: 0.76rem;
  font-weight: 600;
  color: #374151;
  line-height: 1.45;
}
.hlm-booking-ref-photo {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 14px;
  border: 1px solid var(--border);
}
.hlm-booking-rate { display: grid; gap: 0.45rem; }
.hlm-booking-rate-label {
  display: grid;
  gap: 0.25rem;
  font-size: 0.72rem;
  font-weight: 700;
}
.hlm-booking-textarea {
  border-radius: 10px;
  border: 1px solid var(--border);
  padding: 0.45rem 0.5rem;
  font-family: inherit;
  font-size: 0.72rem;
}
.hlm-booking-btn-primary {
  min-height: 46px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #be185d, #db2777);
  color: #fff;
  font-weight: 900;
  font-size: 0.88rem;
  cursor: pointer;
}
.hlm-booking-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.hlm-booking-btn-ghost {
  min-height: 44px;
  border-radius: 14px;
  border: 1px solid #fca5a5;
  background: #fff;
  color: #b91c1c;
  font-weight: 800;
  font-size: 0.82rem;
  cursor: pointer;
}
.hlm-booking-btn-ghost:disabled { opacity: 0.55; }
.hlm-booking-actions {
  display: grid;
  gap: 0.45rem;
}
@media (min-width: 600px) {
  .hlm-booking-actions {
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    align-items: center;
  }
  .hlm-booking-link {
    justify-self: center;
  }
}
.hlm-booking-link {
  font-size: 0.78rem;
  font-weight: 800;
  color: #be185d;
  text-align: center;
  padding: 0.35rem;
}
.hlm-booking-timeline-wrap {
  min-width: 0;
}
.hlm-booking-timeline-wrap section {
  width: 100%;
}
`;
