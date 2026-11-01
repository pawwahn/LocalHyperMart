import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Banner, Button, Card, EmptyState, LoadingBlock } from '@/shared/ui';
import { useAuth } from '@/shared/auth/AuthContext';
import { useShop } from '../hooks/useShop';
import { useOrderDetail } from '../hooks/useOrderDetail';
import { formatBuyerPaymentLabel } from '../lib/formatBuyerPaymentLabel';
import { CheckoutDismissedError, openGatewayCheckout } from '../lib/gatewayCheckout';
import { resolveOnlineCheckout } from '../lib/loadOnlineCheckout';
import { confirmOnlinePaymentResilient, retryOnlinePayment } from '../api/shopApi';
import { OrderStatusTimeline } from '../components/OrderStatusTimeline';
import { ReasonDialog } from '../components/ReasonDialog';
import { ClaimDialog } from '../components/ClaimDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StarRating } from '../components/StarRating';
import { ScratchCardSheet } from '../components/ScratchCardSheet';
import type { ClaimType, OrderDetailDto } from '../api/shopApi';
import { membershipSlabLabel } from '../lib/membershipSlabLabel';

function money(v: number | null | undefined): string {
  return `₹${Number(v ?? 0).toFixed(2)}`;
}

function formatAddress(address?: Record<string, unknown> | null): string[] {
  if (!address) return [];
  const lines: string[] = [];
  const name = String(address.recipientName ?? address.name ?? '');
  const phone = String(address.recipientPhone ?? address.phone ?? '');
  const line1 = String(address.line1 ?? '');
  const line2 = String(address.line2 ?? '');
  const landmark = String(address.landmark ?? '');
  const pincode = String(address.pincode ?? '');
  if (name || phone) lines.push([name, phone].filter(Boolean).join(' · '));
  if (line1) lines.push(line1);
  if (line2) lines.push(line2);
  if (landmark) lines.push(`Near ${landmark}`);
  if (pincode) lines.push(`PIN ${pincode}`);
  return lines;
}

const ORDER_CANCEL_REASONS = [
  'Changed my mind',
  'Ordered by mistake',
  'Found a better price',
  'Delivery taking too long',
  'Wrong address / contact details',
  'Other',
];

const ITEM_CANCEL_REASONS = [
  'Changed my mind',
  'Don’t need this item',
  'Ordered wrong item / quantity',
  'Price concern',
  'Other',
];

function claimTypeLabel(type: string): string {
  switch (type) {
    case 'WRONG_ITEM':
      return 'Wrong item';
    case 'DAMAGED':
      return 'Damaged';
    default:
      return 'Missing';
  }
}

function displayPaymentLabel(order: OrderDetailDto): string {
  return formatBuyerPaymentLabel({
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    orderStatus: order.status,
  })
    .replace('(', ' · ')
    .replace(')', '');
}

function statusPillStyle(status: string): CSSProperties {
  const s = status.toLowerCase();
  if (s.includes('deliver') && !s.includes('out')) {
    return styles.statusPillSuccess;
  }
  if (s.includes('out for') || s.includes('on the way') || s.includes('going')) {
    return styles.statusPillRoute;
  }
  if (s.includes('cancel') || s.includes('fail')) {
    return styles.statusPillDanger;
  }
  if (s.includes('pending') || s.includes('payment')) {
    return styles.statusPillWarn;
  }
  return styles.statusPillBrand;
}

type CancelTarget =
  | { kind: 'order' }
  | { kind: 'item'; itemId: string; itemName: string }
  | null;

