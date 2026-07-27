import { useState, type CSSProperties } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Badge, Banner, Button, Card, EmptyState, LoadingBlock } from '@/shared/ui';
import { useShop } from '../hooks/useShop';
import { useOrderDetail } from '../hooks/useOrderDetail';
import { formatBuyerPaymentLabel } from '../lib/formatBuyerPaymentLabel';
import { OrderStatusTimeline } from '../components/OrderStatusTimeline';
import { ReasonDialog } from '../components/ReasonDialog';
import { ClaimDialog } from '../components/ClaimDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StarRating } from '../components/StarRating';
import type { ClaimType, OrderDetailDto } from '../api/shopApi';

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'brand' {
  const s = status.toLowerCase();
  if (s.includes('deliver') || s.includes('complete') || s.includes('paid')) return 'success';
  if (s.includes('cancel') || s.includes('fail')) return 'danger';
  if (s.includes('pending') || s.includes('placed') || s.includes('confirm')) return 'brand';
  if (s.includes('cod') || s.includes('unpaid')) return 'warning';
  return 'neutral';
}

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

type CancelTarget =
  | { kind: 'order' }
  | { kind: 'item'; itemId: string; itemName: string }
  | null;

export function OrderDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId } = useParams<{ orderId: string }>();
  const preview = (location.state as { preview?: OrderDetailDto } | null)?.preview ?? null;
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
    ratingBusyId,
    reload,
    downloadInvoice,
    cancelWholeOrder,
    cancelItem,
    fileClaim,
    submitRating,
  } = useOrderDetail(orderId, preview);

  const [cancelTarget, setCancelTarget] = useState<CancelTarget>(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [draftRatings, setDraftRatings] = useState<Record<string, number>>({});
  const [claimPresetItemId, setClaimPresetItemId] = useState<string | null>(null);
  const [resultDialog, setResultDialog] = useState<{ title: string; description: string } | null>(
    null,
  );

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

  return (
    <PortalShell
      title="Order details"
      subtitle={order?.orderNumber ?? 'Items you ordered'}
      cartCount={cart?.itemCount ?? 0}
      onRefresh={() => void reload()}
      showDeliveryBanner={false}
    >
      <Link to="/orders" style={styles.back}>
        ← Back to my orders
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
          <Card elevated style={styles.headerCard}>
            <div style={styles.headerTop}>
              <div>
                <p style={styles.orderNo}>{order.orderNumber}</p>
                <p style={styles.meta}>
                  Payment:{' '}
                  {formatBuyerPaymentLabel({
                    paymentMethod: order.paymentMethod,
                    paymentStatus: order.paymentStatus,
                    orderStatus: order.status,
                  })}
                </p>
              </div>
              <div style={styles.badgeCol}>
                <Badge tone={statusTone(order.displayStatus || order.status)}>
                  {order.displayStatus || order.status}
                </Badge>
              </div>
            </div>
            <div style={styles.actions}>
              <Button
                variant="primary"
                disabled={!canDownloadInvoice || invoiceBusy}
                onClick={() => void downloadInvoice()}
              >
                {invoiceBusy ? 'Preparing PDF…' : 'Download invoice'}
              </Button>
              {order.canCancelOrder ? (
                <Button
                  variant="danger"
                  disabled={cancelBusy}
                  onClick={() => setCancelTarget({ kind: 'order' })}
                >
                  Cancel order
                </Button>
              ) : null}
              {order.canFileClaim && claimableItems.length > 0 ? (
                <Button
                  variant="ghost"
                  disabled={claimBusy}
                  onClick={() => {
                    setClaimPresetItemId(null);
                    setClaimOpen(true);
                  }}
                >
                  Report issue
                </Button>
              ) : null}
              <p style={{ ...styles.hint, visibility: canDownloadInvoice ? 'hidden' : 'visible' }}>
                Invoice will be available once payment is confirmed.
              </p>
            </div>
            {invoiceError ? <Banner tone="danger">{invoiceError}</Banner> : null}
            {order.canCancelOrder ? (
              <p style={styles.cancelHint}>
                You can cancel before shops mark items ready. After that, cancel individual items
                that are still waiting.
              </p>
            ) : null}
          </Card>

          {order.timeline && order.timeline.length > 0 ? (
            <OrderStatusTimeline
              steps={order.timeline}
              orderStatus={order.status}
              displayStatus={order.displayStatus}
            />
          ) : null}

          <section style={styles.section}>
            <h2 style={styles.h2}>Items in this order</h2>
            {(order.items?.length ?? 0) === 0 ? (
              <LoadingBlock label="Loading items…" />
            ) : (
              <div style={styles.list}>
                {order.items.map((item, index) => {
                  const cancelled = (item.status ?? 'ACTIVE').toUpperCase() === 'CANCELLED';
                  return (
                    <Card
                      key={item.orderItemId ?? `${item.name}-${item.shopName}-${index}`}
                      style={styles.itemRow}
                    >
                      <div style={styles.itemBody}>
                        <p
                          style={
                            cancelled ? { ...styles.itemName, ...styles.cancelled } : styles.itemName
                          }
                        >
                          {item.quantity}× {item.name}
                          {cancelled ? ' (cancelled)' : ''}
                        </p>
                        <p style={styles.meta}>{item.shopName}</p>
                        {cancelled && item.storeCreditAmount ? (
                          <p style={styles.creditNote}>
                            ₹{Number(item.storeCreditAmount).toFixed(2)} added to your wallet as store
                            credit
                            {item.cancelReason ? ` · ${item.cancelReason}` : ''}
                            {' · '}
                            <Link to="/wallet" style={styles.walletLink}>
                              Open wallet
                            </Link>
                          </p>
                        ) : null}
                        {item.canCancel && item.orderItemId ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={cancelBusy}
                            onClick={() =>
                              setCancelTarget({
                                kind: 'item',
                                itemId: item.orderItemId!,
                                itemName: item.name,
                              })
                            }
                          >
                            Cancel item
                          </Button>
                        ) : null}
                        {item.canFileClaim &&
                        item.orderItemId &&
                        !blockedClaimItemIds.has(item.orderItemId) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={claimBusy}
                            onClick={() => {
                              setClaimPresetItemId(item.orderItemId!);
                              setClaimOpen(true);
                            }}
                          >
                            Report issue
                          </Button>
                        ) : null}
                        {item.orderItemId && item.myRating ? (
                          <div style={styles.rateBox}>
                            <p style={styles.rateLabel}>Your rating</p>
                            <StarRating
                              value={item.myRating}
                              readOnly
                              size="md"
                              label={`You rated ${item.name} ${item.myRating} stars`}
                            />
                          </div>
                        ) : null}
                        {item.canRate && item.orderItemId && !item.myRating ? (
                          <div style={styles.rateBox}>
                            <p style={styles.rateLabel}>Rate this product</p>
                            <StarRating
                              value={draftRatings[item.orderItemId] ?? 5}
                              onChange={(stars) =>
                                setDraftRatings((prev) => ({ ...prev, [item.orderItemId!]: stars }))
                              }
                              size="md"
                              label={`Rate ${item.name}`}
                            />
                            <Button
                              size="sm"
                              disabled={ratingBusyId === item.orderItemId}
                              onClick={() => {
                                const stars = draftRatings[item.orderItemId!] ?? 5;
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
                                      description:
                                        err instanceof Error ? err.message : 'Please try again.',
                                    }),
                                  );
                              }}
                            >
                              {ratingBusyId === item.orderItemId ? 'Saving…' : 'Submit rating'}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <strong style={styles.lineTotal}>{money(item.lineTotal)}</strong>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {claims.length > 0 ? (
            <section style={styles.section}>
              <h2 style={styles.h2}>Your claims</h2>
              <div style={styles.list}>
                {claims.map((c) => (
                  <Card key={c.claimId} style={styles.itemRow}>
                    <div style={styles.itemBody}>
                      <p style={styles.itemName}>
                        {claimTypeLabel(c.claimType)}
                        {c.itemName ? ` · ${c.itemName}` : ''}
                        {c.shopName ? ` (${c.shopName})` : ''}
                      </p>
                      <p style={styles.meta}>
                        {c.status}
                        {c.suggestedCreditAmount != null && c.status === 'OPEN'
                          ? ` · up to ₹${Number(c.suggestedCreditAmount).toFixed(2)}`
                          : ''}
                        {c.resolvedAmount != null && Number(c.resolvedAmount) > 0
                          ? ` · ₹${Number(c.resolvedAmount).toFixed(2)} store credit`
                          : ''}
                      </p>
                      <p style={styles.meta}>{c.reason}</p>
                      {c.status === 'REJECTED' && c.resolutionNote ? (
                        <p style={styles.meta}>Hub: {c.resolutionNote}</p>
                      ) : null}
                      {c.status === 'RESOLVED' ? (
                        <p style={styles.creditNote}>
                          Credit added to your wallet ·{' '}
                          <Link to="/wallet" style={styles.walletLink}>
                            Open wallet
                          </Link>
                        </p>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          <Card elevated style={styles.totals}>
            <div style={styles.totalRow}>
              <span>Items subtotal</span>
              <strong>{money(order.itemsSubtotal)}</strong>
            </div>
            <div style={styles.totalRow}>
              <span>Delivery fee</span>
              <strong>{money(order.deliveryFee)}</strong>
            </div>
            {(order.storeCreditApplied ?? 0) > 0 ? (
              <div style={styles.totalRow}>
                <span>Store credit applied</span>
                <strong>−{money(order.storeCreditApplied)}</strong>
              </div>
            ) : null}
            <div style={{ ...styles.totalRow, ...styles.grand }}>
              <span>Total paid</span>
              <strong style={styles.grandAmount}>{money(order.totalAmount)}</strong>
            </div>
          </Card>

          {formatAddress(order.deliveryAddress).length > 0 ? (
            <Card style={styles.addressCard}>
              <h2 style={styles.h2}>Delivered to</h2>
              {formatAddress(order.deliveryAddress).map((line) => (
                <p key={line} style={styles.meta}>
                  {line}
                </p>
              ))}
            </Card>
          ) : null}
        </div>
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
  back: {
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '0.92rem',
  },
  stack: { display: 'grid', gap: '0.9rem' },
  headerCard: { padding: '1rem 1.05rem', animation: 'none' },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    alignItems: 'flex-start',
  },
  orderNo: { margin: 0, fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: '1.05rem' },
  meta: { margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' },
  badgeCol: { display: 'grid', gap: '0.35rem', justifyItems: 'end' },
  actions: { display: 'grid', gap: '0.45rem', marginTop: '0.85rem' },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem' },
  cancelHint: { margin: '0.55rem 0 0', color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.4 },
  section: { display: 'grid', gap: '0.55rem' },
  h2: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 800,
    fontFamily: 'var(--font-display)',
  },
  list: { display: 'grid', gap: '0.55rem' },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    padding: '0.8rem 0.9rem',
    alignItems: 'flex-start',
  },
  itemBody: { display: 'grid', gap: '0.25rem', minWidth: 0, flex: 1 },
  itemName: { margin: 0, fontWeight: 700 },
  cancelled: { textDecoration: 'line-through', color: 'var(--text-muted)' },
  creditNote: { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 },
  rateBox: {
    display: 'grid',
    gap: '0.35rem',
    marginTop: '0.45rem',
    paddingTop: '0.45rem',
    borderTop: '1px dashed var(--border)',
    justifyItems: 'start',
  },
  rateLabel: {
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  walletLink: { color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' },
  lineTotal: { fontWeight: 800, whiteSpace: 'nowrap' },
  totals: { padding: '0.9rem 1rem', display: 'grid', gap: '0.4rem' },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    fontSize: '0.9rem',
  },
  grand: { marginTop: '0.25rem', paddingTop: '0.45rem', borderTop: '1px solid var(--border)' },
  grandAmount: { fontSize: '1.05rem' },
  addressCard: { padding: '0.9rem 1rem', display: 'grid', gap: '0.25rem' },
};
