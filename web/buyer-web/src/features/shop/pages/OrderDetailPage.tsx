import type { CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Badge, Banner, Button, Card, EmptyState, LoadingBlock } from '@/shared/ui';
import { useShop } from '../hooks/useShop';
import { useOrderDetail } from '../hooks/useOrderDetail';
import { formatBuyerPaymentLabel } from '../lib/formatBuyerPaymentLabel';

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

export function OrderDetailPage() {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { cart } = useShop();
  const { order, loading, error, invoiceBusy, invoiceError, reload, downloadInvoice } =
    useOrderDetail(orderId);

  const canDownloadInvoice = Boolean(order?.invoicePdfUrl);

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
              <Badge tone={statusTone(order.displayStatus || order.status)}>
                {order.displayStatus || order.status}
              </Badge>
            </div>
            <div style={styles.actions}>
              <Button
                variant="primary"
                disabled={!canDownloadInvoice || invoiceBusy}
                onClick={() => void downloadInvoice()}
              >
                {invoiceBusy ? 'Preparing PDF…' : 'Download invoice'}
              </Button>
              {!canDownloadInvoice ? (
                <p style={styles.hint}>Invoice will be available once payment is confirmed.</p>
              ) : null}
            </div>
            {invoiceError ? <Banner tone="danger">{invoiceError}</Banner> : null}
          </Card>

          <section style={styles.section}>
            <h2 style={styles.h2}>Items in this order</h2>
            <div style={styles.list}>
              {order.items.map((item, index) => (
                <Card key={`${item.name}-${item.shopName}-${index}`} style={styles.itemRow}>
                  <div>
                    <p style={styles.itemName}>
                      {item.quantity}× {item.name}
                    </p>
                    <p style={styles.meta}>{item.shopName}</p>
                  </div>
                  <strong style={styles.lineTotal}>{money(item.lineTotal)}</strong>
                </Card>
              ))}
            </div>
          </section>

          <Card elevated style={styles.totals}>
            <div style={styles.totalRow}>
              <span>Items subtotal</span>
              <strong>{money(order.itemsSubtotal)}</strong>
            </div>
            <div style={styles.totalRow}>
              <span>Delivery fee</span>
              <strong>{money(order.deliveryFee)}</strong>
            </div>
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
  stack: { display: 'grid', gap: '1rem' },
  headerCard: { display: 'grid', gap: '0.85rem' },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    alignItems: 'flex-start',
  },
  orderNo: { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem' },
  meta: { margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' },
  actions: { display: 'grid', gap: '0.4rem', justifyItems: 'start' },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' },
  section: { display: 'grid', gap: '0.65rem' },
  h2: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800 },
  list: { display: 'grid', gap: '0.55rem' },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    alignItems: 'center',
  },
  itemName: { margin: 0, fontWeight: 700 },
  lineTotal: { fontFamily: 'var(--font-display)' },
  totals: { display: 'grid', gap: '0.45rem' },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  grand: { marginTop: '0.25rem', color: 'var(--text)' },
  grandAmount: { fontFamily: 'var(--font-display)', fontSize: '1.35rem' },
  addressCard: { display: 'grid', gap: '0.25rem' },
};