export function OrderDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId } = useParams<{ orderId: string }>();
  const preview = (location.state as { preview?: OrderDetailDto } | null)?.preview ?? null;
  const { session } = useAuth();
  const { cart } = useShop();
  const {
    order,
    claims,
    loading,
    error,
    invoiceBusy,
    invoiceError,
    cancelBusy,
    claimBusy,
    agentRatingBusy,
    reload,
    downloadInvoice,
    cancelWholeOrder,
    cancelItem,
    fileClaim,
    submitRating,
    submitDeliveryRating,
  } = useOrderDetail(orderId, preview);

  const [cancelTarget, setCancelTarget] = useState<CancelTarget>(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [draftRatings, setDraftRatings] = useState<Record<string, number>>({});
  const [agentStars, setAgentStars] = useState(5);
  const [agentComment, setAgentComment] = useState('');
  const [claimPresetItemId, setClaimPresetItemId] = useState<string | null>(null);
  const [scratchOpen, setScratchOpen] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [resultDialog, setResultDialog] = useState<{ title: string; description: string } | null>(
    null,
  );

  useEffect(() => {
    const rating = order?.deliveryAgentRating;
    if (rating?.stars) setAgentStars(rating.stars);
    if (rating?.comment) setAgentComment(rating.comment);
  }, [order?.orderId, order?.deliveryAgentRating?.stars, order?.deliveryAgentRating?.comment]);

  const canDownloadInvoice = Boolean(order?.invoicePdfUrl);
  const blockedClaimItemIds = new Set(
    claims
      .filter((c) => c.status === 'OPEN' || c.status === 'RESOLVED')
      .map((c) => c.orderItemId)
      .filter(Boolean) as string[],
  );
  const claimableItems = (order?.items ?? [])
    .filter((item) => item.canFileClaim && item.orderItemId && !blockedClaimItemIds.has(item.orderItemId))
    .map((item) => ({
      ...item,
      canFileClaim: true,
    }));
  const unitCount = (order?.items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
  const canPayOnline =
    Boolean(order?.canPayOnline) ||
    ((order?.paymentMethod || '').toUpperCase() === 'ONLINE' &&
      (order?.status === 'PAYMENT_PENDING' || order?.status === 'PAYMENT_FAILED'));

  async function onConfirmCancel(reason: string) {
    if (!cancelTarget) return;
    try {
      if (cancelTarget.kind === 'order') {
        const beforeCredit = Number(order?.storeCreditApplied ?? 0);
        const method = (order?.paymentMethod || '').toUpperCase();
        const payable = Number(order?.totalAmount ?? 0);
        await cancelWholeOrder(reason);
        setCancelTarget(null);
        let description =
          'Your order was cancelled. COD orders are not charged until delivery — so there was nothing to refund.';
        if (method === 'ONLINE' && payable > 0) {
          description =
            'Online payment refund has been started. Any wallet credit used at checkout was also restored.';
        } else if (method === 'ONLINE' && payable <= 0) {
          description =
            beforeCredit > 0
              ? 'Order was paid fully from wallet — that credit was restored.'
              : 'Order cancelled. No online payment was captured.';
        } else if (beforeCredit > 0) {
          description = 'Any wallet credit used on this order was restored to your wallet.';
        }
        setResultDialog({
          title: 'Order cancelled',
          description,
        });
      } else {
        await cancelItem(cancelTarget.itemId, reason);
        setCancelTarget(null);
        setResultDialog({
          title: 'Item cancelled',
          description: `${cancelTarget.itemName} was cancelled. The amount was added to your wallet as store credit.`,
        });
      }
    } catch (err) {
      setCancelTarget(null);
      setResultDialog({
        title: 'Couldn’t cancel',
        description: err instanceof Error ? err.message : 'Please try again in a moment.',
      });
    }
  }

  async function onPayOnline() {
    if (!session?.accessToken || !order) return;
    setPayBusy(true);
    try {
      const storedGateway = sessionStorage.getItem('hlm:lastPaymentGateway');
      const gateway =
        storedGateway && /^(RAZORPAY|CASHFREE|PHONEPE)$/i.test(storedGateway) ? storedGateway : undefined;
      const retry = await retryOnlinePayment(session.accessToken, order.orderId, gateway);
      const checkout = await resolveOnlineCheckout({
        token: session.accessToken,
        payment: retry,
        paymentGateway: gateway,
        retry: () => retryOnlinePayment(session.accessToken, order.orderId, gateway),
      });
      const paid = await openGatewayCheckout(checkout, { contact: session.phone });
      await confirmOnlinePaymentResilient(session.accessToken, paid);
      await reload();
    } catch (err) {
      if (!(err instanceof CheckoutDismissedError)) {
        setResultDialog({
          title: 'Payment not completed',
          description: err instanceof Error ? err.message : 'Try again.',
        });
      }
    } finally {
      setPayBusy(false);
    }
  }

  async function onConfirmClaim(payload: {
    claimType: ClaimType;
    orderItemId: string;
    reason: string;
  }) {
    try {
      const itemName =
        order?.items.find((i) => i.orderItemId === payload.orderItemId)?.name ?? 'item';
      await fileClaim(payload.claimType, payload.reason, payload.orderItemId);
      setClaimOpen(false);
      setClaimPresetItemId(null);
      setResultDialog({
        title: 'Issue reported',
        description: `Thanks — we logged your claim for ${itemName}. The town hub will review and may add store credit up to that line’s amount.`,
      });
    } catch (err) {
      setClaimOpen(false);
      setClaimPresetItemId(null);
      setResultDialog({
        title: 'Couldn’t file claim',
        description: err instanceof Error ? err.message : 'Please try again in a moment.',
      });
    }
  }

  const statusLabel = order?.displayStatus || order?.status || '';

  return (
    <PortalShell
      hideTitle
      cartCount={cart?.itemCount ?? 0}
      onRefresh={() => void reload()}
      showDeliveryBanner={false}
      showTownPicker={false}
    >
      <div style={styles.pageRail}>
      <Link to="/orders" style={styles.back}>
        <span style={styles.backChev} aria-hidden>
          ‹
        </span>
        My orders
      </Link>

      {loading && !order ? (
        <LoadingBlock label="Loading order details…" />
      ) : error && !order ? (
        <EmptyState
          icon="⚠️"
          title="Couldn’t open this order"
          description={error}
          actionLabel="Back to orders"
          onAction={() => navigate('/orders')}
        />
      ) : order ? (
        <div style={styles.stack}>
          <section style={styles.heroCard}>
            <div style={styles.heroTop}>
              <span style={{ ...styles.statusPill, ...statusPillStyle(statusLabel) }}>{statusLabel}</span>
              <span style={styles.payChip}>{displayPaymentLabel(order)}</span>
            </div>
            <h1 style={styles.heroOrderNo}>{order.orderNumber}</h1>
            <p style={styles.heroTotalRow}>
              <span style={styles.heroTotalLabel}>
                {order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID'
                  ? 'Pay at delivery'
                  : 'Order total'}
              </span>
              <span style={styles.heroTotalAmount}>{money(order.totalAmount)}</span>
            </p>

            <div style={styles.actionPrimary}>
              {canPayOnline ? (
                <Button variant="primary" fullWidth disabled={payBusy} onClick={() => void onPayOnline()}>
                  {payBusy ? 'Opening payment…' : `Pay ${money(order.totalAmount)} now`}
                </Button>
              ) : null}
              <Button
                variant={canPayOnline ? 'ghost' : 'primary'}
                fullWidth
                disabled={!canDownloadInvoice || invoiceBusy}
                onClick={() => void downloadInvoice()}
              >
                {invoiceBusy ? 'Preparing PDF…' : 'Download invoice'}
              </Button>
            </div>
            {!canDownloadInvoice && !canPayOnline ? (
              <p style={styles.hint}>Invoice appears after payment is confirmed.</p>
            ) : null}
            {invoiceError ? <Banner tone="danger">{invoiceError}</Banner> : null}

            {order.canCancelOrder || (order.canFileClaim && claimableItems.length > 0) ? (
              <div style={styles.actionSecondary}>
                {order.canCancelOrder ? (
                  <button
                    type="button"
                    style={styles.linkActionDanger}
                    disabled={cancelBusy}
                    onClick={() => setCancelTarget({ kind: 'order' })}
                  >
                    Cancel order
                  </button>
                ) : null}
                {order.canFileClaim && claimableItems.length > 0 ? (
                  <button
                    type="button"
                    style={styles.linkAction}
                    disabled={claimBusy}
                    onClick={() => {
                      setClaimPresetItemId(null);
                      setClaimOpen(true);
                    }}
                  >
                    Report issue
                  </button>
                ) : null}
              </div>
            ) : null}
            {order.canCancelOrder ? (
              <p style={styles.cancelHint}>
                Cancel before shops mark ready; after that, cancel individual items still waiting.
              </p>
            ) : null}
          </section>

          {order.scratchCard ? (
            <Card elevated style={styles.scratchCard}>
              <div style={styles.scratchRow}>
                <div>
                  <p style={styles.scratchTitle}>
                    {order.scratchCard.status === 'REVEALED' ? 'Scratch card credited' : 'Scratch card'}
                  </p>
                  <p style={styles.meta}>
                    {order.scratchCard.status === 'REVEALED'
                      ? `₹${Number(order.scratchCard.revealedAmount ?? 0).toFixed(0)} added to wallet`
                      : 'Scratch to reveal your surprise'}
                  </p>
                </div>
                {order.scratchCard.status === 'ISSUED' && session?.accessToken ? (
                  <Button size="sm" onClick={() => setScratchOpen(true)}>
                    Scratch
                  </Button>
                ) : null}
              </div>
            </Card>
          ) : null}

          {order.deliveryAgentRating ? (
            <Card elevated style={styles.agentCard}>
              <div style={styles.agentHead}>
                <p style={styles.scratchTitle}>
                  {order.deliveryAgentRating.stars ? 'Your delivery rating' : 'Rate this delivery'}
                </p>
                {order.deliveryAgentRating.agentName ? (
                  <span style={styles.meta}>{order.deliveryAgentRating.agentName}</span>
                ) : null}
              </div>
              {order.deliveryAgentRating.stars && !order.deliveryAgentRating.canRate ? (
                <div style={styles.agentRated}>
                  <StarRating
                    value={order.deliveryAgentRating.stars}
                    readOnly
                    size="md"
                    label={`You rated delivery ${order.deliveryAgentRating.stars} stars`}
                  />
                  {order.deliveryAgentRating.comment ? (
                    <p style={styles.agentComment}>“{order.deliveryAgentRating.comment}”</p>
                  ) : (
                    <p style={styles.agentCommentMuted}>No comment</p>
                  )}
                </div>
              ) : (
                <div style={styles.agentForm}>
                  <StarRating
                    value={order.deliveryAgentRating.stars ?? agentStars}
                    onChange={setAgentStars}
                    size="md"
                    label="Rate the delivery agent"
                  />
                  <label style={styles.agentLabel}>
                    Comment (optional)
                    <textarea
                      style={styles.agentInput}
                      maxLength={400}
                      rows={2}
                      placeholder="On time, polite, careful with the bag…"
                      value={agentComment}
                      onChange={(e) => setAgentComment(e.target.value)}
                    />
                  </label>
                  <Button
                    size="sm"
                    fullWidth
                    disabled={agentRatingBusy}
                    onClick={() => {
                      void submitDeliveryRating(agentStars, agentComment)
                        .then(() =>
                          setResultDialog({
                            title: 'Thanks for rating',
                            description: 'Your delivery rating was saved for this order.',
                          }),
                        )
                        .catch((err) =>
                          setResultDialog({
                            title: 'Could not save rating',
                            description: err instanceof Error ? err.message : 'Please try again.',
                          }),
                        );
                    }}
                  >
                    {agentRatingBusy ? 'Saving…' : 'Submit rating'}
                  </Button>
                </div>
              )}
            </Card>
          ) : null}

          {order.timeline && order.timeline.length > 0 ? (
            <OrderStatusTimeline
              steps={order.timeline}
              orderStatus={order.status}
              displayStatus={order.displayStatus}
            />
          ) : null}

          <section style={styles.section}>
            <div style={styles.sectionHead}>
              <h2 style={styles.h2}>Items</h2>
              {(order.items?.length ?? 0) > 0 ? (
                <span style={styles.countBadge}>
                  {unitCount} pc{unitCount === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
            {(order.items?.length ?? 0) === 0 ? (
              <LoadingBlock label="Loading items…" />
            ) : (
              <div style={styles.itemList}>
                {order.items.map((item, index) => {
                  const cancelled = (item.status ?? 'ACTIVE').toUpperCase() === 'CANCELLED';
                  const canClaim =
                    Boolean(item.canFileClaim && item.orderItemId) &&
                    !blockedClaimItemIds.has(item.orderItemId!);
                  const last = index === (order.items?.length ?? 0) - 1;
                  return (
                    <div
                      key={item.orderItemId ?? `${item.name}-${item.shopName}-${index}`}
                      style={{ ...styles.itemRow, ...(last ? styles.itemRowLast : {}) }}
                    >
                      <div style={styles.itemTop}>
                        <p style={cancelled ? { ...styles.itemName, ...styles.cancelled } : styles.itemName}>
                          {item.name}
                          {cancelled ? ' · cancelled' : ''}
                        </p>
                        <strong style={cancelled ? { ...styles.lineTotal, ...styles.cancelled } : styles.lineTotal}>
                          {money(item.lineTotal)}
                        </strong>
                      </div>
                      <div style={styles.itemFoot}>
                        <span style={styles.shopLine}>
                          {item.shopName} · ×{item.quantity}
                        </span>
                        <div style={styles.itemActions}>
                          {item.orderItemId && item.myRating ? (
                            <StarRating
                              value={item.myRating}
                              readOnly
                              size="sm"
                              label={`You rated ${item.name} ${item.myRating} stars`}
                            />
                          ) : null}
                          {item.canRate && item.orderItemId && !item.myRating ? (
                            <StarRating
                              value={draftRatings[item.orderItemId] ?? 0}
                              onChange={(stars) => {
                                setDraftRatings((prev) => ({ ...prev, [item.orderItemId!]: stars }));
                                void submitRating(item.orderItemId!, stars)
                                  .then(() =>
                                    setResultDialog({
                                      title: 'Thanks for rating',
                                      description: `You rated ${item.name} ${stars}★.`,
                                    }),
                                  )
                                  .catch((err) =>
                                    setResultDialog({
                                      title: 'Could not save rating',
                                      description: err instanceof Error ? err.message : 'Please try again.',
                                    }),
                                  );
                              }}
                              size="sm"
                              label={`Rate ${item.name}`}
                            />
                          ) : null}
                          {item.canCancel && item.orderItemId ? (
                            <button
                              type="button"
                              style={styles.textAction}
                              disabled={cancelBusy}
                              onClick={() =>
                                setCancelTarget({
                                  kind: 'item',
                                  itemId: item.orderItemId!,
                                  itemName: item.name,
                                })
                              }
                            >
                              Cancel
                            </button>
                          ) : null}
                          {canClaim ? (
                            <button
                              type="button"
                              style={styles.textAction}
                              disabled={claimBusy}
                              onClick={() => {
                                setClaimPresetItemId(item.orderItemId!);
                                setClaimOpen(true);
                              }}
                            >
                              Issue
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {cancelled && item.storeCreditAmount ? (
                        <p style={styles.creditNote}>
                          ₹{Number(item.storeCreditAmount).toFixed(2)} store credit
                          {item.cancelReason ? ` · ${item.cancelReason}` : ''}
                          {' · '}
                          <Link to="/wallet" style={styles.walletLink}>
                            Wallet
                          </Link>
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {claims.length > 0 ? (
            <section style={styles.section}>
              <h2 style={styles.h2}>Your claims</h2>
              <Card padding="sm" style={styles.itemList}>
                {claims.map((c, index) => (
                  <div
                    key={c.claimId}
                    style={{ ...styles.itemRow, ...(index === claims.length - 1 ? styles.itemRowLast : {}) }}
                  >
                    <p style={styles.itemName}>
                      {claimTypeLabel(c.claimType)}
                      {c.itemName ? ` · ${c.itemName}` : ''}
                      {c.shopName ? ` · ${c.shopName}` : ''}
                    </p>
                    <p style={{ ...styles.shopLine, whiteSpace: 'normal' }}>
                      {c.status}
                      {c.suggestedCreditAmount != null && c.status === 'OPEN'
                        ? ` · up to ₹${Number(c.suggestedCreditAmount).toFixed(2)}`
                        : ''}
                      {c.resolvedAmount != null && Number(c.resolvedAmount) > 0
                        ? ` · ₹${Number(c.resolvedAmount).toFixed(2)} store credit`
                        : ''}
                      {c.reason ? ` · ${c.reason}` : ''}
                    </p>
                    {c.status === 'REJECTED' && c.resolutionNote ? (
                      <p style={styles.creditNote}>Hub: {c.resolutionNote}</p>
                    ) : null}
                    {c.status === 'RESOLVED' ? (
                      <p style={styles.creditNote}>
                        Credit in wallet ·{' '}
                        <Link to="/wallet" style={styles.walletLink}>
                          Wallet
                        </Link>
                      </p>
                    ) : null}
                  </div>
                ))}
              </Card>
            </section>
          ) : null}

          <Card elevated style={styles.totals}>
            <p style={styles.totalsTitle}>Bill summary</p>
            <div style={styles.totalRow}>
              <span>Items subtotal</span>
              <strong>{money(order.itemsSubtotal)}</strong>
            </div>
            {(order.promoDiscount ?? 0) > 0 ? (
              <div style={styles.totalRow}>
                <span>{order.promoCode ? `Coupon · ${order.promoCode}` : 'Coupon discount'}</span>
                <strong style={styles.creditAmount}>−{money(order.promoDiscount)}</strong>
              </div>
            ) : null}
            <div style={styles.totalRow}>
              <span>Delivery fee</span>
              {(order.membershipDeliveryWaived ?? 0) > 0 && Number(order.deliveryFee) === 0 ? (
                <strong>
                  <span style={styles.struckDelivery}>{money(order.membershipDeliveryWaived)}</span>{' '}
                  <span style={styles.freeDelivery}>Free</span>
                </strong>
              ) : (
                <strong>{money(order.deliveryFee)}</strong>
              )}
            </div>
            <div style={styles.totalRow}>
              <span>Platform fee</span>
              <strong>{money(order.platformFee ?? 0)}</strong>
            </div>
            {(order.codFee ?? 0) > 0 ? (
              <div style={styles.totalRow}>
                <span>COD charge</span>
                <strong>{money(order.codFee)}</strong>
              </div>
            ) : null}
            {(order.membershipFee ?? 0) > 0 ? (
              <div style={styles.totalRow}>
                <span>
                  Free delivery plan
                  {order.membershipSlab ? ` · ${membershipSlabLabel(order.membershipSlab)}` : ''}
                </span>
                <strong>{money(order.membershipFee)}</strong>
              </div>
            ) : null}
            {(order.storeCreditApplied ?? 0) > 0 ? (
              <div style={styles.totalRow}>
                <span>Store credit applied</span>
                <strong>−{money(order.storeCreditApplied)}</strong>
              </div>
            ) : null}
            <div style={{ ...styles.totalRow, ...styles.grand }}>
              <span>
                {order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID'
                  ? 'Total due at delivery'
                  : 'Total paid'}
              </span>
              <strong style={styles.grandAmount}>{money(order.totalAmount)}</strong>
            </div>
          </Card>

          {formatAddress(order.deliveryAddress).length > 0 ? (
            <section style={styles.addressCard}>
              <h2 style={styles.h2}>
                <span style={styles.addressPin} aria-hidden>
                  📍
                </span>{' '}
                Delivery address
              </h2>
              {formatAddress(order.deliveryAddress).map((line) => (
                <p key={line} style={styles.addressLine}>
                  {line}
                </p>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
      </div>

      {scratchOpen && order?.scratchCard && session?.accessToken ? (
        <ScratchCardSheet
          card={order.scratchCard}
          token={session.accessToken}
          onClose={() => setScratchOpen(false)}
          onRevealed={() => {
            void reload();
            window.dispatchEvent(new Event('hlm:scratch-refresh'));
          }}
        />
      ) : null}

      <ReasonDialog
        open={cancelTarget != null}
        title={cancelTarget?.kind === 'item' ? 'Cancel this item?' : 'Cancel this order?'}
        description={
          cancelTarget?.kind === 'item'
            ? `We’ll credit ${cancelTarget.itemName} to your wallet as store credit.`
            : 'This stops the order before shops pack. Online payments are refunded; COD just cancels.'
        }
        confirmLabel={cancelTarget?.kind === 'item' ? 'Cancel item' : 'Cancel order'}
        reasons={cancelTarget?.kind === 'item' ? ITEM_CANCEL_REASONS : ORDER_CANCEL_REASONS}
        commentPlaceholder="Anything else we should know? (optional)"
        danger
        busy={cancelBusy}
        onConfirm={(reason) => void onConfirmCancel(reason)}
        onClose={() => {
          if (!cancelBusy) setCancelTarget(null);
        }}
      />

      <ClaimDialog
        open={claimOpen}
        items={claimableItems}
        presetItemId={claimPresetItemId}
        busy={claimBusy}
        onConfirm={(payload) => void onConfirmClaim(payload)}
        onClose={() => {
          if (!claimBusy) {
            setClaimOpen(false);
            setClaimPresetItemId(null);
          }
        }}
      />

      <ConfirmDialog
        open={resultDialog != null}
        alertOnly
        title={resultDialog?.title ?? ''}
        description={resultDialog?.description ?? ''}
        confirmLabel="OK"
        onConfirm={() => setResultDialog(null)}
        onClose={() => setResultDialog(null)}
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
  stack: { display: 'grid', gap: '0.65rem' },
  heroCard: {
    padding: '0.85rem 0.9rem 0.95rem',
    borderRadius: 18,
    background:
      'linear-gradient(165deg, var(--bg-elevated) 0%, color-mix(in srgb, var(--accent-soft) 28%, var(--bg-elevated)) 100%)',
    border: '1px solid color-mix(in srgb, var(--accent) 14%, var(--border))',
    boxShadow: 'var(--shadow-soft)',
    display: 'grid',
    gap: '0.45rem',
  },
  heroTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.22rem 0.55rem',
    borderRadius: 999,
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  statusPillBrand: {
    background: 'linear-gradient(135deg, var(--accent-soft), #d1fae5)',
    color: 'var(--accent)',
    border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
  },
  statusPillRoute: {
    background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
    color: '#c2410c',
    border: '1px solid #fed7aa',
  },
  statusPillSuccess: {
    background: 'rgba(22, 163, 74, 0.14)',
    color: '#15803d',
  },
  statusPillDanger: {
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
  },
  statusPillWarn: {
    background: '#fffbeb',
    color: '#92400e',
    border: '1px solid #fde68a',
  },
  payChip: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    padding: '0.2rem 0.45rem',
    borderRadius: 8,
    background: 'color-mix(in srgb, var(--bg-muted) 70%, transparent)',
  },
  heroOrderNo: {
    margin: 0,
    fontWeight: 800,
    fontFamily: 'var(--font-display)',
    fontSize: '1.15rem',
    letterSpacing: '-0.03em',
    lineHeight: 1.15,
  },
  heroTotalRow: {
    margin: 0,
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  heroTotalLabel: { fontSize: '0.78rem', fontWeight: 650, color: 'var(--text-muted)' },
  heroTotalAmount: {
    fontSize: '1.35rem',
    fontWeight: 900,
    letterSpacing: '-0.03em',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--text)',
  },
  actionPrimary: { display: 'grid', gap: '0.4rem', marginTop: '0.15rem' },
  actionSecondary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem 0.75rem',
    paddingTop: '0.15rem',
  },
  linkAction: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.78rem',
    padding: '0.35rem 0',
    minHeight: 40,
    cursor: 'pointer',
  },
  linkActionDanger: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--danger)',
    fontWeight: 800,
    fontSize: '0.78rem',
    padding: '0.35rem 0',
    minHeight: 40,
    cursor: 'pointer',
  },
  meta: { margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.35 },
  cancelHint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.76rem', lineHeight: 1.4 },
  section: { display: 'grid', gap: '0.35rem' },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    paddingInline: '0.1rem',
  },
  countBadge: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--accent)',
    background: 'var(--accent-soft)',
    padding: '0.15rem 0.45rem',
    borderRadius: 999,
  },
  h2: {
    margin: 0,
    fontSize: '0.92rem',
    fontWeight: 800,
    fontFamily: 'var(--font-display)',
    letterSpacing: '-0.02em',
  },
  list: { display: 'grid', gap: '0.4rem' },
  itemList: {
    padding: '0.35rem 0.65rem',
    display: 'grid',
    borderRadius: 16,
    background: 'var(--bg-elevated)',
    border: '1px solid color-mix(in srgb, var(--border) 88%, transparent)',
    boxShadow: 'var(--shadow-card)',
  },
  itemRow: {
    display: 'grid',
    gap: '0.12rem',
    padding: '0.48rem 0',
    borderBottom: '1px solid color-mix(in srgb, var(--border) 75%, transparent)',
  },
  itemRowLast: { borderBottom: 'none' },
  itemTop: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '0.65rem',
  },
  itemFoot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.45rem',
    minWidth: 0,
  },
  itemActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.15rem',
    flexShrink: 0,
  },
  shopLine: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  itemName: { margin: 0, fontWeight: 750, fontSize: '0.88rem', lineHeight: 1.25, minWidth: 0 },
  cancelled: { textDecoration: 'line-through', color: 'var(--text-muted)' },
  creditNote: { margin: '0.1rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.35 },
  textAction: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 700,
    fontSize: '0.75rem',
    padding: '0.35rem 0.35rem',
    minHeight: 36,
    cursor: 'pointer',
  },
  walletLink: { color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' },
  lineTotal: {
    fontWeight: 800,
    whiteSpace: 'nowrap',
    fontSize: '0.92rem',
    fontVariantNumeric: 'tabular-nums',
  },
  totals: {
    padding: '0.75rem 0.85rem 0.85rem',
    display: 'grid',
    gap: '0.35rem',
    borderRadius: 16,
  },
  totalsTitle: {
    margin: '0 0 0.15rem',
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    fontSize: '0.84rem',
    fontWeight: 600,
  },
  grand: {
    marginTop: '0.2rem',
    padding: '0.55rem 0.6rem',
    borderRadius: 12,
    background: 'linear-gradient(135deg, var(--accent-soft), color-mix(in srgb, var(--accent-soft) 40%, #ecfdf5))',
    border: '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
  },
  grandAmount: { fontSize: '1.12rem', fontWeight: 900 },
  struckDelivery: {
    textDecoration: 'line-through',
    color: 'var(--text-muted)',
    fontWeight: 600,
    marginRight: '0.15rem',
  },
  freeDelivery: { color: 'var(--accent)', fontWeight: 800 },
  creditAmount: { color: 'var(--accent)', fontWeight: 800 },
  addressCard: {
    padding: '0.75rem 0.85rem',
    display: 'grid',
    gap: '0.3rem',
    borderRadius: 16,
    background: 'var(--bg-elevated)',
    border: '1px solid color-mix(in srgb, var(--border) 88%, transparent)',
    boxShadow: 'var(--shadow-card)',
  },
  addressPin: { fontSize: '0.85rem' },
  addressLine: { margin: 0, color: 'var(--text)', fontSize: '0.84rem', fontWeight: 600, lineHeight: 1.4 },
  scratchCard: { padding: '0.7rem 0.85rem' },
  scratchRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
  },
  scratchTitle: { margin: 0, fontWeight: 800, fontSize: '0.92rem' },
  agentCard: { padding: '0.65rem 0.85rem', display: 'grid', gap: '0.4rem' },
  agentHead: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  agentRated: { display: 'grid', gap: '0.2rem' },
  agentForm: { display: 'grid', gap: '0.4rem' },
  agentLabel: {
    display: 'grid',
    gap: '0.2rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  agentInput: {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 44,
    resize: 'vertical',
    padding: '0.4rem 0.5rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    fontWeight: 500,
    lineHeight: 1.35,
  },
  agentComment: { margin: 0, fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.35 },
  agentCommentMuted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 },
};
